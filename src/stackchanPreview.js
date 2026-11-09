// Browser preview of firmware/src/stack-chan/inari_emote_policy.cpp.
// This is a visual simulator; feedback is idealized and no device is controlled.
import { EMOTION_ORDER, getEmotion } from "./emotionCatalog.js";
import { axisLimits, clampAngle, clamp } from "./stackchanMotionMath.js";
import { editorBounds, visibleStep, motionDraft, motionDraftFilename, FACE_TYPES, STEP_MIN_MS, STEP_MAX_MS, MAX_STEPS } from "./stackchanMotionDraft.js";
import { baseFacePreset, baseFaceDesign, baseFaceBitmaps, loadBaseFaceDesign } from "./stackchanFaceLibrary.js";
import { FACE_WIDTH, FACE_HEIGHT, validateFaceDesign, drawFace, packFacePixels, paintPackedFace } from "./stackchanFaceData.js";
import { createFaceAnimationStudio } from "./stackchanFaceAnimationStudio.js";
import { createStackchanScene } from "./stackchanScene.js";
import { createLiveSerial } from "./stackchanLiveSerial.js";
import { createStackchanAudioStudio } from "./stackchanAudioStudio.js";
import { alignTracks } from "./stackchanUnifiedTimeline.js";
import { upgradeFaceAnimationDesign } from "./stackchanFaceAnimationData.js";
import { TIMELINES, EMOTION_LOOPS, PLANNING_RATES_DPS } from "./stackchanEmotionDesign.js";

const $ = (id) => document.getElementById(id);
const labels = Object.fromEntries(EMOTION_ORDER.map((name) => [name, getEmotion(name).label]));
export { TIMELINES };
const LOOPS = new Set(EMOTION_LOOPS);
const RATE = Object.fromEntries(EMOTION_ORDER.map((name)=>[name,[...PLANNING_RATES_DPS]]));
let commandRates = null;
const drafts = Object.fromEntries(EMOTION_ORDER.map((name) => [name, TIMELINES[name].map((part) => ({...part}))]));
const MOTION_STORE="inari-stackchan-unified-motion-v3";
try {
  const saved=JSON.parse(localStorage.getItem(MOTION_STORE));
  if (saved && EMOTION_ORDER.every((name)=>Array.isArray(saved[name]) && saved[name].length>=1 && saved[name].length<=MAX_STEPS &&
      saved[name].every((part)=>Number.isInteger(part.ms)&&part.ms>=40&&part.ms<=60000&&
        Number.isFinite(part.yaw)&&Number.isFinite(part.pitch)&&FACE_TYPES.includes(part.face))))
    for (const name of EMOTION_ORDER) drafts[name]=saved[name];
} catch { /* Keep defaults. */ }
const saveMotions=()=>{try{localStorage.setItem(MOTION_STORE,JSON.stringify(drafts));}catch{ /* session remains editable */ }};
const stepsFor = (name) => drafts[name];
const faceOptions = FACE_TYPES;

