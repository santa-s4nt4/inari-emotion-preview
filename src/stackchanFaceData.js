import { FACE_TYPES } from "./stackchanMotionDraft.js";

export const FACE_WIDTH = 320;
export const FACE_HEIGHT = 240;
export const FACE_FORMAT = "inari-stackchan-faces-v1";
export const FACE_ENCODING = "mono-msb-row-major-v1";
export const FACE_DESIGN_FORMAT = "inari-stackchan-face-design-v2";
export const EYE_MODES = Object.freeze(["dot", "ellipse", "wide", "closed", "smile"]);
export const MOUTH_MODES = Object.freeze(["line", "smile", "open", "tiny"]);
export const SWEAT_MODES = Object.freeze(["none", "left", "right"]);
export const BROW_SIDES = Object.freeze(["none", "left", "right", "both"]);

const base = {
  eyeMode: "dot", eyeRadius: 8, eyeY: 95, eyeSpacing: 140, gazeX: 0,
  browSide: "none", browY: 70, browLeftX: 0, browRightX: 0,
  browWidth: 30, browThickness: 3, browLeftTilt: 0, browRightTilt: 0,
  eyeWidth: 15, eyeHeight: 25,
  leftEyeOffsetY: 0, rightEyeOffsetY: 0,
  mouthMode: "line", mouthWidth: 50, mouthHeight: 9, mouthY: 148, mouthOffsetX: 0,
  sweat: "none", sweatOffsetX: 0, sweatOffsetY: 0, sweatSize: 10,
};
const withBase = (values) => ({ ...base, ...values });

export const DEFAULT_FACE_PRESETS = Object.freeze({
  neutral: withBase({}),
  blink: withBase({ eyeMode: "closed" }),
  notice: withBase({ eyeMode: "wide", eyeRadius: 10, browSide: "both", browY: 66, mouthMode: "tiny" }),
  curious: withBase({ gazeX: 4, browSide: "both", browLeftTilt: -6, browRightTilt: 5, mouthMode: "open", mouthWidth: 12, mouthHeight: 6 }),
  curiousReverse: withBase({ gazeX: -4, browSide: "both", browLeftTilt: 5, browRightTilt: -6, mouthMode: "open", mouthWidth: 12, mouthHeight: 6 }),
  attentive: withBase({ eyeRadius: 9, eyeY: 93, mouthMode: "smile", mouthWidth: 34 }),
  happyOpen: withBase({ eyeMode: "wide", eyeRadius: 11, mouthMode: "smile", mouthWidth: 52 }),
  happy: withBase({ eyeMode: "smile", eyeRadius: 13, mouthMode: "smile", mouthWidth: 54 }),
  celebrate: withBase({ eyeMode: "smile", eyeRadius: 15, mouthMode: "smile", mouthWidth: 68 }),
  concern: withBase({ eyeRadius: 9, eyeY: 100, browSide: "both", browY: 66, browLeftTilt: 10, browRightTilt: -10, mouthMode: "open", mouthWidth: 28, mouthHeight: 12, sweat: "left" }),
  alert: withBase({ eyeMode: "wide", eyeRadius: 12, browSide: "both", browY: 63, browThickness: 2, mouthMode: "open", mouthWidth: 30, mouthHeight: 13 }),
  relief: withBase({ eyeMode: "closed", mouthMode: "smile", mouthWidth: 42 }),
  rest: withBase({ eyeMode: "closed", eyeY: 102, mouthWidth: 32, mouthY: 153 }),
});

const numberFields = Object.freeze({
  eyeRadius: [4, 18], eyeY: [70, 125], eyeSpacing: [100, 170], gazeX: [-12, 12],
  browY: [48, 90], browLeftX: [-20, 20], browRightX: [-20, 20],
  browWidth: [10, 45], browThickness: [2, 8], browLeftTilt: [-16, 16], browRightTilt: [-16, 16],
  eyeWidth: [6, 36], eyeHeight: [8, 42],
  leftEyeOffsetY: [-25, 25], rightEyeOffsetY: [-25, 25],
  mouthWidth: [8, 90], mouthHeight: [4, 24], mouthY: [125, 175], mouthOffsetX: [-50, 50],
  sweatOffsetX: [-30, 30], sweatOffsetY: [-30, 30], sweatSize: [4, 24],
});

export function validatePreset(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join() !== Object.keys(base).sort().join()) return false;
  if (!EYE_MODES.includes(value.eyeMode) || !MOUTH_MODES.includes(value.mouthMode) ||
      !SWEAT_MODES.includes(value.sweat) || !BROW_SIDES.includes(value.browSide)) return false;
  return Object.entries(numberFields).every(([name, [min, max]]) =>
    Number.isInteger(value[name]) && value[name] >= min && value[name] <= max);
}

export function upgradePreset(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const oldBrow = value.browVisible === true ? "both" : "none";
  const next = {...base,...value,browSide:value.browSide ?? oldBrow};
  delete next.browVisible;
  return validatePreset(next) ? next : null;
}

export function defaultPresets() {
  return Object.fromEntries(FACE_TYPES.map((name) => [name, { ...DEFAULT_FACE_PRESETS[name] }]));
}

export function validateFaceDesign(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join() === "format,presets" &&
    value.format === FACE_DESIGN_FORMAT &&
    value.presets && typeof value.presets === "object" && !Array.isArray(value.presets) &&
    Object.keys(value.presets).sort().join() === [...FACE_TYPES].sort().join() &&
    FACE_TYPES.every((name) => validatePreset(value.presets[name]));
}

