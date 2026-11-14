import { FACE_TYPES } from "./stackchanMotionDraft.js";

export const FACE_WIDTH = 320;
export const FACE_HEIGHT = 240;
export const FACE_FORMAT = "inari-stackchan-faces-v1";
export const FACE_ENCODING = "mono-msb-row-major-v1";
export const FACE_DESIGN_FORMAT = "inari-stackchan-face-design-v2";
export const EYE_MODES = Object.freeze(["dot", "ellipse", "wide", "closed", "smile", "fox"]);
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
  alert: withBase({ eyeMode: "dot", eyeRadius: 12, browSide: "both", browY: 63, browThickness: 2, mouthMode: "open", mouthWidth: 30, mouthHeight: 13 }),
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
    // Both eyes lean outward; closed and smiling eyes keep their own silhouette.
    ctx.save();
    ctx.translate(x, y);
    const direction = index === 0 ? 1 : -1;
    const angle = {fox:20, closed:9, smile:7}[preset.eyeMode] ?? 14;
    ctx.rotate(direction * angle * Math.PI / 180);
    if (preset.eyeMode === "closed") {
      ctx.ellipse(0, 0, r, 1.8, 0, 0, 2 * Math.PI);
      ctx.fill();
    } else if (preset.eyeMode === "smile") {
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.moveTo(-r, 3);
      ctx.quadraticCurveTo(0, 1-r, r, 3);
      ctx.stroke();
    } else {
      const [rx, ry] = {
        dot: [r * 1.55, r * 1.12],
        wide: [r * 1.16, r * 1.52],
        ellipse: [preset.eyeWidth / 2, preset.eyeHeight / 2],
        fox: [preset.eyeWidth / 2, preset.eyeHeight * 0.33],
      }[preset.eyeMode];
      ctx.ellipse(0, 0, rx, ry, 0, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
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
  ctx.beginPath();
  ctx.ellipse(160, 118, 12, 6, 0, 0, 2 * Math.PI);
  ctx.fill();

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

const MARK_BOUNDS = {x:240, y:12, width:72, height:160};
const COLD_MARK_BOUNDS = {x:160, y:40, width:120, height:104};
const THINKING_SPINNER_BOUNDS = {x:248, y:14, width:64, height:50};
const SPINNER_OFFSETS = [[0,-16],[11,-11],[16,0],[11,11],[0,16],[-11,11],[-16,0],[-11,-11]];
const SPINNER_RADII = [4.5,4,3.5,3,2.5,2,1.5,1];
const SPINNER_GREYS = ["#505050","#656565","#787878","#8b8b8b","#a0a0a0","#b6b6b6","#ccc","#e0e0e0"];

export function thinkingSpinnerPhase(elapsedMs) {
  return Math.floor(elapsedMs / 100) % SPINNER_OFFSETS.length;
}

export function drawThinkingSpinner(ctx, phase, mono = false) {
  ctx.save();
  for (let index = 0; index < SPINNER_OFFSETS.length; index++) {
    const [x,y] = SPINNER_OFFSETS[index];
    const tail = (phase - index + SPINNER_OFFSETS.length) % SPINNER_OFFSETS.length;
    ctx.fillStyle = mono ? "#000" : SPINNER_GREYS[tail];
    ctx.beginPath();
    ctx.arc(280 + x, 39 + y, SPINNER_RADII[tail], 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFoxWhiskers(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.strokeStyle = "#929292";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (const side of [1,-1]) {
    const x = (value) => side === 1 ? value : FACE_WIDTH - value;
    ctx.beginPath();
    for (const [x1,y1,x2,y2] of [[66,133,39,123],[64,140,34,139],[66,147,42,156]]) {
      ctx.moveTo(x(x1), y1);
      ctx.lineTo(x(x2), y2);
    }
    ctx.stroke();
  }
  ctx.restore();
}
const CAPTION_BOUNDS = {x:120, y:8, width:192, height:48};

export function environmentMarkBounds(emotion) {
  if (emotion === "THINKING") return THINKING_SPINNER_BOUNDS;
  if (emotion === "CHEERFUL") return CAPTION_BOUNDS;
  if (emotion === "COLD") return COLD_MARK_BOUNDS;
  if (["HOT","DRY_SOIL","WET_SOIL","DRY_AIR","HUMID_AIR"].includes(emotion)) return MARK_BOUNDS;
  return null;
}

// Use the same LCD coordinates for the preview, exported frames and USB mask.
export function drawEnvironmentMark(ctx, emotion, frameIndex) {
  if (!environmentMarkBounds(emotion)) return;
  if (emotion === "THINKING") {
    drawThinkingSpinner(ctx, frameIndex % SPINNER_OFFSETS.length, true);
    return;
  }
  const sway = [0, 3, 0, -3][frameIndex % 4];
  ctx.save();
  ctx.translate(274, 34);
  ctx.fillStyle = ctx.strokeStyle = "#000";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  const line = (points) => {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.stroke();
  };
  const drop = (x, y, size) => {
    ctx.beginPath();
    ctx.moveTo(x, y-size);
    ctx.bezierCurveTo(x+size, y, x+size, y+size, x, y+size);
    ctx.bezierCurveTo(x-size, y+size, x-size, y, x, y-size);
    ctx.fill();
  };
  switch (emotion) {
    case "COLD": {
      const top = frameIndex % 2 ? 14 : 11;
      line([[-21+sway,top],[-21+sway,top+17]]);
      line([[-12+sway,top],[-12+sway,top+24]]);
      line([[-3+sway,top],[-3+sway,top+24]]);

      const dripLength = [0, 7, 14, 22, 16, 9, 0, 0][frameIndex % 8];
      if (dripLength) {
        const x = -104, y = 85;
        const width = Math.min(7, 2 + dripLength/5);
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.bezierCurveTo(x+width,y+dripLength*0.45,x+width,y+dripLength,x,y+dripLength);
        ctx.bezierCurveTo(x-width,y+dripLength,x-width,y+dripLength*0.45,x,y);
        ctx.fill();
      }
      break;
    }
    case "HOT":
      drop(-18, 11 + (frameIndex * 19) % 102, 7);
      drop(0, 11 + (frameIndex * 19 + 34) % 102, 9);
      drop(19, 11 + (frameIndex * 19 + 68) % 102, 6);
      break;
    case "HUMID_AIR": {
      const fall = [0, 9, 15, 6][frameIndex % 4];
      drop(-16 + sway, 12 + fall, 7);
      drop(0 + sway, 4 + fall, 9);
      drop(18 + sway, 17 + fall, 6);
      break;
    }
    case "DRY_SOIL": {
      const dip = [0, 10, 16, 16, 12, 16, 6, 0][frameIndex % 8];
      ctx.translate(0, dip);
      line([[0,-13],[0,12]]);
      line([[-11,2],[0,13],[11,2]]);
      break;
    }
    case "WET_SOIL": {
      const impact = frameIndex === 2 || frameIndex === 4 || frameIndex === 6;
      const rise = impact ? 12 : 0;
      drop(-16-rise/2, 3-rise, impact ? 6 : 4);
      drop(0, -2-rise, impact ? 7 : 4);
      drop(16+rise/2, 3-rise, impact ? 6 : 4);
      line([[-20,18],[-9,18],[0,13],[9,18],[20,18]]);
      break;
    }
    case "DRY_AIR": {
      const gust = frameIndex === 2;
      ctx.translate(sway * 2, frameIndex % 4 * 3);
      line([[-18,-8],[gust?10:4,-8],[gust?17:10,-14]]);
      line([[-13,2],[gust?20:12,2]]);
      line([[-19,12],[gust?6:0,12],[gust?13:6,17]]);
      break;
    }
    case "CHEERFUL":
      ctx.font = 'bold 22px "Hiragino Sans", "Noto Sans JP", sans-serif';
      ctx.textAlign = "right";
      ctx.fillText("みまわり順調♪", 20 + sway, 4 - Math.abs(sway));
      break;
  }
  ctx.restore();
}

// The USB payload contains only the mark, leaving the editable face and
// live mouth in the existing device renderer.
export function encodeEnvironmentMark(ctx, emotion, frameIndex) {
  const bounds = environmentMarkBounds(emotion);
  if (!bounds) return undefined;
  const {x,y,width,height} = bounds;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x,y,width,height);
  drawEnvironmentMark(ctx, emotion, frameIndex);
  const rgba = ctx.getImageData(x,y,width,height).data;
  const stride = width / 8;
  const pixels = new Uint8Array(stride * height);
  let left = stride, right = -1, top = height, bottom = -1;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (rgba[(row * width + col) * 4] >= 128) continue;
      const byte = col >> 3;
      pixels[row * stride + byte] |= 0x80 >> (col & 7);
      left = Math.min(left, byte);
      right = Math.max(right, byte);
      top = Math.min(top, row);
      bottom = Math.max(bottom, row);
    }
  }
  if (right < left) return undefined;
  const croppedStride = right - left + 1;
  const croppedHeight = bottom - top + 1;
  const cropped = new Uint8Array(croppedStride * croppedHeight);
  for (let row = 0; row < croppedHeight; row++) {
    const start = (top + row) * stride + left;
    cropped.set(pixels.subarray(start, start + croppedStride), row * croppedStride);
  }
  return {x:x + left*8, y:y + top, width:croppedStride*8, height:croppedHeight, pixels:encodeBase64(cropped)};
}
