import { FACE_TYPES } from "./stackchanMotionDraft.js";
import { FACE_WIDTH, FACE_HEIGHT, FACE_FORMAT, FACE_ENCODING, FACE_DESIGN_FORMAT,
  defaultPresets, upgradePreset, validateFaceDesign, drawFace, packFacePixels, encodeBase64 } from "./stackchanFaceData.js";

const presets = defaultPresets();
try {
  const saved = JSON.parse(localStorage.getItem("inari-stackchan-face-presets-v1"));
  if (saved && typeof saved === "object") {
    for (const name of FACE_TYPES) {
      const upgraded = upgradePreset(saved[name]);
      if (upgraded) presets[name] = upgraded;
    }
  }
} catch { /* Keep bundled presets. */ }

export function baseFacePreset(name) {
  if (!FACE_TYPES.includes(name)) throw new RangeError("表情名を確認してください。");
  return {...presets[name]};
}

export function baseFaceDesign() {
  return {format:FACE_DESIGN_FORMAT,presets:Object.fromEntries(FACE_TYPES.map((name)=>[name,baseFacePreset(name)]))};
}

export function loadBaseFaceDesign(design) {
  if (!validateFaceDesign(design)) throw new RangeError("基本顔の編集設定を確認してください。");
  for (const name of FACE_TYPES) presets[name]={...design.presets[name]};
  try {localStorage.setItem("inari-stackchan-face-presets-v1",JSON.stringify(presets));}
  catch { /* Session remains editable. */ }
}

export function baseFaceBitmaps() {
  return {format:FACE_FORMAT,width:FACE_WIDTH,height:FACE_HEIGHT,encoding:FACE_ENCODING,
    faces:Object.fromEntries(FACE_TYPES.map((name)=>{
      const canvas=document.createElement("canvas"); canvas.width=FACE_WIDTH; canvas.height=FACE_HEIGHT;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});
      drawFace(ctx,presets[name]);
      return [name,{pixels:encodeBase64(packFacePixels(ctx.getImageData(0,0,FACE_WIDTH,FACE_HEIGHT).data))}];
    }))};
}
