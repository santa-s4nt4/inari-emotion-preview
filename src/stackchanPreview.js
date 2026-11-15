// Browser preview of firmware/src/stack-chan/inari_emote_policy.cpp.
// This is a visual simulator; feedback is idealized and no device is controlled.
import { DEVICE_EMOTION_ORDER, EXTRA_DEVICE_LABELS, EMOTION_ORDER, getEmotion, resolveEmotion } from "./emotionCatalog.js";
import { clamp, containsPose, DEFAULT_START_POSE, isTenthDegree, K151_REFERENCE_LIMITS, motionTarget, profileLimits } from "./stackchanMotionMath.js";
import { motionDraft, motionDraftFilename, motionStepFromJson, FACE_TYPES, STEP_MIN_MS, STEP_MAX_MS, MAX_STEPS } from "./stackchanMotionDraft.js";
import { baseFacePreset, baseFaceDesign, baseFaceBitmaps, loadBaseFaceDesign } from "./stackchanFaceLibrary.js";
import { FACE_WIDTH, FACE_HEIGHT, validateFaceDesign, drawFace, drawEnvironmentMark, packFacePixels, paintPackedFace, drawFoxWhiskers, drawThinkingSpinner, thinkingSpinnerPhase, faceEffectPhase } from "./stackchanFaceData.js";
import { createFaceAnimationStudio } from "./stackchanFaceAnimationStudio.js";
import { createStackchanScene } from "./stackchanScene.js";
import { createLiveSerial } from "./stackchanLiveSerial.js?v=4";
import { createStackchanAudioStudio } from "./stackchanAudioStudio.js?v=2";
import { alignTracks, fitMotion } from "./stackchanUnifiedTimeline.js";
import { defaultFaceAnimationDesign, upgradeFaceAnimationDesign } from "./stackchanFaceAnimationData.js";
import { TIMELINES, EMOTION_LOOPS, PLANNING_RATES_DPS, REVISED_ENVIRONMENT_EMOTES } from "./stackchanEmotionDesign.js";
import { announcementIntroTiming, createPreparedAnnouncementAudio, createAnnouncementPhotoPreview,
  drawAnnouncementPhoto, debugDeerTrigger, announcementFrontPoseReady, announcementDeviceProgress } from "./stackchanAnnouncementPreview.js?v=4";

const $ = (id) => document.getElementById(id);
const labels = {...Object.fromEntries(EMOTION_ORDER.map((name) => [name, getEmotion(name).label])), ...EXTRA_DEVICE_LABELS};
export { TIMELINES };
const LOOPS = new Set(EMOTION_LOOPS);
const RATE = Object.fromEntries(DEVICE_EMOTION_ORDER.map((name)=>[name,[...PLANNING_RATES_DPS]]));
let commandRates = null;
let limits = K151_REFERENCE_LIMITS;
let referenceStart = {...DEFAULT_START_POSE};
let startPose = referenceStart;
let measuredProfile = false;
let playbackPlan = null;
const drafts = Object.fromEntries(DEVICE_EMOTION_ORDER.map((name) => [name, TIMELINES[name].map((part) => ({...part}))]));
const MOTION_STORE="inari-stackchan-unified-motion-v9";
try {
  const current=localStorage.getItem(MOTION_STORE);
  const hotRange=localStorage.getItem("inari-stackchan-unified-motion-v8");
  const previous=localStorage.getItem("inari-stackchan-unified-motion-v7");
  const saved=JSON.parse(current ?? hotRange ?? previous ?? localStorage.getItem("inari-stackchan-unified-motion-v6") ?? localStorage.getItem("inari-stackchan-unified-motion-v5"));
  if (current === null && saved) {
    for (const name of REVISED_ENVIRONMENT_EMOTES) delete saved[name];
  }
  if (current === null && hotRange === null && previous === null && saved) { delete saved.HOT; delete saved.COLD; }
  if (saved && Object.keys(saved).every((name)=>DEVICE_EMOTION_ORDER.includes(name) && Array.isArray(saved[name]) && saved[name].length>=1 && saved[name].length<=MAX_STEPS &&
      saved[name].every((part)=>Number.isInteger(part.ms)&&part.ms>=STEP_MIN_MS&&part.ms<=STEP_MAX_MS&&
        Number.isFinite(part.yaw)&&Number.isFinite(part.pitch)&&FACE_TYPES.includes(part.face))))
    for (const name of Object.keys(saved)) drafts[name]=saved[name];
  if (current === null && hotRange === null && previous !== null) {
    for (const step of drafts.HOT) step.pitch=clamp(step.pitch,(19-30)/4,(27-30)/4);
  }
} catch { /* Keep defaults. */ }
const saveMotions=()=>{try{localStorage.setItem(MOTION_STORE,JSON.stringify(drafts));}catch{ /* session remains editable */ }};
const stepsFor = (name) => drafts[name];
const motionPlan = (name) => fitMotion(stepsFor(name), RATE[name], limits, startPose, LOOPS.has(name));
const exportMotion = (name) => motionDraft(name, motionPlan(name).steps, LOOPS);