function renderEditor() {
  const rows = $("editorRows");
  rows.replaceChildren();
  const bounds = editorBounds(limits);
  stepsFor(currentEmotion).forEach((part, stepIndex) => {
    const row = document.createElement("tr");
    const number = document.createElement("td"); number.textContent = String(stepIndex+1).padStart(2,"0"); row.append(number);
    const visible = visibleStep(part, limits);
    for (const [key, value, min, max, increment] of [
      ["ms",visible.durationMs,STEP_MIN_MS,STEP_MAX_MS,10],
      ["yaw",visible.yawDegrees,bounds.yaw.min,bounds.yaw.max,.1],
      ["pitch",visible.pitchDegrees,bounds.pitch.min,bounds.pitch.max,.1]
    ]) {
      const cell = document.createElement("td"), input = document.createElement("input");
      input.type = "number"; input.min = String(min); input.max = String(max); input.step = String(increment); input.value = String(value);
      input.setAttribute("aria-label", `ステップ${stepIndex+1} ${key}`);
      input.addEventListener("change", () => {
        const proposed = Number(input.value);
        if (!Number.isFinite(proposed) || proposed < min || proposed > max) { input.value = String(value); return; }
        part[key] = key === "yaw" || key === "pitch" ? (key === "yaw" ? proposed : proposed-30)/4 : proposed;
        play(currentEmotion);
      });
      cell.append(input); row.append(cell);
    }
    const faceCell = document.createElement("td"), select = document.createElement("select");
    select.setAttribute("aria-label", `ステップ${stepIndex+1} 表情`);
    faceOptions.forEach((face) => { const option = document.createElement("option"); option.value = face; option.textContent = face; select.append(option); });
    select.value = part.face;
    select.addEventListener("change", () => { part.face = select.value; play(currentEmotion); });
    faceCell.append(select); row.append(faceCell);
    const action = document.createElement("td"), remove = document.createElement("button");
    remove.type = "button"; remove.textContent = "×"; remove.title = "このステップを削除";
    remove.disabled = stepsFor(currentEmotion).length <= 1;
    remove.addEventListener("click", () => { stepsFor(currentEmotion).splice(stepIndex,1); play(currentEmotion); });
    action.append(remove); row.append(action);
    rows.append(row);
  });
}
$("addStep").addEventListener("click", () => {
  if (stepsFor(currentEmotion).length >= MAX_STEPS) return;
  stepsFor(currentEmotion).push({...stepsFor(currentEmotion).at(-1), ms:800});
  play(currentEmotion);
});
$("resetEmotion").addEventListener("click", () => { drafts[currentEmotion] = TIMELINES[currentEmotion].map((part) => ({...part})); play(currentEmotion); });
$("exportDraft").addEventListener("click", () => {
  try {
    const body = motionDraft(currentEmotion, stepsFor(currentEmotion), LOOPS, limits);
    downloadJson(motionDraftFilename(currentEmotion), body);
  } catch (error) {
    $("motionStatus").textContent = error.message;
  }
});

function downloadJson(name, body) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(body,null,2)],{type:"application/json"}));
  link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href),1000);
}

