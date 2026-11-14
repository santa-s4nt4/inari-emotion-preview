import { REVISED_ENVIRONMENT_EMOTES, CONCERN_FOX_EYES, CONCERN_BLINK_SPLITS } from "./stackchanEmotionDesign.js";
import { DEVICE_EMOTION_ORDER as EMOTION_ORDER } from "./emotionCatalog.js";
import { FACE_TYPES } from "./stackchanMotionDraft.js";
import { FACE_FIELDS } from "./stackchanFaceStudio.js";
import { FACE_WIDTH, FACE_HEIGHT, FACE_ENCODING, drawFace, packFacePixels, paintPackedFace, encodeBase64, validatePreset, drawEnvironmentMark, encodeEnvironmentMark, drawFoxWhiskers, drawThinkingSpinner, drawRestBubble, faceEffectPhase } from "./stackchanFaceData.js";
import { FACE_ANIMATION_FORMAT, MAX_FACE_ANIMATION_FRAMES,
  MIN_FACE_FRAME_MS, MAX_FACE_FRAME_MS, defaultFaceAnimationDesign, validateFaceAnimationDesign, upgradeFaceAnimationDesign, faceFrameAt } from "./stackchanFaceAnimationData.js";
import { alignTracks, motorFeasibility } from "./stackchanUnifiedTimeline.js";

const STORAGE_KEY = "inari-stackchan-face-animation-design-v11";
const PREVIOUS_CONCERN_STORAGE_KEY = "inari-stackchan-face-animation-design-v10";
const PREVIOUS_THINKING_STORAGE_KEY = "inari-stackchan-face-animation-design-v9";
const COLD_MOUTH_STORAGE_KEY = "inari-stackchan-face-animation-design-v8";
const TEMPERATURE_STORAGE_KEY = "inari-stackchan-face-animation-design-v7";
const ROUND_EYES_STORAGE_KEY = "inari-stackchan-face-animation-design-v6";
const PREVIOUS_STORAGE_KEY = "inari-stackchan-face-animation-design-v5";
const LEGACY_STORAGE_KEY = "inari-stackchan-face-animation-design-v4";
const $ = (id) => document.getElementById(id);
const option = (value, label=value) => { const node=document.createElement("option"); node.value=value; node.textContent=label; return node; };

function loadDesign(defaults) {
  try {
    const latest = localStorage.getItem(STORAGE_KEY);
    const current = latest ?? localStorage.getItem(PREVIOUS_CONCERN_STORAGE_KEY);
    const previousThinking = localStorage.getItem(PREVIOUS_THINKING_STORAGE_KEY);
    const coldMouth = localStorage.getItem(COLD_MOUTH_STORAGE_KEY);
    const temperature = localStorage.getItem(TEMPERATURE_STORAGE_KEY);
    const roundEyes = localStorage.getItem(ROUND_EYES_STORAGE_KEY);
    const previous = localStorage.getItem(PREVIOUS_STORAGE_KEY);
    const saved = JSON.parse(current ?? previousThinking ?? coldMouth ?? temperature ?? roundEyes ?? previous ?? localStorage.getItem(LEGACY_STORAGE_KEY));
    if (current === null && saved?.emotions?.THINKING) {
      for (const {preset} of saved.emotions.THINKING.frames) {
        if (preset.eyeMode === "dot") Object.assign(preset,{eyeMode:"fox",eyeWidth:32,eyeHeight:12});
        preset.browSide = "none";
      }
    }
    if (current === null && previousThinking === null && saved?.emotions) {
      for (const name of REVISED_ENVIRONMENT_EMOTES) delete saved.emotions[name];
    }
    if (current === null && previousThinking === null && coldMouth === null && temperature === null && saved?.emotions) {
      delete saved.emotions.HOT;
      delete saved.emotions.COLD;
    }
    const upgraded=upgradeFaceAnimationDesign(saved, defaults);
    if (upgraded && current === null && previousThinking === null && coldMouth === null && temperature !== null) {
      for (const {preset} of upgraded.emotions.COLD.frames) {
        const oldCenter = (preset.mouthOffsetX === -2 && [149,151].includes(preset.mouthY)) ||
          (preset.mouthOffsetX === 2 && [155,156].includes(preset.mouthY));
        if (oldCenter) {
          preset.mouthOffsetX = 0;
          preset.mouthY = 150;
        }
      }
    }
    if (upgraded && current === null && previousThinking === null && coldMouth === null && temperature === null && roundEyes === null) {
      for (const name of ["ALERT","CELEBRATE"]) {
        for (const {preset} of upgraded.emotions[name].frames) {
          if (preset.eyeMode === "ellipse") {
            preset.eyeRadius = Math.max(4,Math.min(18,Math.round(Math.sqrt(preset.eyeWidth * preset.eyeHeight) / 2)));
          } else if (preset.eyeMode !== "wide") continue;
          preset.eyeMode = "dot";
        }
      }
    }
    if (upgraded && latest === null && saved?.emotions?.CONCERN) {
      const concern = upgraded.emotions.CONCERN;
      const oldDurations = [500,1300,500,140,1600,400,1200,1000,460];
      const originalTiming = concern.frames.length === oldDurations.length &&
        concern.frames.every((frame,index) => frame.durationMs === oldDurations[index]);
      concern.frames = concern.frames.flatMap(({durationMs,preset},index) => {
        const updated = ["dot","ellipse","wide"].includes(preset.eyeMode)
          ? {...preset,...CONCERN_FOX_EYES} : preset;
        const split = originalTiming && CONCERN_BLINK_SPLITS[index];
        return split ? split.map(([ms,blink]) => ({
          durationMs:ms, preset:{...updated, eyeMode:blink ? "closed" : updated.eyeMode},
        })) : [{durationMs,preset:updated}];
      });
    }
    if (upgraded) return upgraded;
  } catch { /* Use the original INARI sequence. */ }
  return defaults;
}

