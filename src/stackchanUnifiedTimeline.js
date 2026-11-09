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

export function motorFeasibility(steps, rates, startYaw = 0, startPitch = 30, looping = false) {
  let yaw = startYaw, pitch = startPitch;
  const loopStart=steps.at(-1);
  return steps.map((step, index) => {
    const targetYaw = step.yaw * 4, targetPitch = 30 + step.pitch * 4;
    const yawMs = Math.abs(targetYaw-yaw) / rates[0] * 1500;
    const pitchMs = Math.abs(targetPitch-pitch) / rates[1] * 1500;
    const transition=Math.min(480,Math.floor(step.ms*0.65));
    const moving=Math.abs(targetYaw-yaw)>0.05||Math.abs(targetPitch-pitch)>0.05;
    const requiredMs = moving ? Math.ceil(Math.max(yawMs,pitchMs,100,transition) / 50) * 50 + 150 : 0;
    let loopRequiredMs=0;
    if(index===0 && looping && loopStart) {
      const loopYaw=loopStart.yaw*4, loopPitch=30+loopStart.pitch*4;
      if(Math.abs(targetYaw-loopYaw)>0.05||Math.abs(targetPitch-loopPitch)>0.05)
        loopRequiredMs=Math.ceil(Math.max(100,transition,
          Math.abs(targetYaw-loopYaw)/rates[0]*1500,
          Math.abs(targetPitch-loopPitch)/rates[1]*1500)/50)*50+150;
    }
    const result = {index,requiredMs:Math.max(requiredMs,loopRequiredMs),availableMs:step.ms,
      possible:Math.max(requiredMs,loopRequiredMs)<=step.ms};
    yaw=targetYaw; pitch=targetPitch;
    return result;
  });
}
