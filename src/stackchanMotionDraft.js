import { EMOTION_ORDER } from "./emotionCatalog.js";
import { clamp } from "./stackchanMotionMath.js";

// Mirrors the command bounds and scaled step duration in the K151 firmware.
export const STEP_MIN_MS = 40;
export const STEP_MAX_MS = 60000;
export const MAX_STEPS = 24;
export const FACE_TYPES = Object.freeze([
  "neutral", "blink", "notice", "curious", "curiousReverse", "attentive",
  "happyOpen", "happy", "celebrate", "concern", "alert", "relief", "rest",
]);

export function editorBounds(limits) {
  if (!limits?.yaw || !limits?.pitch) throw new RangeError("サーボの可動範囲を確認してください。");
  return {
    yaw: { min: Math.max(-60, limits.yaw.minDeg), max: Math.min(60, limits.yaw.maxDeg) },
    pitch: { min: Math.max(10, limits.pitch.minDeg), max: Math.min(35, limits.pitch.maxDeg) },
  };
}

function tenth(degrees) { return Math.round(degrees * 10) / 10; }

export function visibleStep(part, limits) {
  const bounds = editorBounds(limits);
  return {
    durationMs: part.ms,
    yawDegrees: tenth(clamp(part.yaw * 4, bounds.yaw.min, bounds.yaw.max)),
    pitchDegrees: tenth(clamp(30 + part.pitch * 4, bounds.pitch.min, bounds.pitch.max)),
    face: part.face,
  };
}

export function motionDraft(emotion, parts, loops, limits) {
  if (!EMOTION_ORDER.includes(emotion)) throw new RangeError("感情名を確認してください。");
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > MAX_STEPS) {
    throw new RangeError(`ステップ数は1〜${MAX_STEPS}件にしてください。`);
  }
  const steps = parts.map((part) => {
    if (!Number.isInteger(part.ms) || part.ms < STEP_MIN_MS || part.ms > STEP_MAX_MS ||
        !Number.isFinite(part.yaw) || !Number.isFinite(part.pitch) || !FACE_TYPES.includes(part.face)) {
      throw new RangeError("ステップの時間・角度・表情を確認してください。");
    }
    return visibleStep(part, limits);
  });
  return {
    format: "inari-stackchan-motion-v1",
    emotion,
    playback: loops.has(emotion) ? "loop" : "once",
    steps,
  };
}

export function motionDraftFilename(emotion) {
  if (!EMOTION_ORDER.includes(emotion)) throw new RangeError("感情名を確認してください。");
  return `inari-stackchan-${emotion.toLowerCase()}-motion.json`;
}