$("exportDraft").addEventListener("click", () => {
  try {
    const body = exportMotion(currentEmotion);
    downloadJson(motionDraftFilename(currentEmotion), body);
  } catch (error) {
    $("motionStatus").textContent = error.message;
  }
});

$("exportCurrentEmote").addEventListener("click", () => {
  try {
    const name = currentEmotion;
    downloadJson(`inari-stackchan-${name.toLowerCase()}-emote.json`, {
      format: "inari-stackchan-emote-v1",
      emotion: name,
      motion: exportMotion(name),
      faceAnimations: faceAnimationStudio.exportBitmaps([name]),
      faceAnimationDesign: faceAnimationStudio.design().emotions[name],
    });
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
  for(const name of DEVICE_EMOTION_ORDER) {
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
    motions: DEVICE_EMOTION_ORDER.map((name) => exportMotion(name)),
    audio: await audioStudio.exportConfig(),
  };
}
$("exportDesignBundle").addEventListener("click", async () => {
  try {
    const body = await designBundle();
    downloadJson("inari-stackchan-design-v2.json", body);
    $("faceStatus").textContent = "全感情の表情・首の動き・音設定をJSONに書き出しました。";
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
    if(bundle.format!=="inari-stackchan-design-v2" || !Array.isArray(bundle.motions) || ![DEVICE_EMOTION_ORDER.length, DEVICE_EMOTION_ORDER.length - 1, DEVICE_EMOTION_ORDER.length - Object.keys(EXTRA_DEVICE_LABELS).length].includes(bundle.motions.length))
      throw new RangeError("対応する形式の実機用JSONを選んでください。");
    const faceDesign=upgradeFaceAnimationDesign(bundle.faceAnimationDesign, defaultFaceAnimationDesign(TIMELINES, EMOTION_LOOPS, baseFacePreset));
    if(!faceDesign) throw new RangeError("顔アニメーションを読み込めません。");
    if (bundle.faceDesign && !validateFaceDesign(bundle.faceDesign))
      throw new RangeError("基本顔の編集設定を確認してください。");
    const imported={};
    for(const name of DEVICE_EMOTION_ORDER) {
      const motion=bundle.motions.find((item)=>item.emotion===name);
      const legacyBase = bundle.motions.length === DEVICE_EMOTION_ORDER.length - Object.keys(EXTRA_DEVICE_LABELS).length;
      const legacyWithoutThinking = bundle.motions.length === DEVICE_EMOTION_ORDER.length - 1;
      if (!motion && ((legacyBase && Object.hasOwn(EXTRA_DEVICE_LABELS, name)) ||
          (legacyWithoutThinking && name === "THINKING"))) {
        imported[name] = TIMELINES[name].map((part) => ({...part}));
        continue;
      }
      if(!motion || motion.format!=="inari-stackchan-motion-v1" || !Array.isArray(motion.steps) ||
          motion.steps.length<1 || motion.steps.length>24 || !["loop","once"].includes(motion.playback))
        throw new RangeError(`${name} の首と顔の設定を確認してください。`);
      faceDesign.emotions[name].playback=motion.playback;
      imported[name]=motion.steps.map(motionStepFromJson);
      alignTracks(faceDesign.emotions[name].frames,imported[name]);
    }
    for(const name of DEVICE_EMOTION_ORDER) drafts[name]=imported[name];
    try {
      await audioStudio.importConfig(bundle.audio ?? {
        format:"inari-stackchan-audio-v1",
        emotions:Object.fromEntries(DEVICE_EMOTION_ORDER.map((name)=>[name,{mode:"none"}])),
        assets:[],
      });
    } catch(error) {
      for(const name of DEVICE_EMOTION_ORDER) drafts[name]=previous[name];
      throw error;
    }
    for(const name of DEVICE_EMOTION_ORDER) faceDesign.emotions[name].playback==="loop"?LOOPS.add(name):LOOPS.delete(name);
    if (bundle.faceDesign) loadBaseFaceDesign(bundle.faceDesign);
    faceAnimationStudio.importDesign(faceDesign);
    saveMotions();
    $("faceStatus").textContent="全感情の表情・首の動き・音設定を読み込みました。";
  } catch(error) {$("faceStatus").textContent=error instanceof Error?error.message:"JSONを読み込めませんでした。";}
  finally {event.target.value="";}
});
$("uploadAll").addEventListener("click",async()=>{
  const button=$("uploadAll"); button.disabled=true;
  $("faceStatus").textContent="全感情のデータを検証し、実機へ書き込み中…";
  try {
    const body=await designBundle();
    await liveSerial.prepareUpload();
    const response=await fetch("/api/inari/deploy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error||"書き込みに失敗しました。");
    $("faceStatus").textContent=result.message||"全感情のデータを実機へ書き込みました。";
  } catch(error) {$("faceStatus").textContent=error instanceof Error?error.message:"書き込みに失敗しました。";}
  finally {liveSerial.finishUpload();button.disabled=false;}
});

const profileForm = $("profileForm");

function updateProfileControls() {
  for (const axis of ["yaw", "pitch"]) {
    const input = profileForm.elements.namedItem(axis);
    input.min = String(limits[axis].minDeg);
    input.max = String(limits[axis].maxDeg);
    input.value = String(startPose[axis]);
  }
  const format = (axis) => `${limits[axis].minDeg.toFixed(1)}° ～ ${limits[axis].maxDeg.toFixed(1)}°`;
  $("rangeReadout").textContent = `機体の目標範囲　左右 ${format("yaw")} ／ 上下 ${format("pitch")}`;
  $("originReadout").textContent = `開始姿勢　左右 ${startPose.yaw.toFixed(1)}° ／ 上下 ${startPose.pitch.toFixed(1)}°`;
  $("profileState").textContent = measuredProfile ? "USBで取得した目標範囲" : "K151デモ機の参考範囲";
  $("profileState").classList.toggle("measured",measuredProfile);
}

profileForm.addEventListener("submit",(event) => {
  event.preventDefault();
  if (liveSerial.isActive()) {
    $("profileError").textContent = "開始姿勢を変更するには、実機プレビューを終了してください。";
    return;
  }
  const read = (axis) => profileForm.elements.namedItem(axis).valueAsNumber;
  const pose = {yaw:read("yaw"),pitch:read("pitch")};
  if (!containsPose(limits,pose)) {
    $("profileError").textContent = "表示中の目標範囲内で、0.1°刻みの開始姿勢を入力してください。";
    return;
  }
  startPose = pose;
  if (!measuredProfile) referenceStart = pose;
  $("profileError").textContent = "";
  updateProfileControls();
  play(currentEmotion);
});

const speakingCanvas=document.createElement("canvas"); speakingCanvas.width=FACE_WIDTH; speakingCanvas.height=FACE_HEIGHT;
const speakingCtx=speakingCanvas.getContext("2d",{willReadFrequently:true});
let speaking=false, mouthOpen=0, lastMouthAt=-1000;
let deerPhotoCanvas = null;
function faceCanvas() { return deerPhotoCanvas ?? (speaking ? speakingCanvas : faceAnimationStudio.canvasAt(currentEmotion,previewFaceTime(),!deerPhase && audioStudio.isBgmPlaying())); }
function updateSpeech(now) {
  if (!speaking || now-lastMouthAt<150) return false;
  lastMouthAt=now;
  mouthOpen=[25,75,45,95,0,65][Math.floor(now/150)%6];
  drawFace(speakingCtx,faceAnimationStudio.presetAt(currentEmotion,episodeMs,audioStudio.isBgmPlaying()),mouthOpen);
  if (currentEmotion !== "THINKING" && currentEmotion !== "REST") drawEnvironmentMark(speakingCtx,currentEmotion,
    faceAnimationStudio.frameIndexAt(currentEmotion,episodeMs,audioStudio.isBgmPlaying()));
  const pixels=packFacePixels(speakingCtx.getImageData(0,0,FACE_WIDTH,FACE_HEIGHT).data);
  paintPackedFace(speakingCtx,pixels);
  drawFoxWhiskers(speakingCtx);
  if (currentEmotion==="THINKING") drawThinkingSpinner(speakingCtx,thinkingSpinnerPhase(episodeMs));
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
let deerPhase = null;
let deerOrigin = null;
let deerTrigger = null;
const deerSpeech = createPreparedAnnouncementAudio();
const deerPhoto = createAnnouncementPhotoPreview();
function deerIntroTiming() {
  return announcementIntroTiming(stepsFor("ALERT"),faceAnimationStudio.design().emotions.ALERT.frames,episodeMs);
}
function previewFaceTime() {
  return currentEmotion === "ALERT" && ["alert", "hold", "speech-starting"].includes(deerPhase)
    ? deerIntroTiming().faceElapsedMs : episodeMs;
}
function resetDeerMouth() {
  speaking = false;
  mouthOpen = 0;
  lastMouthAt = -1000;
  $("speakToggle").setAttribute("aria-pressed", "false");
  $("speakToggle").textContent = "口パク";
}
function clearDeerPhoto() {
  deerPhoto.clear();
  deerPhotoCanvas = null;
  $("faceSelectionOverlay").style.visibility = "";
  document.querySelector(".face-safe-guide").style.visibility = "";
  displayedFace = null;
}
function clearDeerSpeech() { deerSpeech.clear(); clearDeerPhoto(); resetDeerMouth(); }
function showDeerPhoto() {
  clearDeerSpeech();
  finished = true; deerPhase = "photo-loading";
  $("deerStatus").textContent = "読み上げが終わり、検知画像を準備しています。";
  deerPhoto.show(deerTrigger, {
    onShown(image) {
      const photoCanvas = document.createElement("canvas");
      drawAnnouncementPhoto(image, photoCanvas, $("faceAnimationPreview"));
      deerPhotoCanvas = photoCanvas; deerPhase = "photo";
      $("faceSelectionOverlay").style.visibility = "hidden";
      document.querySelector(".face-safe-guide").style.visibility = "hidden";
      displayedFace = renderFace(faceType);
      $("motionStatus").textContent = "検知画像 · 30秒表示";
      $("deerStatus").textContent = "検知画像を表示しています。30秒後に待機へ戻ります。";
    },
    onFinished() {
      play("NEUTRAL");
      $("deerStatus").textContent = "画像表示が終わり、待機へ戻りました。";
    },
    onError() {
      play("NEUTRAL");
      $("deerStatus").textContent = "検知画像を表示できませんでした。待機へ戻りました。";
    },
  });
}
function speakDeerPreview() {
  const finish = (message) => {
    clearDeerSpeech();
    finished = true;
    $("deerStatus").textContent = message;
    $("motionStatus").textContent = `${currentEmotion} · 表情を保持`;
  };
  deerPhase = "speech-starting";
  deerSpeech.play({
    onStarted() {
      play("CONCERN", {deer: "concern"});
      speaking = true;
      $("motionStatus").textContent = "CONCERN · 読み上げ";
      $("deerStatus").textContent = "準備済みの音声を読み上げています。";
    },
    onEnded: showDeerPhoto,
    onError: () => finish("読み上げ音声を再生できませんでした。"),
  });
}

function startStep() {
  const part = stepsFor(currentEmotion)[index];
  faceType = part.face;
  displayedFace = renderFace(faceType);
  $("stepReadout").textContent = `${String(index+1).padStart(2,"0")} / ${String(stepsFor(currentEmotion).length).padStart(2,"0")}`;
}
let replayRevision = 0;
function play(requestedName, options) {
  const revision = ++replayRevision;
  if (!liveSerial.hasNeckPreview()) {
    beginPlayback(requestedName,options);
    return;
  }
  liveSerial.readReplayProfile().then((profile) => {
    if (revision !== replayRevision || !liveSerial.hasNeckPreview()) return;
    useMeasuredStart(profile);
    beginPlayback(requestedName,{...options,fromUsb:true});
  }).catch((error) => {
    if (revision === replayRevision) $("motionStatus").textContent = error.message;
  });
}

function beginPlayback(requestedName, {deer = null, fromUsb = false} = {}) {
  const name = resolveEmotion(requestedName);
  if (!TIMELINES[name] || !limits) return;
  if (deerPhase && !deer) $("deerStatus").textContent = "知らせる → 心配の顔で読み上げ";
  if (!deer) {
    if (deerOrigin) {
      if (!fromUsb) startPose = containsPose(limits,deerOrigin) ? deerOrigin : startPose;
      deerOrigin = null;
      updateProfileControls();
    }
    clearDeerSpeech();
  }
  else resetDeerMouth();
  deerPhase = deer;
  $("speakToggle").disabled = Boolean(deer);
  currentEmotion = name;
  playbackPlan = motionPlan(name);
  index = cycle = episodeMs = 0;
  if (deer !== "concern") ({yaw,pitch} = startPose);
  neckActive = deer !== "concern"; paused = false; finished = false;
  $("pauseButton").textContent = "Ⅱ 一時停止";
  $("motionStatus").textContent = "再生中";
  $("currentEmotion").textContent = `${name} / ${labels[name]}`;
  document.querySelectorAll(".emotion-buttons button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.emotion === name)));
  faceAnimationStudio.setEmotion(name);
  audioStudio.setEmotion(name);
  if (deer === "concern") audioStudio.stop();
  else {
    audioStudio.play(name);
    audioStudio.onTime(name,0);
  }
  startStep();
}
function advance(dt) {
  if (paused) return;
  if (!finished && deerPhase !== "speech-starting") episodeMs += dt;
  const introActive = currentEmotion === "ALERT" && ["alert", "hold", "speech-starting"].includes(deerPhase);
  if (!deerPhase || introActive) audioStudio.onTime(currentEmotion,episodeMs);
  if (neckActive && episodeMs >= 30000 && !introActive) {
    neckActive=false;
    $("motionStatus").textContent="首は30秒で安全停止 · 最初から再生で再開";
  }
  const steps=stepsFor(currentEmotion), total=steps.reduce((sum,part)=>sum+part.ms,0);
  const intro = introActive ? deerIntroTiming() : null;
  if (deerPhase === "alert" && intro.ready) {
    deerPhase = "hold";
    $("motionStatus").textContent = "ALERT · 4コマ目を保持";
    $("deerStatus").textContent = "知らせるの音が終わるまで待っています。";
  }
  const looping=!introActive && (LOOPS.has(currentEmotion)||audioStudio.isBgmPlaying());
  if (!introActive && !finished && !looping && episodeMs>=total) {
    episodeMs=total;finished=true;$("motionStatus").textContent="再生終了 · 表情を保持";
  }
  const timelineTime=intro ? intro.motionElapsedMs : looping&&!finished?episodeMs%total:Math.min(episodeMs,total-1);
  const nextCycle=looping&&!finished?Math.floor(episodeMs/total):0;
  let offset=0,nextIndex=steps.length-1;
  for (let i=0;i<steps.length;i++) {offset+=steps[i].ms;if(timelineTime<offset){nextIndex=i;break;}}
  if (nextIndex!==index||nextCycle!==cycle){index=nextIndex;cycle=nextCycle;startStep();}
  const target = deerPhase === "concern" ? {yaw,pitch}
    : deerPhase === "centering" ? {
      yaw:clamp(0,limits.yaw.minDeg,limits.yaw.maxDeg),
      pitch:clamp(30,limits.pitch.minDeg,limits.pitch.maxDeg),
    } : neckActive && !finished ? motionTarget(playbackPlan.steps[index],startPose) : startPose;
  const {yaw:targetYaw,pitch:targetPitch} = target;
  const [yawRate,pitchRate]=RATE[currentEmotion];
  yaw+=clamp(targetYaw-yaw,-yawRate*dt/1500,yawRate*dt/1500);
  pitch+=clamp(targetPitch-pitch,-pitchRate*dt/1500,pitchRate*dt/1500);
  if (deerPhase === "centering" && announcementFrontPoseReady(yaw, pitch)) {
    faceAnimationStudio.followPlayback();
    setPreviewVisible(true);
    startPose = {yaw:0,pitch:30};
    updateProfileControls();
    play("ALERT", {deer: "alert"});
    $("deerStatus").textContent = "首が正面へ戻り、知らせるの動きと音を再生しています。";
  }
  if (deerPhase === "hold" && !audioStudio.isIntroSoundPending() &&
      Math.abs(yaw - targetYaw) < 0.01 && Math.abs(pitch - targetPitch) < 0.01) {
    speakDeerPreview();
  }
}

function paint(now) {
  const dt = Math.min(100, Math.max(0, now-lastFrame || 0)); lastFrame = now;
  if (!limits) { requestAnimationFrame(paint); return; }
  advance(dt);
  const speechChanged=updateSpeech(now);
  const visibleCanvas=faceCanvas(faceType);
  if (visibleCanvas !== displayedFace || speechChanged) displayedFace=renderFace(faceType);
  if (!deerPhotoCanvas) faceAnimationStudio.updatePreview(currentEmotion,previewFaceTime(),!deerPhase && audioStudio.isBgmPlaying());
  // The physical axes rotate the head; the camera angle is independent.
  stackchanScene.setPose(yaw,pitch);
  liveSerial.tick(now);
  $("yawReadout").textContent = `${yaw.toFixed(1)}°`;
  $("pitchReadout").textContent = `${pitch.toFixed(1)}°`;
  requestAnimationFrame(paint);
}

for (const name of Object.keys(labels)) {
  const button = document.createElement("button");
  button.type = "button"; button.dataset.emotion = name;
  button.innerHTML = `${name}<small>${labels[name]}</small>`;
  button.addEventListener("click", () => { faceAnimationStudio.followPlayback(); play(name); });
  $("emotionButtons").append(button);
}
$("deerPreview").addEventListener("click", async () => {
  if (!containsPose(limits,DEFAULT_START_POSE)) {
    $("deerStatus").textContent = "正面の姿勢が実機の目標範囲外です。";
    return;
  }
  const button = $("deerPreview");
  clearDeerSpeech();
  audioStudio.stop();
  deerOrigin ??= startPose;
  deerPhase = "preparing"; finished = true; paused = false; button.disabled = true;
  $("deerStatus").textContent = "読み上げ音声を準備しています。準備後にALERTを始めます。";
  try {
    await liveSerial.stopForAnnouncement();
    deerTrigger = debugDeerTrigger();
    await deerSpeech.prepare(deerTrigger);
    if (deerPhase !== "preparing") return;
    deerPhase = "centering";
    $("deerStatus").textContent = "音声の準備が完了し、首を正面へ向けています。";
  } catch (error) {
    if (deerPhase === "preparing") {
      deerPhase = null;
      $("speakToggle").disabled = false;
      $("deerStatus").textContent = error.name === "AbortError" ? "音声の準備を中止しました。" : error.message;
    }
  } finally { button.disabled = false; }
});
$("deerDevice").addEventListener("click", async () => {
  const button = $("deerDevice");
  const status = $("deerDeviceStatus");
  button.disabled = true;
  status.textContent = "実機へ鹿の検知テストを送信中…";
  try {
    await liveSerial.stopForAnnouncement();
    clearDeerSpeech(); audioStudio.stop();
    deerPhase = null; finished = true; paused = false;
    const route = "/api/inari/debug/deer";
    const trigger = debugDeerTrigger();
    const response = await fetch(route, {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(trigger),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    status.textContent = announcementDeviceProgress(result.status);
    const expires = performance.now() + 2100000;
    while (performance.now() < expires) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const reply = await fetch(`${route}/${encodeURIComponent(result.announcementId)}`, {
        signal: AbortSignal.timeout(8000),
      });
      const outcome = await reply.json();
      if (!reply.ok) throw new Error(outcome.error);
      if (["queued", "pending", "started"].includes(outcome.status)) {
        status.textContent = announcementDeviceProgress(outcome.status);
        continue;
      }
      const reasons = {
        busy: "実機が動作中でした",
        stale: "通知の有効期限が切れました",
        tts_failed: "読み上げに失敗しました",
        motion_failed: "首の動きが完了しませんでした",
        connection_lost: "実機との接続が切れました",
        user_stopped: "本体で停止されました",
        superseded: "別の通知に切り替わりました",
        delivery_unknown: "送信結果を確認できませんでした。実機を確認してください",
      };
      status.textContent = outcome.status === "completed" && !outcome.reason
        ? "実機で知らせる → 心配の読み上げが完了しました。"
        : `実機での再生が完了しませんでした · ${reasons[outcome.reason] ?? "本体の状態を確認してください"}`;
      return;
    }
    status.textContent = "実機から完了応答がありませんでした。本体の状態を確認してください。";
  } catch (error) {
    status.textContent = error.name === "TimeoutError"
      ? "応答が時間切れになりました。実機の状態を確認してください。" : error.message;
  } finally {
    button.disabled = false;
  }
});
$("replayButton").addEventListener("click", () => {
  if (deerPhase) $("deerPreview").click();
  else { faceAnimationStudio.followPlayback(); play(currentEmotion); }
});
$("pauseButton").addEventListener("click", () => {
  paused = !paused;
  if (deerPhase === "concern") {
    if (paused) deerSpeech.pause();
    else deerSpeech.resume();
    speaking = !paused;
  }
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
  getMotionSteps:stepsFor, getMotionPlan:motionPlan, onMotionPersist:saveMotions,
  onPlaybackChange:(name,playback)=>{playback==="loop"?LOOPS.add(name):LOOPS.delete(name);},
  onChange:() => {
    playbackPlan = motionPlan(currentEmotion);
    displayedFace=renderFace(faceType);
  },
  onReplay:() => { play(currentEmotion); },
});
const audioStudio=createStackchanAudioStudio({
  root:$("audioStudio"), getTimelineSteps:stepsFor,
  getTimelineDuration:(name)=>stepsFor(name).reduce((sum,part)=>sum+part.ms,0),
  onBgmEnd:(name)=>{
    if (!deerPhase && name===currentEmotion && !LOOPS.has(name)) {
      finished=true; $("motionStatus").textContent="BGM終了 · 表情を保持";
    }
  },
});
let lastMeasuredPose=null,observedYawPeak=0,observedPitchPeak=0;
const liveSerial=createLiveSerial((supportsMarks,supportsFoxFace)=>{
  const loop=audioStudio.isBgmPlaying();
  const face=faceAnimationStudio.presetAt(currentEmotion,episodeMs,loop);
  const frame=faceAnimationStudio.frameIndexAt(currentEmotion,episodeMs,loop);
  if (!supportsFoxFace && face.eyeMode==="fox") face.eyeMode="ellipse";
  const thinking=currentEmotion==="THINKING";
  const phase=faceEffectPhase(currentEmotion,frame,faceAnimationStudio.isOverriding() ? undefined : episodeMs);
  return {
    yaw:Math.round(yaw*10),pitch:Math.round(pitch*10),mouthOpen:speaking?mouthOpen:0,face,
    spinner:thinking && supportsFoxFace ? phase : undefined,
    mark:supportsMarks && !(thinking && supportsFoxFace) && !(speaking && currentEmotion==="REST")
      ? faceAnimationStudio.markAt(currentEmotion,frame,phase) : undefined,
  };
},(profile)=>{
  const reported = profileLimits(profile);
  if (reported && (!measuredProfile || JSON.stringify(reported) !== JSON.stringify(limits))) {
    if (liveSerial.hasNeckPreview()) {
      void liveSerial.stopForProfileChange();
    }
    limits = reported;
    if (!measuredProfile || !containsPose(limits,startPose)) {
      const pose = measuredPose(profile);
      startPose = pose && containsPose(limits,pose) ? pose : {
        yaw:clamp(DEFAULT_START_POSE.yaw,limits.yaw.minDeg,limits.yaw.maxDeg),
        pitch:clamp(DEFAULT_START_POSE.pitch,limits.pitch.minDeg,limits.pitch.maxDeg),
      };
    }
    measuredProfile = true;
    yaw = clamp(yaw,limits.yaw.minDeg,limits.yaw.maxDeg);
    pitch = clamp(pitch,limits.pitch.minDeg,limits.pitch.maxDeg);
    updateProfileControls();
    playbackPlan = motionPlan(currentEmotion);
    faceAnimationStudio.refreshTimeline();
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
  const measured=profile.poseValid===true&&Number.isFinite(profile.yawTenths)&&Number.isFinite(profile.pitchTenths)
    ? `現在の実測角: 左右 ${(profile.yawTenths/10).toFixed(1)}°・上下 ${(profile.pitchTenths/10).toFixed(1)}°。` : "";
  $("motorEvidence").textContent=`${measured}実機の指令上限 ${currentEmotion}: 左右 ${command?.[0]??"未取得"}°/秒・上下 ${command?.[1]??"未取得"}°/秒。到達時間の設計目安: 左右 ${rate[0]}°/秒・上下 ${rate[1]}°/秒。観測した最大移動速度: 左右 ${observedYawPeak.toFixed(1)}°/秒・上下 ${observedPitchPeak.toFixed(1)}°/秒（今回の動作中の値）。設計目安は物理的な最高速度の保証ではありません。`;
},(profile, neckReady)=>{
  if (neckReady) useMeasuredStart(profile);
  faceAnimationStudio.followPlayback();
  beginPlayback(currentEmotion,{fromUsb:neckReady});
},()=>{
  if (!measuredProfile) return;
  limits = K151_REFERENCE_LIMITS;
  startPose = referenceStart;
  measuredProfile = false;
  commandRates = null;
  lastMeasuredPose = null;
  observedYawPeak = observedPitchPeak = 0;
  $("motorEvidence").textContent = "実機未接続。到達時間は設計上の見積もりです。";
  updateProfileControls();
  play(currentEmotion);
});
function useMeasuredStart(profile) {
  const reported = profileLimits(profile);
  const pose = measuredPose(profile);
  if (!reported || !pose || !containsPose(reported,pose)) {
    throw new RangeError("開始姿勢を実機の目標範囲内で確認できません。");
  }
  limits = reported;
  measuredProfile = true;
  startPose = pose;
  $("profileError").textContent = "";
  updateProfileControls();
}
function measuredPose(profile) {
  return profile?.poseValid === true && Number.isInteger(profile.yawTenths) && Number.isInteger(profile.pitchTenths)
    ? {yaw:profile.yawTenths / 10,pitch:profile.pitchTenths / 10} : null;
}
updateProfileControls();
play(currentEmotion);
requestAnimationFrame(paint);
