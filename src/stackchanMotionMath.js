// Mirrors firmware/src/stack-chan/{angle_settings_policy.h,servo_safety_policy.h,motion.cpp}.
export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
export function toRaw(tenths, zero) { return zero + Math.sign(tenths) * Math.floor((Math.abs(tenths) * 16 + 25) / 50); }
export function fromRaw(raw, zero) { return Math.trunc((raw - zero) * 50 / 16); }

export function axisLimits(min, zero, max, commandMinTenths, commandMaxTenths) {
  if (![min, zero, max].every(Number.isInteger) || min < 0 || max > 1023 || min >= zero || zero >= max || zero > 1000) throw new RangeError("raw値は 0 ≤ 最小 < ゼロ < 最大 ≤ 1023 としてください。");
  const safeMin = zero - Math.trunc((zero - min) * 0.9);
  const safeMax = zero + Math.trunc((max - zero) * 0.9);
  const commandMin = Math.max(safeMin, toRaw(commandMinTenths, zero));
  const commandMax = Math.min(safeMax, toRaw(commandMaxTenths, zero));
  if (commandMax - commandMin < 16) throw new RangeError("安全な可動域を確保できません。サーボの上下限を確認してください。");
  const goalMin = commandMin + 8;
  const goalMax = commandMax - 8;
  return { goalMin, goalMax, minDeg: fromRaw(goalMin, zero) / 10, maxDeg: fromRaw(goalMax, zero) / 10, zero };
}

export function clampAngle(deg, limits) {
  if (!Number.isInteger(limits.zero))
    return clamp(deg, limits.minDeg, limits.maxDeg);
  const raw = toRaw(Math.round(deg * 10), limits.zero);
  return fromRaw(clamp(raw, limits.goalMin, limits.goalMax), limits.zero) / 10;
}
