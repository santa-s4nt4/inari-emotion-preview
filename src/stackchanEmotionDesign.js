// Authoring source for the INARI face and neck loops.
// Angles are absolute machine degrees; the physical pitch neutral is 30°.
const step = (ms, yawDegrees, pitchDegrees, face, facePreset = {}) => ({
  ms, yaw: yawDegrees / 4, pitch: (pitchDegrees - 30) / 4, face, facePreset,
});

const inspectSoil = (ms, yaw, pitch, expression = {}) => step(ms, yaw, pitch, "concern", {
  sweat:"none", eyeY:113, eyeRadius:7, browY:80, browWidth:24,
  browLeftTilt:-12, browRightTilt:12, mouthWidth:14, mouthHeight:6, mouthY:153,
  ...expression,
});

const splashStep = (ms, yaw, pitch, expression = {}) => step(ms, yaw, pitch, "concern", {
  sweat:"none", eyeRadius:10, browY:73, browWidth:23, browLeftTilt:-6, browRightTilt:6,
  mouthMode:"line", mouthWidth:28, mouthY:150, ...expression,
});

const droop = (ms, yaw, pitch, expression = {}) => step(ms, yaw, pitch, "relief", {
  eyeMode:"closed", eyeY:112, eyeRadius:10, browSide:"both", browY:88,
  browWidth:18, browThickness:2, browLeftTilt:-9, browRightTilt:9,
  mouthMode:"line", mouthWidth:15, mouthY:156, ...expression,
});

const fidget = (ms, yaw, pitch, expression = {}) => step(ms, yaw, pitch, "curious", {
  eyeRadius:8, browWidth:20, browY:73, mouthMode:"line", mouthWidth:21,
  mouthY:149, ...expression,
});

const patrol = (ms, yaw, pitch, expression = {}) => step(ms, yaw, pitch, "happy", {
  eyeMode:"dot", eyeRadius:8, mouthMode:"smile", mouthWidth:48, mouthHeight:16,
  ...expression,
});

const pant = [
  [1150,27,12,4], [250,27,28,16], [250,27,14,5],
  [1150,19,38,21], [250,19,14,5], [250,19,34,19], [250,19,14,5], [250,19,30,16],
];
const tremblingMouths = [
  {mouthMode:"line",mouthWidth:26,mouthY:150,mouthOffsetX:0},
  {mouthMode:"open",mouthWidth:23,mouthHeight:4,mouthY:150,mouthOffsetX:0},
  {mouthMode:"line",mouthWidth:23,mouthY:150,mouthOffsetX:0},
  {mouthMode:"open",mouthWidth:28,mouthHeight:5,mouthY:150,mouthOffsetX:0},
];

const thinking = (ms, yaw, pitch, gazeX, eyeMode = "fox") =>
  step(ms, yaw, pitch, "neutral", {
    eyeMode, eyeY:84, eyeWidth:32, eyeHeight:12, eyeRadius:8, gazeX,
    browSide:"none", mouthMode:"line", mouthWidth:22, mouthY:145,
  });