async function designBundle() {
  const faceDesign=faceAnimationStudio.design();
  for(const name of EMOTION_ORDER) {
    const frames=faceDesign.emotions[name].frames,steps=stepsFor(name);
    if(frames.length!==steps.length || frames.some((frame,index)=>frame.durationMs!==steps[index].ms))
      throw new RangeError(`${name} の顔と首の時間軸が一致していません。`);
  }
  return {
    format: "inari-stackchan-design-v2",
    faces: baseFaceBitmaps(),
    faceDesign: baseFaceDesign(),
    faceAnimations: faceAnimationStudio.exportBitmaps(),
    faceAnimationDesign: faceDesign,
    motions: EMOTION_ORDER.map((name) => motionDraft(name, stepsFor(name), LOOPS, limits)),
    audio: await audioStudio.exportConfig(),
  };
}
$("exportDesignBundle").addEventListener("click", async () => {
  try {
    const body = await designBundle();
    downloadJson("inari-stackchan-design-v2.json", body);
    $("faceStatus").textContent = "10感情の表情・首の動き・音設定をJSONに書き出しました。";
  } catch (error) {
    $("faceStatus").textContent = error.message;
  }
});
$("importDesignBundle").addEventListener("click",()=>$("importDesignFile").click());
$("importDesignFile").addEventListener("change",async(event)=>{
  const file=event.target.files?.[0]; if(!file)return;
  const previous=structuredClone(drafts);
  try {
    if(file.size>8*1024*1024) throw new RangeError("JSONは8 MB以下にしてください。");
    const bundle=JSON.parse(await file.text());
    if(bundle.format!=="inari-stackchan-design-v2" || !Array.isArray(bundle.motions) || bundle.motions.length!==EMOTION_ORDER.length)
      throw new RangeError("10感情を含む実機用JSONを選んでください。");
    const faceDesign=upgradeFaceAnimationDesign(bundle.faceAnimationDesign);
    if(!faceDesign) throw new RangeError("顔アニメーションを読み込めません。");
    if (bundle.faceDesign && !validateFaceDesign(bundle.faceDesign))
      throw new RangeError("基本顔の編集設定を確認してください。");
    const imported={};
    for(const name of EMOTION_ORDER) {
      const motion=bundle.motions.find((item)=>item.emotion===name);
      if(!motion || motion.format!=="inari-stackchan-motion-v1" || !Array.isArray(motion.steps) ||
          motion.steps.length<1 || motion.steps.length>24 || !["loop","once"].includes(motion.playback))
        throw new RangeError(`${name} の首と顔の設定を確認してください。`);
      faceDesign.emotions[name].playback=motion.playback;
      imported[name]=motion.steps.map((part)=>{
        if(!Number.isInteger(part.durationMs)||part.durationMs<40||part.durationMs>60000||
            !Number.isFinite(part.yawDegrees)||part.yawDegrees<-60||part.yawDegrees>60||
            !Number.isFinite(part.pitchDegrees)||part.pitchDegrees<10||part.pitchDegrees>35||
            !FACE_TYPES.includes(part.face)) throw new RangeError(`${name} の首の値を確認してください。`);
        return {ms:part.durationMs,yaw:part.yawDegrees/4,pitch:(part.pitchDegrees-30)/4,face:part.face};
      });
      alignTracks(faceDesign.emotions[name].frames,imported[name]);
    }
    for(const name of EMOTION_ORDER) drafts[name]=imported[name];
    try {
      await audioStudio.importConfig(bundle.audio ?? {
        format:"inari-stackchan-audio-v1",
        emotions:Object.fromEntries(EMOTION_ORDER.map((name)=>[name,{mode:"none"}])),
        assets:[],
      });
    } catch(error) {
      for(const name of EMOTION_ORDER) drafts[name]=previous[name];
      throw error;
    }
    for(const name of EMOTION_ORDER) bundle.motions.find((item)=>item.emotion===name).playback==="loop"?LOOPS.add(name):LOOPS.delete(name);
    if (bundle.faceDesign) loadBaseFaceDesign(bundle.faceDesign);
    faceAnimationStudio.importDesign(faceDesign);
    saveMotions();
    $("faceStatus").textContent="10感情の表情・首の動き・音設定を読み込みました。";
  } catch(error) {$("faceStatus").textContent=error instanceof Error?error.message:"JSONを読み込めませんでした。";}
  finally {event.target.value="";}
});
$("uploadAll").addEventListener("click",async()=>{
  const button=$("uploadAll"); button.disabled=true;
  $("faceStatus").textContent="10感情のデータを検証し、実機へ書き込み中…";
  try {
    const body=await designBundle();
    await liveSerial.prepareUpload();
    const response=await fetch("/api/inari/deploy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error||"書き込みに失敗しました。");
    $("faceStatus").textContent=result.message||"10感情のデータを実機へ書き込みました。";
  } catch(error) {$("faceStatus").textContent=error instanceof Error?error.message:"書き込みに失敗しました。";}
  finally {liveSerial.finishUpload();button.disabled=false;}
});

const profileForm = $("profileForm");
let limits = null;
function syncProfileInputBounds() {
  for (const axis of ["yaw", "pitch"]) {
    const minimum = profileForm.elements.namedItem(`${axis}Min`);
    const zero = profileForm.elements.namedItem(`${axis}Zero`);
    const maximum = profileForm.elements.namedItem(`${axis}Max`);
    const minValue = Number(minimum.value), zeroValue = Number(zero.value), maxValue = Number(maximum.value);
    minimum.min = "0"; minimum.max = String(Math.min(999, zeroValue - 1));
    zero.min = String(Math.max(1, minValue + 1)); zero.max = String(Math.min(1000, maxValue - 1));
    maximum.min = String(Math.max(2, zeroValue + 1)); maximum.max = "1023";
  }
}
profileForm.addEventListener("input", syncProfileInputBounds);
syncProfileInputBounds();
function readProfile() {
  const data = new FormData(profileForm);
  const n = (key) => Number(data.get(key));
  return {
    yaw: axisLimits(n("yawMin"), n("yawZero"), n("yawMax"), -600, 600),
    pitch: axisLimits(n("pitchMin"), n("pitchZero"), n("pitchMax"), 100, 350),
    measured: data.has("measured"),
  };
}
function updateLimits(event) {
  event?.preventDefault();
  try {
    const next = readProfile();
    if (next.pitch.minDeg > 30 || next.pitch.maxDeg < 30 || next.yaw.minDeg > 0 || next.yaw.maxDeg < 0) throw new RangeError("30°の基準姿勢が可動域に入りません。");
    limits = next;
    $("profileError").textContent = "";
    $("rangeReadout").textContent = `使用範囲　左右 ${next.yaw.minDeg.toFixed(1)}° ～ ${next.yaw.maxDeg.toFixed(1)}°　／　上下 ${next.pitch.minDeg.toFixed(1)}° ～ ${next.pitch.maxDeg.toFixed(1)}°`;
    $("profileState").textContent = next.measured ? "実測値を適用" : "仮のサーボ範囲";
    $("profileState").classList.toggle("measured", next.measured);
    play(currentEmotion);
  } catch (error) {
    $("profileError").textContent = error.message;
  }
}
profileForm.addEventListener("submit", updateLimits);

const speakingCanvas=document.createElement("canvas"); speakingCanvas.width=FACE_WIDTH; speakingCanvas.height=FACE_HEIGHT;
const speakingCtx=speakingCanvas.getContext("2d",{willReadFrequently:true});
let speaking=false, mouthOpen=0, lastMouthAt=-1000;
function faceCanvas() { return speaking ? speakingCanvas : faceAnimationStudio.canvasAt(currentEmotion,episodeMs,audioStudio.isBgmPlaying()); }
function updateSpeech(now) {
  if (!speaking || now-lastMouthAt<150) return false;
  lastMouthAt=now;
  mouthOpen=[25,75,45,95,0,65][Math.floor(now/150)%6];
  drawFace(speakingCtx,faceAnimationStudio.presetAt(currentEmotion,episodeMs,audioStudio.isBgmPlaying()),mouthOpen);
  const pixels=packFacePixels(speakingCtx.getImageData(0,0,FACE_WIDTH,FACE_HEIGHT).data);
  paintPackedFace(speakingCtx,pixels);
  return true;
}
function renderFace(type) {
  const canvas=faceCanvas(type);
  stackchanScene.setFaceCanvas(canvas);
  return canvas;
}

let currentEmotion = "NEUTRAL", index = 0, cycle = 0, elapsed = 0, episodeMs = 0;
let yaw = 0, pitch = 30, neckActive = true, paused = false, finished = false;
let faceType = "neutral", displayedFace = null, lastFrame = 0;
function startStep() {
  const part = stepsFor(currentEmotion)[index];
  faceType = part.face;
  displayedFace = renderFace(faceType);
  $("stepReadout").textContent = `${String(index+1).padStart(2,"0")} / ${String(stepsFor(currentEmotion).length).padStart(2,"0")}`;
}
function play(name) {
  if (!TIMELINES[name] || !limits) return;
  currentEmotion = name;
  index = cycle = episodeMs = 0;
  yaw = clampAngle(0, limits.yaw); pitch = clampAngle(30, limits.pitch);
  neckActive = true; paused = false; finished = false;
  $("pauseButton").textContent = "Ⅱ 一時停止";
  $("motionStatus").textContent = "再生中";
  $("currentEmotion").textContent = `${name} / ${labels[name]}`;
  document.querySelectorAll(".emotion-buttons button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.emotion === name)));
  faceAnimationStudio.setEmotion(name);
  audioStudio.setEmotion(name);
  audioStudio.play(name);
  audioStudio.onTime(name,0);
  renderEditor();
  startStep();
}
function advance(dt) {
  if (paused) return;
  if (!finished) episodeMs += dt;
  audioStudio.onTime(currentEmotion,episodeMs);
  if (episodeMs >= 30000) neckActive=false;
  const steps=stepsFor(currentEmotion), total=steps.reduce((sum,part)=>sum+part.ms,0);
  const looping=LOOPS.has(currentEmotion)||audioStudio.isBgmPlaying();
  if (!finished && !looping && episodeMs>=total) {
    episodeMs=total;finished=true;$("motionStatus").textContent="再生終了 · 表情を保持";
  }
  const timelineTime=looping&&!finished?episodeMs%total:Math.min(episodeMs,total-1);
  const nextCycle=looping&&!finished?Math.floor(episodeMs/total):0;
  let offset=0,nextIndex=steps.length-1;
  for (let i=0;i<steps.length;i++) {offset+=steps[i].ms;if(timelineTime<offset){nextIndex=i;break;}}
  if (nextIndex!==index||nextCycle!==cycle){index=nextIndex;cycle=nextCycle;startStep();}
  const part=steps[index];
  const targetYaw=neckActive&&!finished?clampAngle(part.yaw*4,limits.yaw):0;
  const targetPitch=neckActive&&!finished?clampAngle(30+part.pitch*4,limits.pitch):30;
  const [yawRate,pitchRate]=RATE[currentEmotion];
  yaw+=clamp(targetYaw-yaw,-yawRate*dt/1500,yawRate*dt/1500);
  pitch+=clamp(targetPitch-pitch,-pitchRate*dt/1500,pitchRate*dt/1500);
}
function paint(now) {
  const dt = Math.min(100, Math.max(0, now-lastFrame || 0)); lastFrame = now;
  advance(dt);
  const speechChanged=updateSpeech(now);
  const visibleCanvas=faceCanvas(faceType);
  if (visibleCanvas !== displayedFace || speechChanged) displayedFace=renderFace(faceType);
  faceAnimationStudio.updatePreview(currentEmotion,episodeMs,audioStudio.isBgmPlaying());
  // The physical axes rotate the head; the camera angle is independent.
  stackchanScene.setPose(yaw,pitch);
  liveSerial.tick(now);
  $("yawReadout").textContent = `${yaw.toFixed(1)}°`;
  $("pitchReadout").textContent = `${pitch.toFixed(1)}°`;
  requestAnimationFrame(paint);
}

for (const name of EMOTION_ORDER) {
  const button = document.createElement("button");
  button.type = "button"; button.dataset.emotion = name;
  button.innerHTML = `${name}<small>${labels[name]}</small>`;
  button.addEventListener("click", () => { faceAnimationStudio.followPlayback(); play(name); });
  $("emotionButtons").append(button);
}
$("replayButton").addEventListener("click", () => { faceAnimationStudio.followPlayback(); play(currentEmotion); });
$("pauseButton").addEventListener("click", () => {
  paused = !paused;
  $("pauseButton").textContent = paused ? "▶ 再生" : "Ⅱ 一時停止";
  $("motionStatus").textContent = paused ? "一時停止中" : "再生中";
});
$("speakToggle").addEventListener("click",()=>{
  speaking=!speaking; mouthOpen=0; lastMouthAt=-1000;
  $("speakToggle").setAttribute("aria-pressed",String(speaking));
  $("speakToggle").textContent=speaking?"口パク中":"口パク";
  displayedFace=null;
});
function setPreviewVisible(visible) {
  $("previewToggle").setAttribute("aria-expanded",String(visible));
  $("previewToggle").textContent=visible?"3Dを隠す":"3Dを表示";
  document.querySelector(".preview-panel").hidden=!visible;
}
$("previewToggle").addEventListener("click",()=>setPreviewVisible(document.querySelector(".preview-panel").hidden));
$("previewClose").addEventListener("click",()=>setPreviewVisible(false));
setPreviewVisible(false);
for (const tab of document.querySelectorAll("[data-tool-tab]")) {
  tab.addEventListener("click",()=>{
    const name=tab.dataset.toolTab;
    for (const other of document.querySelectorAll("[data-tool-tab]"))
      other.setAttribute("aria-selected",String(other===tab));
    for (const panel of document.querySelectorAll("[data-tool-panel]"))
      panel.hidden=panel.dataset.toolPanel!==name;
  });
}
const previewWindow=document.querySelector(".preview-panel"), previewHandle=previewWindow.querySelector(".panel-top");
let previewDrag=null;
previewHandle.addEventListener("pointerdown",(event)=>{
  if (event.target.closest("button")) return;
  const box=previewWindow.getBoundingClientRect();
  previewDrag={x:event.clientX,y:event.clientY,left:box.left,top:box.top};
  previewHandle.setPointerCapture(event.pointerId);
});
previewHandle.addEventListener("pointermove",(event)=>{
  if (!previewDrag) return;
  const left=Math.max(0,Math.min(window.innerWidth-previewWindow.offsetWidth,previewDrag.left+event.clientX-previewDrag.x));
  const top=Math.max(0,Math.min(window.innerHeight-50,previewDrag.top+event.clientY-previewDrag.y));
  previewWindow.style.left=`${left}px`;previewWindow.style.top=`${top}px`;previewWindow.style.right="auto";
});
previewHandle.addEventListener("pointerup",()=>{previewDrag=null;});
previewHandle.addEventListener("pointercancel",()=>{previewDrag=null;});

$("jevForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const situation = $("situation").value.trim();
  if (!situation) return;
  const button = $("jevSubmit");
  button.disabled = true;
  $("jevStatus").textContent = "Jevが判定中…";
  $("jevStatus").dataset.state = "loading";
  try {
    const response = await fetch("/api/inari/emotion", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({situation})});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Jevの判定に失敗しました。");
    if (!EMOTION_ORDER.includes(result.emotion) || typeof result.confidence !== "number" || !Number.isFinite(result.confidence) || !result.probabilities || EMOTION_ORDER.some((name) => typeof result.probabilities[name] !== "number")) throw new Error("Jevの判定結果を確認できませんでした。");
    $("selectedEmotion").textContent = result.emotion;
    $("confidence").textContent = `${(result.confidence*100).toFixed(1)}%`;
    $("probabilities").replaceChildren(...EMOTION_ORDER.map((name) => { const row = document.createElement("div"); const label = document.createElement("span"); label.textContent = name; const value = document.createElement("b"); value.textContent = `${(result.probabilities[name]*100).toFixed(1)}%`; row.append(label,value); return row; }));
    $("jevStatus").textContent = `${result.emotion} を選びました。`;
    $("jevStatus").dataset.state = "success";
    faceAnimationStudio.followPlayback();
    play(result.emotion);
  } catch (error) {
    $("jevStatus").textContent = error instanceof Error ? error.message : "Jevの判定に失敗しました。";
    $("jevStatus").dataset.state = "error";
  } finally { button.disabled = false; }
});

