import { DEVICE_EMOTION_ORDER as EMOTION_ORDER } from "./emotionCatalog.js";
import { motionAngles, isTenthDegree, JSON_ANGLE_BOUNDS } from "./stackchanMotionMath.js";

// Mirrors the command bounds and scaled step duration in the K151 firmware.
export const STEP_MIN_MS = 40;
export const STEP_MAX_MS = 60000;
export const MAX_STEPS = 24;
export const FACE_TYPES = Object.freeze([
  "neutral", "blink", "notice", "curious", "curiousReverse", "attentive",
  "happyOpen", "happy", "celebrate", "concern", "alert", "relief", "rest",
]);

export function visibleStep(part) {
  const {yaw,pitch} = motionAngles(part);
  return {durationMs:part.ms,yawDegrees:yaw,pitchDegrees:pitch,face:part.face};
}

export function motionStepFromJson(part) {
  if (!part || !Number.isInteger(part.durationMs) || part.durationMs < STEP_MIN_MS ||
      part.durationMs > STEP_MAX_MS || !FACE_TYPES.includes(part.face) ||
      !["yaw","pitch"].every((axis) => {
        const value = part[`${axis}Degrees`];
        const {min,max} = JSON_ANGLE_BOUNDS[axis];
        return isTenthDegree(value) && value >= min && value <= max;
      })) throw new RangeError("ステップの時間・角度・表情を確認してください。");
  return {ms:part.durationMs,yaw:part.yawDegrees / 4,pitch:(part.pitchDegrees - 30) / 4,face:part.face};
}

export function motionDraft(emotion, parts, loops) {
  if (!EMOTION_ORDER.includes(emotion)) throw new RangeError("感情名を確認してください。");
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > MAX_STEPS) {
    throw new RangeError(`ステップ数は1〜${MAX_STEPS}件にしてください。`);
  }
  const steps = parts.map((part) => {
    if (!Number.isFinite(part?.yaw) || !Number.isFinite(part?.pitch)) {
      throw new RangeError("ステップの角度を確認してください。");
    }
    const step = visibleStep(part);
    motionStepFromJson(step);
    return step;
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