export function drawFace(ctx, preset, mouthOpen = 0) {
  if (!validatePreset(preset)) throw new RangeError("表情の設定値を確認してください。");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, FACE_WIDTH, FACE_HEIGHT);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  const eyes = [FACE_WIDTH / 2 - preset.eyeSpacing / 2, FACE_WIDTH / 2 + preset.eyeSpacing / 2];
  for (let index = 0; index < 2; index++) {
    const x = eyes[index] + preset.gazeX;
    const y = preset.eyeY + (index === 0 ? preset.leftEyeOffsetY : preset.rightEyeOffsetY);
    const r = preset.eyeRadius;
    ctx.beginPath();
    if (preset.eyeMode === "dot" || preset.eyeMode === "wide" || preset.eyeMode === "ellipse") {
      const width = preset.eyeMode === "ellipse" ? preset.eyeWidth/2 : preset.eyeMode === "wide" ? Math.round(r*0.82) : r;
      const height = preset.eyeMode === "ellipse" ? preset.eyeHeight/2 : preset.eyeMode === "wide" ? Math.round(r*1.35) : r;
      ctx.ellipse(x, y, width, height, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (preset.eyeMode === "closed") {
      ctx.fillRect(Math.round(x-r), Math.round(y-2), r*2, 4);
    } else {
      ctx.lineWidth = 4;
      ctx.moveTo(x-r, y+3);
      ctx.quadraticCurveTo(x, y-r+1, x+r, y+3);
      ctx.stroke();
    }
    if (preset.browSide === "both" || preset.browSide === (index===0?"left":"right")) {
      const tilt = index === 0 ? preset.browLeftTilt : preset.browRightTilt;
      const bx = eyes[index] + (index===0?preset.browLeftX:preset.browRightX);
      ctx.beginPath();
      ctx.lineWidth = preset.browThickness;
      ctx.moveTo(bx-preset.browWidth/2, preset.browY-tilt/2);
      ctx.lineTo(bx+preset.browWidth/2, preset.browY+tilt/2);
      ctx.stroke();
    }
  }
  const mx = FACE_WIDTH / 2 + preset.mouthOffsetX, my = preset.mouthY, mw = preset.mouthWidth;
  if (mouthOpen > 0) {
    ctx.beginPath(); ctx.ellipse(mx,my,Math.max(5,Math.min(22,mw/3)),Math.max(4,Math.min(25,mouthOpen/5)),0,0,Math.PI*2); ctx.fill();
  } else if (preset.mouthMode === "line") {
    ctx.fillRect(Math.round(mx-mw/2), my-2, mw, 4);
  } else if (preset.mouthMode === "tiny") {
    ctx.fillRect(mx-4, my-4, 8, 8);
  } else if (preset.mouthMode === "open") {
    ctx.beginPath(); ctx.ellipse(mx, my, mw/2, preset.mouthHeight, 0, 0, Math.PI*2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.lineWidth = 4;
    ctx.moveTo(mx-mw/2, my-6);
    ctx.quadraticCurveTo(mx, my+preset.mouthHeight, mx+mw/2, my-6);
    ctx.stroke();
  }
  if (preset.sweat !== "none") {
    const x = (preset.sweat === "left" ? eyes[0]-44 : eyes[1]+44)+preset.sweatOffsetX;
    const y = preset.eyeY+4+preset.sweatOffsetY;
    const s = preset.sweatSize;
    const shoulder = Math.max(2, Math.round(s*0.42));
    const rx = Math.max(3, Math.round(s*0.58));
    const ry = Math.max(3, Math.round(s*0.70));
    const cy = Math.round(y+s*0.30);
    ctx.beginPath(); ctx.moveTo(x, y-s);
    ctx.lineTo(x-shoulder, y); ctx.lineTo(x+shoulder, y);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI*2); ctx.fill();
  }
}

export function packFacePixels(rgba, width = FACE_WIDTH, height = FACE_HEIGHT) {
  if (width !== FACE_WIDTH || height !== FACE_HEIGHT || rgba.length !== width*height*4) {
    throw new RangeError("液晶画像は320×240のRGBAで指定してください。");
  }
  const pixels = new Uint8Array(width*height/8);
  for (let i = 0; i < width*height; i++) {
    const p = i*4;
    if ((rgba[p]*299 + rgba[p+1]*587 + rgba[p+2]*114)/1000 < 128) {
      pixels[i>>3] |= 0x80 >> (i&7);
    }
  }
  return pixels;
}

export function paintPackedFace(ctx, pixels) {
  if (!(pixels instanceof Uint8Array) || pixels.length !== FACE_WIDTH*FACE_HEIGHT/8) {
    throw new RangeError("顔画像のデータ長が違います。");
  }
  const image = ctx.createImageData(FACE_WIDTH, FACE_HEIGHT);
  for (let i = 0; i < FACE_WIDTH*FACE_HEIGHT; i++) {
    const v = pixels[i>>3] & (0x80 >> (i&7)) ? 0 : 255;
    const p = i*4;
    image.data[p] = image.data[p+1] = image.data[p+2] = v;
    image.data[p+3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

export function encodeBase64(pixels) {
  let binary = "";
  for (let i = 0; i < pixels.length; i++) binary += String.fromCharCode(pixels[i]);
  return btoa(binary);
}