const stackchanScene = createStackchanScene($("sceneCanvas"), $("sceneLoading"));
const faceAnimationStudio = createFaceAnimationStudio({
  timelines:TIMELINES, loops:LOOPS, getBasePreset:baseFacePreset,
  getMotionSteps:stepsFor,getMotionLimits:()=>limits,getMotionRates:(name)=>RATE[name],onMotionPersist:saveMotions,
  onPlaybackChange:(name,playback)=>{playback==="loop"?LOOPS.add(name):LOOPS.delete(name);},
  onChange:() => { displayedFace=renderFace(faceType); },
  onReplay:() => { play(currentEmotion); },
});
const audioStudio=createStackchanAudioStudio({
  root:$("audioStudio"), getTimelineSteps:stepsFor,
  getTimelineDuration:(name)=>stepsFor(name).reduce((sum,part)=>sum+part.ms,0),
  onBgmEnd:(name)=>{
    if (name===currentEmotion && !LOOPS.has(name)) {
      finished=true; $("motionStatus").textContent="BGM終了 · 表情を保持";
    }
  },
});
let lastMeasuredPose=null,observedYawPeak=0,observedPitchPeak=0;
const liveSerial=createLiveSerial(()=>({
  yaw:Math.round(yaw*10),pitch:Math.round(pitch*10),mouthOpen:speaking?mouthOpen:0,
  face:faceAnimationStudio.presetAt(currentEmotion,episodeMs,audioStudio.isBgmPlaying()),
}),(profile)=>{
  const bounds=[profile.yawMinTenths,profile.yawMaxTenths,profile.pitchMinTenths,profile.pitchMaxTenths];
  if(bounds.every(Number.isFinite)&&bounds[0]<bounds[1]&&bounds[2]<bounds[3]) {
    limits={yaw:{minDeg:bounds[0]/10,maxDeg:bounds[1]/10},pitch:{minDeg:bounds[2]/10,maxDeg:bounds[3]/10},measured:true};
    $("rangeReadout").textContent=`実機安全範囲　左右 ${limits.yaw.minDeg.toFixed(1)}° ～ ${limits.yaw.maxDeg.toFixed(1)}°　／　上下 ${limits.pitch.minDeg.toFixed(1)}° ～ ${limits.pitch.maxDeg.toFixed(1)}°`;
    $("profileState").textContent="実機の可動範囲";
    $("profileState").classList.add("measured");
  }
  if(profile.ratesDps && EMOTION_ORDER.every((name)=>Number.isFinite(profile.ratesDps[name]?.yaw)&&Number.isFinite(profile.ratesDps[name]?.pitch)))
    commandRates=Object.fromEntries(EMOTION_ORDER.map((name)=>[name,[profile.ratesDps[name].yaw,profile.ratesDps[name].pitch]]));
  const now=performance.now();
  if(profile.poseValid===true&&Number.isFinite(profile.yawTenths)&&Number.isFinite(profile.pitchTenths)) {
    if(lastMeasuredPose) {
      const seconds=(now-lastMeasuredPose.at)/1000;
      if(seconds>0.2&&seconds<3) {
        observedYawPeak=Math.max(observedYawPeak,Math.abs(profile.yawTenths-lastMeasuredPose.yaw)/10/seconds);
        observedPitchPeak=Math.max(observedPitchPeak,Math.abs(profile.pitchTenths-lastMeasuredPose.pitch)/10/seconds);
      }
    }
    lastMeasuredPose={at:now,yaw:profile.yawTenths,pitch:profile.pitchTenths};
  }
  const rate=RATE[currentEmotion],command=commandRates?.[currentEmotion];
  $("motorEvidence").textContent=`実機の指令上限 ${currentEmotion}: 左右 ${command?.[0]??"未取得"}°/秒・上下 ${command?.[1]??"未取得"}°/秒。到達時間の設計目安: 左右 ${rate[0]}°/秒・上下 ${rate[1]}°/秒。観測した最大移動速度: 左右 ${observedYawPeak.toFixed(1)}°/秒・上下 ${observedPitchPeak.toFixed(1)}°/秒（今回の動作中の値）。設計目安は物理的な最高速度の保証ではありません。`;
  faceAnimationStudio.refreshTimeline();
});
updateLimits();
requestAnimationFrame(paint);
