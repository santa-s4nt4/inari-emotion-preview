export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

export const K151_REFERENCE_LIMITS = Object.freeze({
  yaw: Object.freeze({minDeg:-120.6, maxDeg:150.6}),
  pitch: Object.freeze({minDeg:5.6, maxDeg:43.4}),
});

export const DEFAULT_START_POSE = Object.freeze({yaw:0, pitch:30});
export const JSON_ANGLE_BOUNDS = Object.freeze({
  yaw: Object.freeze({min:-320, max:320}),
  pitch: Object.freeze({min:-290, max:350}),
});

export function tenth(degrees) { return Math.round(degrees * 10) / 10; }

export function isTenthDegree(value) {
  return Number.isFinite(value) && Math.abs(value * 10 - Math.round(value * 10)) < 1e-8;
}

export function profileLimits(profile) {
  const yaw = [profile.yawMinTenths, profile.yawMaxTenths];
  const pitch = [profile.pitchMinTenths, profile.pitchMaxTenths];
  if (!yaw.every(Number.isInteger) || !pitch.every(Number.isInteger) ||
      yaw[0] >= yaw[1] || pitch[0] >= pitch[1] ||
      [...yaw, ...pitch].some((value) => Math.abs(value) > 3200)) return null;
  // The reported endpoints already include quantization and correction clearance.
  return {
    yaw:{minDeg:yaw[0] / 10, maxDeg:yaw[1] / 10},
    pitch:{minDeg:pitch[0] / 10, maxDeg:pitch[1] / 10},
  };
}

export function containsPose(limits, pose) {
  return ["yaw", "pitch"].every((axis) =>
    isTenthDegree(pose[axis]) && pose[axis] >= limits[axis].minDeg && pose[axis] <= limits[axis].maxDeg);
}

export function editorBounds(limits, start = DEFAULT_START_POSE) {
  if (!limits?.yaw || !limits?.pitch || !containsPose(limits, start)) {
    throw new RangeError("開始姿勢を実機の目標範囲内で選んでください。");
  }
  return Object.fromEntries(["yaw","pitch"].map((axis) => {
    const neutral = DEFAULT_START_POSE[axis];
    return [axis, {
      min: Math.max(JSON_ANGLE_BOUNDS[axis].min, tenth(neutral + limits[axis].minDeg - start[axis])),
      max: Math.min(JSON_ANGLE_BOUNDS[axis].max, tenth(neutral + limits[axis].maxDeg - start[axis])),
    }];
  }));
}

export function motionAngles(part) {
  return {yaw:tenth(part.yaw * 4), pitch:tenth(30 + part.pitch * 4)};
}

export function motionTarget(part, start) {
  const {yaw,pitch} = motionAngles(part);
  return {yaw:tenth(start.yaw + yaw), pitch:tenth(start.pitch + pitch - 30)};
}