export const TIMELINES = Object.freeze({
  NEUTRAL: [
    step(2600, 0, 26, "neutral", {mouthWidth:28}),
    step(150, 0, 26, "neutral", {mouthWidth:28,eyeMode:"closed"}),
    step(1400, 3, 26.5, "neutral", {mouthWidth:28,gazeX:3}),
    step(1000, 3, 26.5, "neutral", {mouthWidth:28,gazeX:3}),
    step(1300, 0, 26, "neutral", {mouthWidth:28}),
    step(150, 0, 26, "neutral", {mouthWidth:28,eyeMode:"closed"}),
    step(1400, 0, 26, "neutral", {mouthWidth:28}),
  ],
  NOTICE: [
    step(500, 0, 26, "neutral", {mouthWidth:28,eyeY:94}),
    step(120, 0, 26, "notice", {eyeMode:"ellipse",eyeWidth:17,eyeHeight:21,eyeY:94,browSide:"none",mouthMode:"open",mouthWidth:12,mouthHeight:6}),
    step(120, 0, 26, "notice", {eyeMode:"ellipse",eyeWidth:19,eyeHeight:27,eyeY:94,browSide:"none",mouthMode:"open",mouthWidth:12,mouthHeight:6}),
    step(900, 0, 29, "notice", {eyeRadius:12,browSide:"none",mouthMode:"open",mouthWidth:12,mouthHeight:6}),
    step(1200, 16, 29, "notice", {eyeRadius:13,browSide:"none",mouthMode:"open",mouthWidth:18,mouthHeight:8}),
    step(900, 16, 29, "notice", {eyeRadius:13,browSide:"none",mouthMode:"open",mouthWidth:12,mouthHeight:6}),
    step(150, 16, 29, "notice", {eyeMode:"closed",browSide:"none",mouthMode:"open",mouthWidth:12,mouthHeight:6}),
    step(1380, 0, 26, "notice", {eyeRadius:11,browSide:"none",mouthMode:"open",mouthWidth:12,mouthHeight:6}),
    step(120, 0, 26, "notice", {eyeMode:"ellipse",eyeWidth:17,eyeHeight:22,browSide:"none",mouthMode:"open",mouthWidth:12,mouthHeight:6}),
    step(1350, 0, 26, "neutral", {mouthWidth:28,eyeY:94}),
  ],
  CURIOUS: [
    step(600, 0, 26, "neutral", {mouthWidth:28}),
    step(1300, 19.8, 28, "curious", {gazeX:6,browLeftTilt:-8,browRightTilt:6}),
    step(700, 19.8, 28, "curious", {gazeX:6,browLeftTilt:-8,browRightTilt:6}),
    step(150, 19.8, 28, "curious", {gazeX:6,eyeMode:"closed"}),
    step(1600, -15.8, 28, "curiousReverse", {gazeX:-6,browLeftTilt:6,browRightTilt:-8}),
    step(700, -15.8, 28, "curiousReverse", {gazeX:-6,browLeftTilt:6,browRightTilt:-8}),
    step(1300, 0, 26, "curious", {gazeX:0,browLeftTilt:0,browRightTilt:0}),
    step(1150, 0, 26, "neutral", {mouthWidth:28}),
  ],
  ATTENTIVE: [
    step(600, 0, 26, "attentive", {eyeRadius:10,mouthWidth:32}),
    step(1100, 0, 21, "attentive", {eyeY:96,mouthWidth:38}),
    step(250, 0, 21, "attentive", {eyeMode:"closed",eyeY:96,mouthWidth:38}),
    step(1000, 0, 26, "attentive", {eyeRadius:10,mouthWidth:34}),
    step(1100, 0, 21, "attentive", {eyeY:96,mouthWidth:38}),
    step(900, 0, 26, "attentive", {eyeRadius:10,mouthWidth:34}),
    step(2050, 0, 26, "attentive", {eyeRadius:10,mouthWidth:34}),
  ],
  HAPPY: [
    step(500, 0, 26, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:62,mouthHeight:15}),
    step(120, 0, 26, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:62,mouthHeight:15,gazeX:1}),
    step(120, 0, 26, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:62,mouthHeight:15,gazeX:3}),
    step(1100, 30, 30, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:70,mouthHeight:15,gazeX:4}),
    step(160, 30, 30, "happyOpen", {eyeMode:"closed",eyeRadius:10,mouthMode:"smile",mouthWidth:70,mouthHeight:15,gazeX:4}),
    step(240, 30, 30, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:70,mouthHeight:15,gazeX:5}),
    step(120, 30, 30, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:70,mouthHeight:15,gazeX:2}),
    step(120, 30, 30, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:70,mouthHeight:15,gazeX:-2}),
    step(1600, -30, 30, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:70,mouthHeight:15,gazeX:-5}),
    step(160, -30, 30, "happyOpen", {eyeMode:"closed",eyeRadius:10,mouthMode:"smile",mouthWidth:70,mouthHeight:15,gazeX:-5}),
    step(210, -30, 30, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:70,mouthHeight:15,gazeX:-5}),
    step(120, -30, 30, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:70,mouthHeight:15,gazeX:-3}),
    step(120, -30, 30, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:70,mouthHeight:15,gazeX:-1}),
    step(1100, 0, 26, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:62,mouthHeight:15,gazeX:0}),
    step(160, 0, 26, "happyOpen", {eyeMode:"closed",eyeRadius:10,mouthMode:"smile",mouthWidth:62,mouthHeight:15}),
    step(1290, 0, 26, "happyOpen", {eyeMode:"smile",eyeRadius:10,mouthMode:"smile",mouthWidth:62,mouthHeight:15}),
  ],
  CELEBRATE: [
    step(500, 0, 26, "celebrate", {mouthWidth:70,mouthHeight:14}),
    step(1800, -80, 30, "celebrate", {gazeX:-4,mouthWidth:78,mouthHeight:17}),
    step(100, -80, 30, "celebrate", {eyeMode:"closed",mouthWidth:78,mouthHeight:17}),
    step(120, -80, 30, "celebrate", {eyeMode:"dot",eyeRadius:8,gazeX:-2,mouthMode:"open",mouthWidth:32,mouthHeight:12}),
    step(120, -80, 30, "celebrate", {eyeMode:"dot",eyeRadius:11,gazeX:1,mouthMode:"open",mouthWidth:34,mouthHeight:15}),
    step(3000, 80, 21.5, "celebrate", {eyeMode:"dot",eyeRadius:13,gazeX:4,mouthMode:"open",mouthWidth:36,mouthHeight:18}),
    step(100, 80, 21.5, "celebrate", {eyeMode:"closed",mouthMode:"open",mouthWidth:36,mouthHeight:18}),
    step(150, 80, 21.5, "celebrate", {eyeMode:"smile",eyeRadius:8,gazeX:2,mouthWidth:76,mouthHeight:17}),
    step(3000, -80, 30, "celebrate", {gazeX:-4,mouthWidth:80,mouthHeight:18}),
    step(100, -80, 30, "celebrate", {eyeMode:"closed",mouthWidth:80,mouthHeight:18}),
    step(120, -80, 30, "celebrate", {eyeMode:"dot",eyeRadius:8,gazeX:-2,mouthMode:"open",mouthWidth:34,mouthHeight:12}),
    step(120, -80, 30, "celebrate", {eyeMode:"dot",eyeRadius:11,gazeX:1,mouthMode:"open",mouthWidth:38,mouthHeight:15}),
    step(3000, 80, 21.5, "celebrate", {eyeMode:"dot",eyeRadius:13,gazeX:4,mouthMode:"open",mouthWidth:40,mouthHeight:18}),
    step(100, 80, 21.5, "celebrate", {eyeMode:"closed",mouthMode:"open",mouthWidth:40,mouthHeight:18}),
    step(150, 80, 21.5, "celebrate", {eyeMode:"smile",eyeRadius:8,gazeX:2,mouthWidth:78,mouthHeight:17}),
    step(3000, -80, 30, "celebrate", {gazeX:-4,mouthWidth:82,mouthHeight:18}),
    step(100, -80, 30, "celebrate", {eyeMode:"closed",mouthWidth:82,mouthHeight:18}),
    step(120, -80, 30, "celebrate", {eyeMode:"dot",eyeRadius:8,gazeX:-2,mouthMode:"open",mouthWidth:34,mouthHeight:12}),
    step(120, -80, 30, "celebrate", {eyeMode:"dot",eyeRadius:11,gazeX:1,mouthMode:"open",mouthWidth:38,mouthHeight:15}),
    step(3000, 80, 21.5, "celebrate", {eyeMode:"dot",eyeRadius:13,gazeX:4,mouthMode:"open",mouthWidth:40,mouthHeight:18}),
    step(100, 80, 21.5, "celebrate", {eyeMode:"closed",mouthMode:"open",mouthWidth:40,mouthHeight:18}),
    step(150, 80, 21.5, "celebrate", {eyeMode:"smile",eyeRadius:8,gazeX:2,mouthWidth:72,mouthHeight:15}),
    step(1800, 0, 26, "celebrate", {mouthWidth:76,mouthHeight:16}),
    step(80, 0, 26, "celebrate", {eyeMode:"closed",mouthWidth:70,mouthHeight:14}),
  ],
  CONCERN: [
    step(500, 0, 26, "concern", {eyeRadius:10,browLeftTilt:-12,browRightTilt:12,mouthHeight:14,sweatOffsetX:-6,sweatOffsetY:-12,sweatSize:7}),
    step(1300, -16, 22.2, "concern", {eyeRadius:11,browLeftTilt:-14,browRightTilt:14,mouthHeight:17,sweatOffsetX:-6,sweatOffsetY:-6,sweatSize:9}),
    step(500, -16, 22.2, "concern", {eyeRadius:11,browLeftTilt:-14,browRightTilt:14,mouthHeight:18,sweatOffsetX:-6,sweatOffsetY:0,sweatSize:10}),
    step(140, -16, 22.2, "concern", {eyeMode:"closed",browLeftTilt:-14,browRightTilt:14,mouthHeight:18,sweatOffsetX:-6,sweatOffsetY:4,sweatSize:11}),
    step(1600, 12.8, 21, "concern", {eyeRadius:11,browLeftTilt:-14,browRightTilt:14,mouthHeight:20,sweatOffsetX:-6,sweatOffsetY:10,sweatSize:12}),
    step(400, 12.8, 21, "concern", {eyeRadius:11,browLeftTilt:-14,browRightTilt:14,mouthHeight:20,sweatOffsetX:-6,sweatOffsetY:17,sweatSize:13}),
    step(1200, -6.4, 23.5, "concern", {eyeRadius:10,browLeftTilt:-12,browRightTilt:12,mouthHeight:17,sweatOffsetX:-6,sweatOffsetY:24,sweatSize:13}),
    step(1000, 0, 26, "concern", {eyeRadius:10,browLeftTilt:-12,browRightTilt:12,mouthHeight:14,sweat:"none"}),
    step(460, 0, 26, "concern", {eyeRadius:10,browLeftTilt:-12,browRightTilt:12,mouthHeight:14,sweat:"none"}),
  ],
  ALERT: [
    step(500, 0, 26, "attentive", {eyeMode:"dot",eyeRadius:9,mouthMode:"line"}),
    step(120, 0, 26, "alert", {eyeMode:"dot",eyeRadius:11,browSide:"none",mouthMode:"line",mouthWidth:28}),
    step(120, 0, 26, "alert", {eyeMode:"dot",eyeRadius:13,browSide:"none",mouthMode:"line",mouthWidth:28}),
    step(1000, 0, 30, "alert", {eyeMode:"dot",eyeRadius:14,browY:59,browThickness:2,mouthWidth:32,mouthHeight:16}),
    step(180, 0, 30, "alert", {eyeMode:"closed",browY:59,browThickness:2,mouthMode:"line",mouthWidth:28}),
    step(220, 0, 30, "alert", {eyeMode:"dot",eyeRadius:9,gazeX:4,browSide:"none",mouthMode:"line",mouthWidth:28}),
    step(120, 0, 30, "alert", {eyeMode:"dot",eyeRadius:12,gazeX:5,browSide:"none",mouthMode:"line",mouthWidth:28}),
    step(1030, 30, 30, "alert", {eyeMode:"dot",eyeRadius:15,gazeX:6,browY:58,browThickness:2,mouthWidth:36,mouthHeight:17}),
    step(180, 30, 30, "alert", {eyeMode:"closed",gazeX:6,browY:58,browThickness:2,mouthMode:"line",mouthWidth:28}),
    step(240, 30, 30, "alert", {eyeMode:"dot",eyeRadius:9,gazeX:5,browSide:"none",mouthMode:"line",mouthWidth:28}),
    step(120, 30, 30, "alert", {eyeMode:"dot",eyeRadius:11,gazeX:2,browSide:"none",mouthMode:"line",mouthWidth:28}),
    step(120, 30, 30, "alert", {eyeMode:"dot",eyeRadius:13,gazeX:-2,browSide:"none",mouthMode:"line",mouthWidth:28}),
    step(1430, -30, 29, "alert", {eyeMode:"dot",eyeRadius:15,gazeX:-6,browY:58,browThickness:2,mouthWidth:38,mouthHeight:18}),
    step(180, -30, 29, "alert", {eyeMode:"closed",gazeX:-6,browY:58,browThickness:2,mouthMode:"line",mouthWidth:28}),
    step(650, -30, 29, "alert", {eyeMode:"dot",eyeRadius:9,gazeX:-4,browSide:"none",mouthMode:"line",mouthWidth:28}),
    step(1080, 0, 26, "alert", {eyeMode:"dot",eyeRadius:9,gazeX:0,browSide:"none",mouthMode:"line",mouthWidth:28}),
  ],
  RELIEF: [
    step(600, 0, 26, "relief", {mouthWidth:40}),
    step(1200, 0, 30, "relief", {mouthWidth:48,mouthHeight:12}),
    step(500, 0, 30, "relief", {mouthWidth:50,mouthHeight:13}),
    step(1500, 0, 24, "relief", {mouthWidth:48,mouthHeight:12}),
    step(500, 0, 24, "relief", {mouthWidth:46,mouthHeight:11}),
    step(1200, 0, 26, "relief", {mouthWidth:44,mouthHeight:10}),
    step(1500, 0, 26, "relief", {mouthWidth:42,mouthHeight:9}),
  ],
  REST: [
    step(2700, 0, 25.5, "rest", {mouthWidth:30}),
    step(1000, 0, 26, "rest", {mouthWidth:32}),
    step(2700, 0, 25.5, "rest", {mouthWidth:30}),
    step(1000, 0, 26, "rest", {mouthWidth:32}),
    step(600, 0, 26, "rest", {mouthWidth:30}),
  ],
  COLD: Array.from({length:16}, (_, index) =>
    step(450, index % 2 ? 3.5 : -3.5, index % 2 ? 26.5 : 25.5,
      "rest", tremblingMouths[index % tremblingMouths.length])),
  HOT: [...pant, ...pant].map(([ms,pitch,mouthWidth,mouthHeight]) =>
    step(ms, 0, pitch, "rest", {mouthMode:"open",mouthWidth,mouthHeight})),
  DRY_SOIL: [
    inspectSoil(750, 0, 26, {eyeY:101}),
    inspectSoil(1100, -10, 19, {gazeX:-10}),
    inspectSoil(600, -10, 19, {gazeX:-10,mouthMode:"line",mouthWidth:19}),
    inspectSoil(180, -10, 19, {gazeX:-10,eyeMode:"closed",mouthMode:"line",mouthWidth:19}),
    inspectSoil(1300, 11, 18, {gazeX:11,mouthWidth:17,mouthHeight:7}),
    inspectSoil(1050, 11, 18, {gazeX:8,mouthMode:"line",mouthWidth:18}),
    inspectSoil(1150, 0, 25, {eyeY:105,mouthMode:"line"}),
    inspectSoil(870, 0, 26, {eyeY:101}),
  ],
  WET_SOIL: [
    splashStep(750, 0, 26, {eyeY:110}),
    splashStep(900, -13, 28, {eyeRadius:12,gazeX:-9,mouthMode:"open",mouthWidth:23,mouthHeight:10}),
    splashStep(560, -13, 22, {eyeMode:"closed",gazeX:-9,mouthMode:"open",mouthWidth:26,mouthHeight:7}),
    splashStep(1000, 13, 28, {eyeRadius:12,gazeX:9,mouthMode:"open",mouthWidth:24,mouthHeight:11}),
    splashStep(560, 13, 22, {eyeMode:"closed",gazeX:9,mouthMode:"open",mouthWidth:26,mouthHeight:7}),
    splashStep(950, -10, 27, {eyeRadius:10,gazeX:-7,mouthMode:"open",mouthWidth:19,mouthHeight:8}),
    splashStep(880, 0, 25, {eyeY:108,mouthWidth:21}),
    splashStep(1400, 0, 26, {eyeY:110}),
  ],
  DRY_AIR: [
    droop(900, 0, 26, {eyeMode:"dot",eyeY:104,eyeRadius:7}),
    droop(1400, -12, 19, {leftEyeOffsetY:4,rightEyeOffsetY:-4,mouthWidth:13}),
    droop(600, -12, 19, {leftEyeOffsetY:4,rightEyeOffsetY:-4,mouthMode:"open",mouthWidth:12,mouthHeight:6}),
    droop(1300, -12, 19, {leftEyeOffsetY:4,rightEyeOffsetY:-4,mouthWidth:13}),
    droop(1200, -5, 22, {eyeY:114,mouthWidth:17}),
    droop(1600, 0, 26, {eyeMode:"dot",eyeY:104,eyeRadius:7}),
  ],
  HUMID_AIR: [
    fidget(720, 0, 26, {gazeX:3,leftEyeOffsetY:2,browLeftTilt:0,browRightTilt:12,mouthOffsetX:6}),
    fidget(850, -11, 25, {gazeX:-10,leftEyeOffsetY:5,browLeftTilt:14,browRightTilt:1,mouthOffsetX:-10}),
    fidget(160, -11, 25, {eyeMode:"closed",leftEyeOffsetY:5,mouthOffsetX:-10}),
    fidget(880, 12, 26, {gazeX:10,rightEyeOffsetY:5,browLeftTilt:-1,browRightTilt:-14,mouthOffsetX:10}),
    fidget(850, -12, 24, {gazeX:-10,leftEyeOffsetY:5,browLeftTilt:14,browRightTilt:1,mouthOffsetX:-10}),
    fidget(160, -12, 24, {eyeMode:"closed",leftEyeOffsetY:5,mouthOffsetX:-10}),
    fidget(900, 10, 26, {gazeX:8,rightEyeOffsetY:4,browLeftTilt:-2,browRightTilt:-12,mouthOffsetX:8}),
    fidget(850, -6, 25, {gazeX:-5,leftEyeOffsetY:3,mouthOffsetX:-6}),
    fidget(1630, 0, 26, {gazeX:3,leftEyeOffsetY:2,browLeftTilt:0,browRightTilt:12,mouthOffsetX:6}),
  ],
  CHEERFUL: [
    patrol(720, 0, 26),
    patrol(650, -8, 29, {gazeX:-8,eyeMode:"smile",eyeRadius:11,mouthWidth:59}),
    patrol(570, -12, 24, {gazeX:-6,mouthWidth:43}),
    patrol(650, 8, 29, {gazeX:8,eyeMode:"smile",eyeRadius:11,mouthWidth:61}),
    patrol(570, 12, 24, {gazeX:6,mouthWidth:43}),
    patrol(900, -14, 27, {gazeX:-10,mouthWidth:55}),
    patrol(900, 14, 27, {gazeX:10,mouthWidth:55}),
    patrol(850, 0, 26, {eyeMode:"smile",eyeRadius:11,mouthWidth:58}),
    patrol(160, 0, 26, {eyeMode:"closed",mouthWidth:47}),
    patrol(1030, 0, 26),
  ],
  THINKING: [
    thinking(900, 0, 26, 0),
    thinking(850, -4, 30, -8),
    thinking(500, -4, 30, -10),
    thinking(150, -4, 30, -10, "closed"),
    thinking(850, 4, 30, 8),
    thinking(500, 4, 30, 9),
    thinking(650, 0, 29, 3),
    thinking(600, 0, 26, 0),
  ],
});

export const REVISED_ENVIRONMENT_EMOTES = Object.freeze([
  "DRY_SOIL", "WET_SOIL", "DRY_AIR", "HUMID_AIR", "CHEERFUL",
]);

export const EMOTION_LOOPS = new Set(Object.keys(TIMELINES));
// Planning estimates, not measured motor limits. Firmware waits for actual
// arrival and extends a face/neck frame when the servo needs more time.
export const PLANNING_RATES_DPS = Object.freeze([100, 30]);
