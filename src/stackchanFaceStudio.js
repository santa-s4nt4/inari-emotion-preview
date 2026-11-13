import { FACE_TYPES } from "./stackchanMotionDraft.js";
import {
  FACE_WIDTH, FACE_HEIGHT, FACE_FORMAT, FACE_ENCODING, FACE_DESIGN_FORMAT, DEFAULT_FACE_PRESETS,
  defaultPresets, validatePreset, validateFaceDesign, drawFace, packFacePixels, paintPackedFace, encodeBase64, drawFoxWhiskers,
  EYE_MODES, MOUTH_MODES, SWEAT_MODES, BROW_SIDES,
} from "./stackchanFaceData.js";

const STORAGE_KEY = "inari-stackchan-face-presets-v1";
const $ = (id) => document.getElementById(id);
export const FACE_FIELDS = [
  ["eyeMode", "目の形", EYE_MODES, ["丸い目", "楕円", "見開く", "閉じる", "笑う目", "ツリ目"]],
  ["eyeRadius", "目の大きさ", 4, 18],
  ["eyeWidth", "目の幅", 6, 36], ["eyeHeight", "目の高さ（形）", 8, 42],
  ["eyeY", "目の高さ", 70, 125],
  ["leftEyeOffsetY", "左目の上下", -25, 25], ["rightEyeOffsetY", "右目の上下", -25, 25],
  ["eyeSpacing", "目の間隔", 100, 170],
  ["gazeX", "視線の左右", -12, 12],
  ["browSide", "眉を表示", BROW_SIDES, ["なし", "左だけ", "右だけ", "両方"]],
  ["browY", "眉の高さ", 48, 90],
  ["browLeftX", "左眉の左右", -20, 20], ["browRightX", "右眉の左右", -20, 20],
  ["browWidth", "眉の長さ", 10, 45], ["browThickness", "眉の太さ", 2, 8],
  ["browLeftTilt", "左眉の傾き", -16, 16],
  ["browRightTilt", "右眉の傾き", -16, 16],
  ["mouthMode", "口の形", MOUTH_MODES, ["まっすぐ", "笑顔", "開ける", "小さな口"]],
  ["mouthWidth", "口の幅", 8, 90],
  ["mouthHeight", "口の開き", 4, 24],
  ["mouthY", "口の高さ", 125, 175], ["mouthOffsetX", "口の左右", -50, 50],
  ["sweat", "汗", SWEAT_MODES, ["なし", "左", "右"]],
  ["sweatOffsetX", "汗の左右", -30, 30], ["sweatOffsetY", "汗の上下", -30, 30],
  ["sweatSize", "汗の大きさ", 4, 24],
];

function restorePresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && Object.keys(parsed).sort().join() === [...FACE_TYPES].sort().join() &&
        FACE_TYPES.every((name) => validatePreset(parsed[name]))) return parsed;
  } catch { /* Use the bundled defaults. */ }
  return defaultPresets();
}

function makeOption(value, text) {
  const option = document.createElement("option");
  option.value = value; option.textContent = text;
  return option;
}