export function createFaceAnimationStudio({timelines,loops,getBasePreset,onChange,onReplay,getMotionSteps,getMotionLimits,getMotionRates,onMotionPersist=()=>{},onPlaybackChange=()=>{}}) {
  const defaults = () => defaultFaceAnimationDesign(timelines,loops,getBasePreset);
  let design = loadDesign(defaults());
  let emotion = "NEUTRAL";
  let selected = 0;
  let override = null;
  let selectedPart="leftEye";
  let shownFrame = null, shownPhase = null;
  let lastStatus = "";
  const currentSnapshot=()=>JSON.stringify({design,motions:Object.fromEntries(EMOTION_ORDER.map((name)=>[name,getMotionSteps(name)]))});
  let snapshot=currentSnapshot();
  const undoStack=[], redoStack=[];
  const cache = new WeakMap();
  const markCanvas = document.createElement("canvas");
  markCanvas.width = FACE_WIDTH; markCanvas.height = FACE_HEIGHT;
  const markContext = markCanvas.getContext("2d",{willReadFrequently:true});
  const marks = new Map();
  const recovered=[];
  function alignEmotion(name) {
    const frames=design.emotions[name].frames,steps=getMotionSteps(name);
    try {
      const tracks=alignTracks(frames,steps);
      design.emotions[name].frames=tracks.map((track)=>track.frame);
      steps.splice(0,Infinity,...tracks.map((track)=>track.step));
    } catch(error) {
      // An old local draft can have more than sixteen combined boundaries.
      // Keep every neck step and sample its face at the same start time.
      // The original design remains in storage until the user edits or imports.
      let time=0;
      design.emotions[name].frames=steps.map((step)=>{
        let offset=0,active=frames.at(-1);
        for(const frame of frames){offset+=frame.durationMs;if(time<offset){active=frame;break;}}
        time+=step.ms;
        return {durationMs:step.ms,preset:{...active.preset}};
      });
      recovered.push(name);
    }
  }
  for (const name of EMOTION_ORDER) alignEmotion(name);
  snapshot=currentSnapshot();
  const preview = $("faceAnimationPreview");
  const previewCtx = preview.getContext("2d");
  const overlay=$("faceSelectionOverlay"), overlayCtx=overlay.getContext("2d");
  const partFields={
    leftEye:["eyeMode","eyeRadius","eyeWidth","eyeHeight","eyeY","leftEyeOffsetY","eyeSpacing","gazeX"],
    bothEyes:["eyeMode","eyeRadius","eyeWidth","eyeHeight","eyeY","eyeSpacing","gazeX"],
    rightEye:["eyeMode","eyeRadius","eyeWidth","eyeHeight","eyeY","rightEyeOffsetY","eyeSpacing","gazeX"],
    leftBrow:["browY","browLeftX","browWidth","browThickness","browLeftTilt"],
    rightBrow:["browY","browRightX","browWidth","browThickness","browRightTilt"],
    mouth:["mouthMode","mouthWidth","mouthHeight","mouthY","mouthOffsetX"],
    sweat:["sweat","sweatOffsetX","sweatOffsetY","sweatSize"],
  };

  function animation(name=emotion) { return design.emotions[name]; }
  function selectedFrame() { return animation().frames[selected]; }
  function updateHistoryButtons() {$("faceUndo").disabled=!undoStack.length;$("faceRedo").disabled=!redoStack.length;}
  function persist(record=true) {
    $("faceAnimationFeedback").textContent="";
    const next=currentSnapshot();
    if (next!==snapshot) {
      if (record) {undoStack.push(snapshot); if (undoStack.length>80) undoStack.shift();redoStack.length=0;}
      snapshot=next;
    }
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(design)); } catch { /* Current editing session still works. */ }
    onMotionPersist();
    updateHistoryButtons();
  }
  function restoreHistory(source,target) {
    if (!source.length) return;
    target.push(snapshot);
    snapshot=source.pop();
    const state=JSON.parse(snapshot); design=state.design;
    for (const name of EMOTION_ORDER) getMotionSteps(name).splice(0,Infinity,...state.motions[name]);
    selected=Math.min(selected,animation().frames.length-1);
    override=selected; shownFrame=null;
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify(design));} catch { /* Current editing session still works. */ }
    onMotionPersist();
    renderRows(); renderControls(); $("faceAnimationPlayback").value=animation().playback;
    showFrame(selectedFrame()); status(); onChange();
    updateHistoryButtons();
  }
  function frameImage(frame, name, index) {
    const cached = cache.get(frame);
    if (cached?.index === index) return cached;
    const canvas = document.createElement("canvas");
    canvas.width=FACE_WIDTH; canvas.height=FACE_HEIGHT;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    drawFace(ctx,frame.preset);
    const usesLiveEffect = name === "THINKING" || name === "REST";
    const base = usesLiveEffect ? packFacePixels(ctx.getImageData(0,0,FACE_WIDTH,FACE_HEIGHT).data) : null;
    drawEnvironmentMark(ctx, name, index);
    const pixels=packFacePixels(ctx.getImageData(0,0,FACE_WIDTH,FACE_HEIGHT).data);
    paintPackedFace(ctx,base ?? pixels);
    drawFoxWhiskers(ctx);
    const image={canvas,pixels,index,previews:new Map()}; cache.set(frame,image); return image;
  }
  function displayFrame(frame, name, index, phase = faceEffectPhase(name,index)) {
    const image=frameImage(frame,name,index);
    if (name!=="THINKING" && name!=="REST") return image.canvas;
    if (!image.previews.has(phase)) {
      const canvas=document.createElement("canvas");
      canvas.width=FACE_WIDTH; canvas.height=FACE_HEIGHT;
      const ctx=canvas.getContext("2d");
      ctx.drawImage(image.canvas,0,0);
      if (name==="REST") drawRestBubble(ctx,phase);
      else drawThinkingSpinner(ctx,phase);
      image.previews.set(phase,canvas);
    }
    return image.previews.get(phase);
  }
  function partPosition(preset,part) {
    const leftX=160-preset.eyeSpacing/2+preset.gazeX;
    const rightX=160+preset.eyeSpacing/2+preset.gazeX;
    if (part==="leftEye") return [leftX,preset.eyeY+preset.leftEyeOffsetY];
    if (part==="bothEyes") return [160+preset.gazeX,preset.eyeY];
    if (part==="rightEye") return [rightX,preset.eyeY+preset.rightEyeOffsetY];
    if (part==="leftBrow") return [leftX+preset.browLeftX,preset.browY];
    if (part==="rightBrow") return [rightX+preset.browRightX,preset.browY];
    if (part==="mouth") return [160+preset.mouthOffsetX,preset.mouthY];
    return [(preset.sweat==="right"?rightX+44:leftX-44)+preset.sweatOffsetX,
      preset.eyeY+4+preset.sweatOffsetY];
  }
  function drawSelection() {
    overlayCtx.clearRect(0,0,FACE_WIDTH,FACE_HEIGHT);
    if (override===null) return;
    const [x,y]=partPosition(selectedFrame().preset,selectedPart);
    overlayCtx.strokeStyle="#bd4035"; overlayCtx.lineWidth=2;
    overlayCtx.setLineDash([5,4]);
    if (selectedPart==="bothEyes") overlayCtx.strokeRect(x-presetEyeSpan()/2-24,y-23,presetEyeSpan()+48,46);
    else overlayCtx.strokeRect(x-24,y-23,48,46);
    overlayCtx.setLineDash([]); overlayCtx.fillStyle="#bd4035";
    overlayCtx.fillRect(x+20,y+19,7,7);
  }
  function presetEyeSpan() { return selectedFrame().preset.eyeSpacing; }
  function selectPart(part) {
    selectedPart=part;
    for (const button of document.querySelectorAll("#facePartTools button[data-part]"))
      button.setAttribute("aria-pressed",String(button.dataset.part===part));
    renderControls(); drawSelection();
  }
  function replacePreset(preset,record=true) {
    if (!validatePreset(preset)) return false;
    animation().frames[selected]={...selectedFrame(),preset};
    override=selected; shownFrame=null; persist(record); showFrame(selectedFrame()); drawSelection(); status(); onChange();
    return true;
  }
  let dragging=null;
  overlay.addEventListener("pointerdown",(event)=>{
    const box=overlay.getBoundingClientRect();
    const x=Math.round((event.clientX-box.left)*FACE_WIDTH/box.width);
    const y=Math.round((event.clientY-box.top)*FACE_HEIGHT/box.height);
    const preset=selectedFrame().preset;
    const nearest=Object.keys(partFields).map((part)=>{
      const [px,py]=partPosition(preset,part); return {part,distance:Math.hypot(px-x,py-y)};
    }).sort((a,b)=>a.distance-b.distance)[0];
    if (nearest.distance<36) selectPart(nearest.part);
    if (override===null) override=selected;
    dragging={x,y,before:snapshot}; overlay.setPointerCapture(event.pointerId); drawSelection(); status();
  });
  overlay.addEventListener("pointermove",(event)=>{
    if (!dragging) return;
    const box=overlay.getBoundingClientRect();
    const x=Math.round((event.clientX-box.left)*FACE_WIDTH/box.width);
    const y=Math.round((event.clientY-box.top)*FACE_HEIGHT/box.height);
    const dx=x-dragging.x,dy=y-dragging.y;
    if (!dx&&!dy) return;
    const p={...selectedFrame().preset};
    if (selectedPart==="bothEyes") { p.gazeX+=dx; p.eyeY+=dy; }
    else if (selectedPart==="leftEye" || selectedPart==="rightEye") {
      p.gazeX+=Math.round(dx/2); p.eyeSpacing+=selectedPart==="leftEye"?-dx:dx;
      p[selectedPart==="leftEye"?"leftEyeOffsetY":"rightEyeOffsetY"]+=dy;
    } else if (selectedPart==="leftBrow" || selectedPart==="rightBrow") {
      p[selectedPart==="leftBrow"?"browLeftX":"browRightX"]+=dx; p.browY+=dy;
    } else if (selectedPart==="mouth") { p.mouthOffsetX+=dx; p.mouthY+=dy; }
    else { p.sweatOffsetX+=dx; p.sweatOffsetY+=dy; }
    if (replacePreset(p,false)) { dragging={...dragging,x,y}; renderControls(); }
  });
  function finishDrag() {
    if (dragging?.before!==snapshot) {
      undoStack.push(dragging.before); if (undoStack.length>80) undoStack.shift(); redoStack.length=0;
    }
    dragging=null; updateHistoryButtons();
  }
  overlay.addEventListener("pointerup",finishDrag);
  overlay.addEventListener("pointercancel",finishDrag);
  document.addEventListener("keydown",(event)=>{
    const editing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||"");
    const inEditor=!!document.activeElement?.closest(".face-inspector,.face-canvas-panel");
    if (!inEditor && document.activeElement!==document.body) return;
    if ((event.metaKey||event.ctrlKey) && event.key.toLowerCase()==="z") {
      event.preventDefault(); restoreHistory(event.shiftKey?redoStack:undoStack,event.shiftKey?undoStack:redoStack); return;
    }
    if (editing || event.metaKey || event.ctrlKey || event.altKey) return;
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if (!direction) return;
    event.preventDefault();
    const [dx,dy]=direction.map((value)=>value*(event.shiftKey?10:1));
    const p={...selectedFrame().preset};
    if (selectedPart==="bothEyes") {p.gazeX+=dx;p.eyeY+=dy;}
    else if (selectedPart==="leftEye"||selectedPart==="rightEye") {
      p.gazeX+=Math.round(dx/2);p.eyeSpacing+=selectedPart==="leftEye"?-dx:dx;
      p[selectedPart==="leftEye"?"leftEyeOffsetY":"rightEyeOffsetY"]+=dy;
    } else if (selectedPart==="leftBrow"||selectedPart==="rightBrow") {
      p[selectedPart==="leftBrow"?"browLeftX":"browRightX"]+=dx;p.browY+=dy;
    } else if (selectedPart==="mouth") {p.mouthOffsetX+=dx;p.mouthY+=dy;}
    else {p.sweatOffsetX+=dx;p.sweatOffsetY+=dy;}
    if (replacePreset(p)) renderControls();
  });
  function status(elapsedMs=0) {
    const framePosition=override === null ? faceFrameAt(animation(),elapsedMs) : null;
    const current=override === null ? framePosition.index : override;
    const length=animation().frames.length;
    const playbackLabel=animation().playback==="once" && elapsedMs>=framePosition?.totalMs
      ? "最後の顔を保持中" : "再生中";
    const message=override === null
      ? `${emotion} · コマ ${current+1}/${length} ${playbackLabel}`
      : `${emotion} · コマ ${current+1}/${length} を3Dに固定表示中`;
    if (message!==lastStatus) { $("faceAnimationStatus").textContent=message; lastStatus=message; }
    $("faceAnimationFollow").disabled=override===null;
  }
  function showFrame(frame, elapsedMs) {
    const index=animation().frames.indexOf(frame);
    const phase=faceEffectPhase(emotion,index,override===null ? elapsedMs : undefined);
    if (shownFrame===frame && shownPhase===phase) return;
    shownFrame=frame; shownPhase=phase;
    previewCtx.imageSmoothingEnabled=false;
    previewCtx.drawImage(displayFrame(frame,emotion,index,phase),0,0);
    drawSelection();
  }
  function renderRows() {
    const rows=$("faceAnimationRows"); rows.replaceChildren();
    const frames=animation().frames;
    const motions=getMotionSteps(emotion);
    const feasibility=motorFeasibility(motions,getMotionRates(emotion),0,30,animation().playback==="loop");
    frames.forEach((frame,index) => {
      const row=document.createElement("tr");
      if (index===selected) row.classList.add("selected");
      const number=document.createElement("td"); number.textContent=String(index+1).padStart(2,"0");
      const duration=document.createElement("td"), input=document.createElement("input");
      input.type="number"; input.min=String(MIN_FACE_FRAME_MS); input.max=String(MAX_FACE_FRAME_MS);
      input.step="10"; input.value=String(frame.durationMs);
      input.setAttribute("aria-label",`顔コマ${index+1} の表示時間 ms`);
      input.addEventListener("change",() => {
        const value=Number(input.value);
        if (!Number.isInteger(value) || value<MIN_FACE_FRAME_MS || value>MAX_FACE_FRAME_MS) {
          input.value=String(frame.durationMs); return;
        }
        frames[index]={...frame,durationMs:value}; motions[index].ms=value;
        shownFrame=null; persist(); renderRows(); onReplay();
      });
      duration.append(input);
      const angleCell=(axis)=>{
        const cell=document.createElement("td"), field=document.createElement("input");
        field.type="number"; field.step="0.1";
        const limits=getMotionLimits();
        field.min=String(axis==="yaw"?Math.max(-60,limits?.yaw?.minDeg??-60):Math.max(10,limits?.pitch?.minDeg??10));
        field.max=String(axis==="yaw"?Math.min(60,limits?.yaw?.maxDeg??60):Math.min(35,limits?.pitch?.maxDeg??35));
        field.value=String(Math.round((axis==="yaw"?motions[index].yaw*4:30+motions[index].pitch*4)*10)/10);
        field.setAttribute("aria-label",`コマ${index+1} 首${axis==="yaw"?"左右":"上下"}角度`);
        field.addEventListener("change",()=>{
          const value=Number(field.value);
          if (!Number.isFinite(value)||value<Number(field.min)||value>Number(field.max)) {renderRows();return;}
          motions[index][axis]=(axis==="yaw"?value:value-30)/4;
          persist(); renderRows(); onReplay();
        });
        cell.append(field); return cell;
      };
      const possible=document.createElement("td");
      const outcome=feasibility[index];
      possible.textContent=outcome.possible?"到達可":`要${outcome.requiredMs} ms`;
      possible.className=outcome.possible?"timeline-ok":"timeline-warning";
      possible.title=`指令速度上限と停止150 msからの概算。利用可能 ${outcome.availableMs} ms。`;
      const actions=document.createElement("td");
      const edit=document.createElement("button"); edit.type="button"; edit.textContent="編集";
      edit.setAttribute("aria-label",`顔コマ${index+1}を編集`);
      edit.addEventListener("click",() => { selected=index; override=index; shownFrame=null; renderRows(); renderControls(); status(); showFrame(selectedFrame()); onChange(); });
      actions.append(edit);
      for (const [text,delta] of [["↑",-1],["↓",1]]) {
        const move=document.createElement("button"); move.type="button"; move.textContent=text;
        move.title=`コマを${delta<0?"前":"後"}へ移動`;
        move.disabled=index+delta<0 || index+delta>=frames.length;
        move.addEventListener("click",() => {
          [frames[index],frames[index+delta]]=[frames[index+delta],frames[index]];
          [motions[index],motions[index+delta]]=[motions[index+delta],motions[index]];
          selected=index+delta; override=selected; shownFrame=null; persist(); renderRows(); renderControls(); status(); showFrame(selectedFrame()); onChange();
        }); actions.append(move);
      }
      row.append(number,duration,angleCell("yaw"),angleCell("pitch"),possible,actions); rows.append(row);
    });
    $("faceAnimationAdd").disabled=frames.length>=MAX_FACE_ANIMATION_FRAMES;
    $("faceAnimationDuplicate").disabled=frames.length>=MAX_FACE_ANIMATION_FRAMES;
    $("faceAnimationDelete").disabled=frames.length<=1;
  }
  function renderControls() {
    const controls=$("faceAnimationControls"); controls.replaceChildren();
    for (const button of document.querySelectorAll("#faceBrowToggle button[data-brow]"))
      button.setAttribute("aria-pressed",String(button.dataset.brow===selectedFrame().preset.browSide));
    for (const [key,label,spec,labels] of FACE_FIELDS.filter(([key])=>partFields[selectedPart].includes(key))) {
      const wrapper=document.createElement("label"); wrapper.className="face-control";
      const caption=document.createElement("span"); caption.textContent=label;
      let input;
      if (Array.isArray(spec)) {
        input=document.createElement("select");
        spec.forEach((value,index) => input.append(option(value,labels[index])));
        input.value=selectedFrame().preset[key];
      } else {
        input=document.createElement("input"); input.type=spec==="checkbox"?"checkbox":"number";
        if (spec==="checkbox") input.checked=selectedFrame().preset[key];
        else { input.min=String(spec); input.max=String(labels); input.step="1"; input.value=String(selectedFrame().preset[key]); }
      }
      if (key==="browVisible") wrapper.classList.add("face-control-check");
      input.setAttribute("aria-label",`顔コマ${selected+1} ${label}`);
      input.addEventListener("change",() => {
        const value=input.type==="checkbox"?input.checked:input.type==="number"?Number(input.value):input.value;
        const previous=selectedFrame();
        const preset={...previous.preset,[key]:value};
        if (!validatePreset(preset)) {
          if (input.type==="checkbox") input.checked=previous.preset[key];
          else input.value=String(previous.preset[key]);
          return;
        }
        replacePreset(preset);
      });
      wrapper.append(caption,input); controls.append(wrapper);
    }
  }
  function selectFrame(index) {
    selected=index; override=index; shownFrame=null; renderRows(); renderControls(); status(); showFrame(selectedFrame()); onChange();
  }

  FACE_TYPES.forEach((name) => $("faceAnimationBase").append(option(name)));
  for (const button of document.querySelectorAll("#facePartTools button[data-part]"))
    button.addEventListener("click",()=>selectPart(button.dataset.part));
  for (const button of document.querySelectorAll("#faceBrowToggle button[data-brow]"))
    button.addEventListener("click",()=>{
      replacePreset({...selectedFrame().preset,browSide:button.dataset.brow});
      for (const item of document.querySelectorAll("#faceBrowToggle button[data-brow]"))
        item.setAttribute("aria-pressed",String(item===button));
    });
  $("faceUndo").addEventListener("click",()=>restoreHistory(undoStack,redoStack));
  $("faceRedo").addEventListener("click",()=>restoreHistory(redoStack,undoStack));
  $("faceAnimationPlayback").addEventListener("change",() => {
    animation().playback=$("faceAnimationPlayback").value;
    onPlaybackChange(emotion,animation().playback);
    persist(); onChange();
  });
  $("faceAnimationCopyBase").addEventListener("click",() => {
    const source=$("faceAnimationBase").value;
    animation().frames[selected]={...selectedFrame(),preset:{...getBasePreset(source)}};
    override=selected; shownFrame=null; persist(); renderControls(); showFrame(selectedFrame()); status(); onChange();
  });
  $("faceAnimationAdd").addEventListener("click",() => {
    const frames=animation().frames;
    if (frames.length>=MAX_FACE_ANIMATION_FRAMES) return;
    frames.splice(selected+1,0,{durationMs:180,preset:{...selectedFrame().preset}});
    const motions=getMotionSteps(emotion); motions.splice(selected+1,0,{...motions[selected],ms:180});
    persist(); selectFrame(selected+1);
  });
  $("faceAnimationDuplicate").addEventListener("click",() => {
    const frames=animation().frames;
    if (frames.length>=MAX_FACE_ANIMATION_FRAMES) return;
    frames.splice(selected+1,0,{durationMs:selectedFrame().durationMs,preset:{...selectedFrame().preset}});
    const motions=getMotionSteps(emotion); motions.splice(selected+1,0,{...motions[selected]});
    persist(); selectFrame(selected+1);
  });
  $("faceAnimationDelete").addEventListener("click",() => {
    const frames=animation().frames;
    if (frames.length<=1) return;
    getMotionSteps(emotion).splice(selected,1);
    frames.splice(selected,1); selected=Math.min(selected,frames.length-1);
    override=selected; shownFrame=null; persist(); renderRows(); renderControls(); status(); showFrame(selectedFrame()); onChange();
  });
  $("faceAnimationReset").addEventListener("click",() => {
    design.emotions[emotion]=defaults().emotions[emotion];
    onPlaybackChange(emotion,design.emotions[emotion].playback);
    getMotionSteps(emotion).splice(0,Infinity,...timelines[emotion].map((part)=>({...part})));
    alignEmotion(emotion);
    selected=0; override=null; shownFrame=null; persist(); renderRows(); renderControls();
    $("faceAnimationPlayback").value=animation().playback; status(); onReplay();
  });
  $("faceAnimationFollow").addEventListener("click",() => { override=null; shownFrame=null; status(); onChange(); });
  $("faceAnimationReplay").addEventListener("click",() => { override=null; shownFrame=null; onReplay(); });
  $("faceAnimationImport").addEventListener("click",() => $("faceAnimationFile").click());
  $("faceAnimationFile").addEventListener("change",async(event) => {
    const file=event.target.files?.[0]; if (!file) return;
    try {
      if (file.size>4*1024*1024) throw new RangeError("ファイルが大きすぎます。");
      const raw=JSON.parse(await file.text());
      const next=raw.format==="inari-stackchan-design-v2"?raw.faceAnimationDesign:raw;
      const upgraded=upgradeFaceAnimationDesign(next);
      if (!upgraded) throw new RangeError("顔アニメーションの編集データを読み込めませんでした。");
      design=upgraded;
      for(const name of EMOTION_ORDER){alignEmotion(name);onPlaybackChange(name,animation(name).playback);}
      selected=0; override=null; shownFrame=null; persist();
      renderRows(); renderControls(); $("faceAnimationPlayback").value=animation().playback;
      status(); onReplay();
      $("faceAnimationFeedback").textContent="顔アニメーションの編集データを読み込みました。";
    } catch(error) {
      $("faceAnimationFeedback").textContent=error instanceof Error?error.message:"読み込みに失敗しました。";
    } finally { event.target.value=""; }
  });

  selectPart(selectedPart); updateHistoryButtons();
  renderRows(); renderControls(); $("faceAnimationPlayback").value=animation().playback; status(); showFrame(selectedFrame());
  if(recovered.length) $("faceAnimationFeedback").textContent=`古い保存データの時間軸を首のコマへ合わせました: ${recovered.join(", ")}。元のJSONがあれば「全感情のJSONを読み込む」から復元できます。`;
  return {
    refreshTimeline(){renderRows();},
    importDesign(next) {
      const upgraded=upgradeFaceAnimationDesign(next);
      if (!upgraded) throw new RangeError("顔アニメーションの編集データを読み込めませんでした。");
      design=upgraded;
      for (const name of EMOTION_ORDER) alignEmotion(name);
      for (const name of EMOTION_ORDER) onPlaybackChange(name,animation(name).playback);
      selected=0; override=null; shownFrame=null; persist();
      renderRows();renderControls();$("faceAnimationPlayback").value=animation().playback;status();onReplay();
    },
    setEmotion(name) {
      if (!EMOTION_ORDER.includes(name)) throw new RangeError("感情名を確認してください。");
      emotion=name; selected=0; override=null; shownFrame=null;
      renderRows(); renderControls(); $("faceAnimationPlayback").value=animation().playback; status();
    },
    followPlayback() { override=null; shownFrame=null; status(); },
    isOverriding() { return override!==null; },
    canvasAt(name,elapsedMs,forceLoop=false) {
      const track=animation(name);
      const frame=override!==null && name===emotion?track.frames[override]:faceFrameAt(forceLoop?{...track,playback:"loop"}:track,elapsedMs).frame;
      const index=track.frames.indexOf(frame);
      const phase=faceEffectPhase(name,index,override!==null && name===emotion ? undefined : elapsedMs);
      return displayFrame(frame,name,index,phase);
    },
    frameIndexAt(name,elapsedMs,forceLoop=false) {
      const track=animation(name);
      return override!==null && name===emotion ? override : faceFrameAt(forceLoop?{...track,playback:"loop"}:track,elapsedMs).index;
    },
    markAt(name,index,phase = faceEffectPhase(name,index)) {
      const key = `${name}:${phase}`;
      if (!marks.has(key)) marks.set(key, encodeEnvironmentMark(markContext,name,index,phase));
      return marks.get(key);
    },
    presetAt(name,elapsedMs,forceLoop=false) {
      const track=animation(name);
      const frame=override!==null && name===emotion?track.frames[override]:faceFrameAt(forceLoop?{...track,playback:"loop"}:track,elapsedMs).frame;
      return {...frame.preset};
    },
    updatePreview(name,elapsedMs,forceLoop=false) {
      if (name!==emotion) return;
      const track=animation();
      const frame=override!==null?track.frames[override]:faceFrameAt(forceLoop?{...track,playback:"loop"}:track,elapsedMs).frame;
      showFrame(frame,elapsedMs); status(elapsedMs);
    },
    design() { return structuredClone(design); },
    exportBitmaps(names = EMOTION_ORDER) {
      if (!validateFaceAnimationDesign(design)) throw new RangeError("顔アニメーションの設定を確認してください。");
      return {format:FACE_ANIMATION_FORMAT,width:FACE_WIDTH,height:FACE_HEIGHT,encoding:FACE_ENCODING,
        emotions:Object.fromEntries(names.map((name) => [name,{
          playback:animation(name).playback,
          frames:animation(name).frames.map((frame,index) => ({durationMs:frame.durationMs,pixels:encodeBase64(frameImage(frame,name,index).pixels)})),
        }]))};
    },
  };
}
