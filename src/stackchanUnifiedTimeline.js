import { DEFAULT_START_POSE, editorBounds, motionAngles, motionTarget } from "./stackchanMotionMath.js";

// Build one clock for the display and the two servo axes. Existing v2 files
// may have independent face and motion boundaries; preserve both as cuts.
export function alignTracks(frames, steps, maxFrames = 24) {
  if (!Array.isArray(frames) || !Array.isArray(steps) || !frames.length || !steps.length)
    throw new RangeError("顔と首のタイムラインが必要です。");
  const faceEnd = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
  const motionEnd = steps.reduce((sum, step) => sum + step.ms, 0);
  const total = Math.max(faceEnd, motionEnd);
  const boundaries = new Set([0, total]);
  let time = 0;
  for (const frame of frames) { time += frame.durationMs; if (time < total) boundaries.add(time); }
  time = 0;
  for (const step of steps) { time += step.ms; if (time < total) boundaries.add(time); }
  const cuts = [...boundaries].sort((a, b) => a - b);
  if (cuts.length - 1 > maxFrames || cuts.some((cut, index) => index && cut - cuts[index - 1] < 40))
    throw new RangeError(`顔と首の区切りが細かすぎます。40 ms以上・${maxFrames}コマ以内に調整してください。`);
  const at = (items, durationKey, position) => {
    let offset = 0;
    for (const item of items) { offset += item[durationKey]; if (position < offset) return item; }
    return items.at(-1);
  };
  return cuts.slice(0, -1).map((start, index) => {
    const ms = cuts[index + 1] - start;
    const frame = at(frames, "durationMs", start);
    const step = at(steps, "ms", start);
    return {frame:{durationMs:ms,preset:{...frame.preset}}, step:{...step,ms}};
  });
}

// The editor budgets the last authored interval for a separate return check.
function requiredTime(from, target, duration, rates) {
  const yaw = Math.round(Math.abs(target.yaw - from.yaw) * 10);
  const pitch = Math.round(Math.abs(target.pitch - from.pitch) * 10);
  if (yaw === 0 && pitch === 0) return 0;
  const transition = Math.min(480, Math.floor(duration * 0.65));
  const moveMs = Math.max(150 * yaw / rates[0], 150 * pitch / rates[1], 100, transition);
  return Math.ceil(moveMs / 50) * 50 + 150;
}

export function motorFeasibility(steps, rates, startYaw = 0, startPitch = 30, looping = false) {
  const start = {yaw:startYaw, pitch:startPitch};
  let previous = start;
  const targets = steps.map((step) => motionTarget(step, start));
  const frames = steps.map((step, index) => {
    const target = targets[index];
    const firstPassMs = requiredTime(previous, target, step.ms, rates);
    const loopMs = index === 0 && looping
      ? requiredTime(targets.at(-1), target, step.ms, rates) : 0;
    const requiredMs = Math.max(firstPassMs, loopMs);
    previous = target;
    return {index, requiredMs, availableMs:step.ms, possible:requiredMs <= step.ms};
  });
  return frames;
}

export function returnFeasibility(steps, rates, start) {
  const last = steps.at(-1);
  const requiredMs = requiredTime(motionTarget(last,start), start, last.ms, rates);
  return {requiredMs, availableMs:last.ms, possible:requiredMs <= last.ms};
}

function travelTenths(duration, rate) {
  const movementMs = Math.floor(duration / 50) * 50 - 150;
  const transition = Math.min(480, Math.floor(duration * 0.65));
  return movementMs < Math.max(100, transition) ? 0 : Math.floor(movementMs * rate / 150);
}

function fitAxis(values, durations, rate, bounds, neutral, looping) {
  const caps = durations.map((value) => travelTenths(value, rate));
  const low = Math.round((bounds.min - neutral) * 10);
  const high = Math.round((bounds.max - neutral) * 10);
  const targets = values.map((angle) => Math.round((angle - neutral) * 10));

  // Hold the previous pose through intervals that cannot accommodate any travel.
  let previous = 0;
  targets.forEach((target,index) => {
    if (caps[index] === 0) targets[index] = previous;
    previous = targets[index];
  });
  // If either edge fixes the end to the origin, propagate through its holds.
  if (caps.at(-1) === 0 || (looping && caps[0] === 0)) {
    let index = targets.length - 1;
    targets[index] = 0;
    while (index > 0 && caps[index] === 0) targets[--index] = 0;
  }

  let factor = 1;
  function limit(delta, cap) {
    if (delta !== 0) factor = Math.min(factor, cap / Math.abs(delta));
  }
  targets.forEach((target,index) => {
    limit(target, target < 0 ? -low : high);
    limit(target - (targets[index - 1] ?? 0),caps[index]);
  });
  if (looping) limit(targets[0] - targets.at(-1),caps[0]);
  limit(targets.at(-1),caps.at(-1));

  // Rounding toward zero preserves every integer travel budget on the 0.1° grid.
  return targets.map((target) =>
    (neutral * 10 + Math.sign(target) * Math.floor(Math.abs(target) * factor + 1e-9)) / 10);
}

export function fitMotion(steps, rates, limits, start, looping) {
  const bounds = editorBounds(limits,start);
  const original = steps.map(motionAngles);
  const durations = steps.map(({ms}) => ms);
  const fit = (axis, rate) => fitAxis(original.map((pose) => pose[axis]),durations,rate,
    bounds[axis],DEFAULT_START_POSE[axis],looping);
  const yaw = fit("yaw",rates[0]);
  const pitch = fit("pitch",rates[1]);
  const adjusted = steps.map((step,index) => ({...step,yaw:yaw[index] / 4,pitch:(pitch[index] - 30) / 4}));
  const frames = motorFeasibility(adjusted,rates,start.yaw,start.pitch,looping);
  const returning = returnFeasibility(adjusted,rates,start);
  if (!frames.every(({possible}) => possible) || !returning.possible ||
      adjusted.some((step) => !["yaw","pitch"].every((axis) => {
        const angle = motionAngles(step)[axis];
        return angle >= bounds[axis].min && angle <= bounds[axis].max;
      }))) throw new RangeError("角度を時間内の可動範囲に調整できません。");

  return {
    steps:adjusted,
    bounds,
    frames,
    returning,
    before:motorFeasibility(steps,rates,start.yaw,start.pitch,looping),
    beforeReturn:returnFeasibility(steps,rates,start),
    changes:original.flatMap((before,index) => {
      const after = {yaw:yaw[index],pitch:pitch[index]};
      return before.yaw === after.yaw && before.pitch === after.pitch ? [] : [{index,before,after}];
    }),
  };
}
