import { EMOTION_ORDER } from "./emotionCatalog.js";
import { validatePreset, upgradePreset } from "./stackchanFaceData.js";

export const FACE_ANIMATION_FORMAT = "inari-stackchan-face-animations-v1";
export const FACE_ANIMATION_DESIGN_FORMAT = "inari-stackchan-face-animation-design-v1";
export const MAX_FACE_ANIMATION_FRAMES = 24;
export const MIN_FACE_FRAME_MS = 40;
export const MAX_FACE_FRAME_MS = 60000;

const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).sort().join() === [...keys].sort().join();

export function defaultFaceAnimationDesign(timelines, loops, getPreset) {
  const emotions = Object.fromEntries(EMOTION_ORDER.map((emotion) => {
    const frames = timelines[emotion].map((step) => ({
      durationMs:step.ms, preset:{...getPreset(step.face),...(step.facePreset??{})},
    }));
    return [emotion, {playback:loops.has(emotion) ? "loop" : "once",frames}];
  }));
  return {format:FACE_ANIMATION_DESIGN_FORMAT, emotions};
}

export function validateFaceAnimationDesign(design) {
  if (!exactKeys(design,["format","emotions"]) || design.format !== FACE_ANIMATION_DESIGN_FORMAT ||
      !exactKeys(design.emotions,EMOTION_ORDER)) return false;
  return EMOTION_ORDER.every((emotion) => {
    const animation = design.emotions[emotion];
    return exactKeys(animation,["playback","frames"]) &&
      ["loop","once"].includes(animation.playback) &&
      Array.isArray(animation.frames) && animation.frames.length >= 1 &&
      animation.frames.length <= MAX_FACE_ANIMATION_FRAMES &&
      animation.frames.every((frame) => exactKeys(frame,["durationMs","preset"]) &&
        Number.isInteger(frame.durationMs) && frame.durationMs >= MIN_FACE_FRAME_MS &&
        frame.durationMs <= MAX_FACE_FRAME_MS && validatePreset(frame.preset));
  });
}

export function upgradeFaceAnimationDesign(design) {
  if (!design?.emotions) return null;
  const upgraded={format:FACE_ANIMATION_DESIGN_FORMAT,emotions:{}};
  for (const name of EMOTION_ORDER) {
    const item=design.emotions[name];
    if (!item || !Array.isArray(item.frames)) return null;
    upgraded.emotions[name]={playback:item.playback,frames:item.frames.map((frame)=>({
      durationMs:frame.durationMs,preset:upgradePreset(frame.preset),
    }))};
  }
  return validateFaceAnimationDesign(upgraded)?upgraded:null;
}

export function faceFrameAt(animation, elapsedMs) {
  if (!animation?.frames?.length || !Number.isFinite(elapsedMs)) throw new RangeError("顔アニメーションの時間軸を確認してください。");
  const totalMs = animation.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
  const time = animation.playback === "loop"
    ? Math.max(0, elapsedMs) % totalMs
    : Math.min(Math.max(0, elapsedMs), totalMs - 1);
  let offset = 0;
  for (let index = 0; index < animation.frames.length; index++) {
    const frame = animation.frames[index];
    if (time < offset + frame.durationMs) return {index, frame, frameElapsedMs:time-offset, totalMs};
    offset += frame.durationMs;
  }
  throw new RangeError("顔アニメーションの時間軸を確認してください。");
}