export function createFaceStudio(onChange) {
  const presets = restorePresets();
  const rendered = new Map();
  const faceSelect = $("facePreset");
  const preview = $("facePreview");
  const previewCtx = preview.getContext("2d", {willReadFrequently:false});
  const controls = $("faceControls");
  let selected = "neutral";
  let override = null;

  function faceImage(name) {
    if (!FACE_TYPES.includes(name)) throw new RangeError("表情名を確認してください。");
    if (rendered.has(name)) return rendered.get(name);
    const canvas = document.createElement("canvas");
    canvas.width = FACE_WIDTH; canvas.height = FACE_HEIGHT;
    const ctx = canvas.getContext("2d", {willReadFrequently:true});
    drawFace(ctx, presets[name]);
    const pixels = packFacePixels(ctx.getImageData(0,0,FACE_WIDTH,FACE_HEIGHT).data);
    paintPackedFace(ctx, pixels);
    drawFoxWhiskers(ctx);
    const image = {canvas, pixels};
    rendered.set(name, image);
    return image;
  }

  function renderPreview() {
    previewCtx.imageSmoothingEnabled = false;
    previewCtx.clearRect(0,0,FACE_WIDTH,FACE_HEIGHT);
    previewCtx.drawImage(faceImage(selected).canvas,0,0);
    $("faceStatus").textContent = override
      ? `${selected} を3Dに固定表示中。編集内容はこのブラウザに保存されます。`
      : `${selected} を編集中。3Dは再生中の表情を表示しています。`;
    $("followFacePlayback").disabled = override === null;
  }

  function renderControls() {
    controls.replaceChildren();
    for (const [key, label, spec, extra] of FACE_FIELDS) {
      const wrapper = document.createElement("label");
      wrapper.className = key === "browVisible" ? "face-control face-control-check" : "face-control";
      const text = document.createElement("span"); text.textContent = label;
      let input;
      if (Array.isArray(spec)) {
        input = document.createElement("select");
        spec.forEach((value,index) => input.append(makeOption(value, extra[index])));
        input.value = presets[selected][key];
      } else {
        input = document.createElement("input");
        input.type = spec === "checkbox" ? "checkbox" : "number";
        if (spec === "checkbox") input.checked = presets[selected][key];
        else { input.min = String(spec); input.max = String(extra); input.step = "1"; input.value = String(presets[selected][key]); }
      }
      input.setAttribute("aria-label", label);
      input.addEventListener("change", () => {
        const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
        const next = {...presets[selected], [key]:value};
        if (!validatePreset(next)) {
          if (input.type === "checkbox") input.checked = presets[selected][key];
          else input.value = String(presets[selected][key]);
          return;
        }
        presets[selected] = next;
        rendered.delete(selected);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch { /* Preview still works. */ }
        override = selected;
        renderPreview();
        onChange();
      });
      wrapper.append(text,input); controls.append(wrapper);
    }
  }

  FACE_TYPES.forEach((name) => faceSelect.append(makeOption(name,name)));
  FACE_TYPES.forEach((name) => $("copyFaceSource").append(makeOption(name,name)));
  faceSelect.value = selected;
  faceSelect.addEventListener("change", () => {
    selected = faceSelect.value; override = selected;
    renderControls(); renderPreview(); onChange();
  });
  $("resetFacePreset").addEventListener("click", () => {
    presets[selected] = {...DEFAULT_FACE_PRESETS[selected]};
    rendered.delete(selected); override = selected;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch { /* Preview still works. */ }
    renderControls(); renderPreview(); onChange();
  });
  $("copyFacePreset").addEventListener("click", () => {
    const source = $("copyFaceSource").value;
    if (!FACE_TYPES.includes(source)) return;
    presets[selected] = {...presets[source]};
    rendered.delete(selected); override = selected;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch { /* Preview still works. */ }
    renderControls(); renderPreview(); onChange();
  });
  $("followFacePlayback").addEventListener("click", () => {
    override = null; renderPreview(); onChange();
  });
  $("importFaceDesign").addEventListener("click", () => $("faceDesignFile").click());
  $("faceDesignFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new RangeError("ファイルが大きすぎます。");
      const raw = JSON.parse(await file.text());
      const design = raw.format === "inari-stackchan-design-v1" ? raw.faceDesign : raw;
      if (!validateFaceDesign(design)) throw new RangeError("顔の編集設定を読み込めませんでした。");
      for (const name of FACE_TYPES) presets[name] = {...design.presets[name]};
      rendered.clear();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
      override = selected;
      renderControls(); renderPreview(); onChange();
      $("faceStatus").textContent = "顔の編集設定を読み込みました。";
    } catch (error) {
      $("faceStatus").textContent = error instanceof Error ? error.message : "顔の編集設定を読み込めませんでした。";
    } finally { event.target.value = ""; }
  });

  renderControls(); renderPreview();
  return {
    preset(name) {
      if (!FACE_TYPES.includes(name)) throw new RangeError("表情名を確認してください。");
      return {...presets[name]};
    },
    isOverriding() { return override !== null; },
    faceCanvas(name) { return faceImage(override || name).canvas; },
    followPlayback() { override = null; renderPreview(); },
    facesJson() {
      return {
        format: FACE_FORMAT, width: FACE_WIDTH, height: FACE_HEIGHT, encoding: FACE_ENCODING,
        faces: Object.fromEntries(FACE_TYPES.map((name) => [name, {pixels:encodeBase64(faceImage(name).pixels)}])),
      };
    },
    faceDesign() {
      return {format:FACE_DESIGN_FORMAT, presets:Object.fromEntries(FACE_TYPES.map((name) => [name,{...presets[name]}]))};
    },
  };
}
