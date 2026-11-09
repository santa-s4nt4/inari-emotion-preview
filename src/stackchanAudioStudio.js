import { EMOTION_ORDER } from "./emotionCatalog.js";

export const AUDIO_FORMAT = "inari-stackchan-audio-v1";
export const MAX_AUDIO_FILE_BYTES = 1024 * 1024;
export const MAX_AUDIO_TOTAL_BYTES = 1024 * 1024;
export const MAX_AUDIO_DURATION_MS = 30000;
export const MAX_SE_CUE_MS = 30000;
const STORE_KEY = "inari-stackchan-audio-design-v1";
const DB_NAME = "inari-stackchan-audio-v1";
const DB_STORE = "assets";
const emptySetting = () => ({ mode: "none", assetId: null, cueMs: 0 });

function validSetting(setting) {
  return setting && typeof setting === "object" && !Array.isArray(setting) &&
    Object.keys(setting).sort().join() === "assetId,cueMs,mode" &&
    ["none", "se", "bgm"].includes(setting.mode) &&
    (setting.assetId === null || typeof setting.assetId === "string") &&
    Number.isInteger(setting.cueMs) && setting.cueMs >= 0 && setting.cueMs <= MAX_SE_CUE_MS;
}

export function validateAudioConfig(config) {
  return config && typeof config === "object" && !Array.isArray(config) &&
    Object.keys(config).sort().join() === "emotions,format" &&
    config.format === AUDIO_FORMAT && config.emotions &&
    Object.keys(config.emotions).sort().join() === [...EMOTION_ORDER].sort().join() &&
    EMOTION_ORDER.every((name) => validSetting(config.emotions[name]));
}

export function compactAudioEmotions(emotions) {
  return Object.fromEntries(EMOTION_ORDER.map((name) => {
    const setting = emotions[name];
    if (setting.mode === "se") return [name,{mode:"se",assetId:setting.assetId,cueMs:setting.cueMs}];
    if (setting.mode === "bgm") return [name,{mode:"bgm",assetId:setting.assetId}];
    return [name,{mode:"none"}];
  }));
}

function legacyCueMs(name, cueStep, getTimelineSteps) {
  const steps=getTimelineSteps(name);
  if (!Array.isArray(steps) || !Number.isInteger(cueStep) || cueStep < 0 || cueStep >= steps.length)
    throw new RangeError(`${name} の古いSEステップを時間へ変換できません。`);
  return steps.slice(0,cueStep).reduce((sum,part)=>sum+Number(part.ms ?? part.durationMs),0);
}

export function normalizeAudioEmotions(emotions,getTimelineSteps=()=>[]) {
  if (!emotions || Object.keys(emotions).sort().join()!==[...EMOTION_ORDER].sort().join())
    throw new TypeError("音設定の感情を確認してください。");
  return Object.fromEntries(EMOTION_ORDER.map((name)=>{
    const source=emotions[name];
    if (!source || typeof source!=="object" || !["none","se","bgm"].includes(source.mode))
      throw new TypeError(`${name} の音設定を確認してください。`);
    const cueMs=source.cueMs ?? (source.cueStep===undefined ? 0 : legacyCueMs(name,source.cueStep,getTimelineSteps));
    const entry={mode:source.mode,assetId:source.assetId ?? null,cueMs};
    if (!validSetting(entry)) throw new RangeError(`${name} のSE時刻を確認してください。`);
    return [name,entry];
  }));
}

function loadSettings(getTimelineSteps) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (validateAudioConfig(saved)) return saved;
    if (saved?.format===AUDIO_FORMAT) {
      const upgraded={format:AUDIO_FORMAT,emotions:normalizeAudioEmotions(saved.emotions,getTimelineSteps)};
      if (validateAudioConfig(upgraded)) return upgraded;
    }
  } catch { /* First use or restricted storage. */ }
  return { format: AUDIO_FORMAT, emotions: Object.fromEntries(EMOTION_ORDER.map((name) => [name, emptySetting()])) };
}

function openAssetDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("このブラウザでは音声の保存を利用できません。")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function dbGet(id) {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function dbPut(id, value) {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function metadataDuration(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration * 1000);
      audio.src = "";
      Number.isFinite(duration) && duration > 0 ? resolve(duration) : reject(new Error("曲の長さを読み取れません。"));
    };
    audio.onerror = () => reject(new Error("MP3を再生できません。ファイルを確認してください。"));
    audio.src = url;
  });
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}

function isMp3(file, head) {
  const nameOkay = /\.mp3$/i.test(file.name);
  const magicOkay = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33 ||
    head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
  return nameOkay && magicOkay;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

export function createStackchanAudioStudio({root, getTimelineDuration, getTimelineSteps=()=>[], onChange = () => {}, onBgmEnd = () => {}}) {
  if (!root) throw new Error("音声エディタの表示領域がありません。");
  if (typeof getTimelineDuration!=="function") throw new Error("感情の再生時間が必要です。");
  let config = loadSettings(getTimelineSteps);
  const assets = new Map();
  let emotion = "NEUTRAL";
  let currentAudio = null;
  let currentObjectUrl = null;
  let currentMode = "none";
  let playToken = 0;
  let seFired = false;
  const header = createElement("div", "audio-studio-header");
  const heading = createElement("h2", "", "音の設定");
  const subtitle = createElement("p", "", "感情ごとに効果音またはBGMを選びます。MP3は書き込み時に実機用へ変換します。");
  header.append(heading, subtitle);
  const controls = createElement("div", "audio-studio-controls");
  const modeLabel = createElement("label", "", "再生方法");
  const mode = createElement("select", "");
  mode.setAttribute("aria-label", "音の再生方法");
  for (const [value, text] of [["none", "音なし"], ["se", "効果音 / SE"], ["bgm", "BGM"]]) {
    const item = createElement("option", "", text); item.value = value; mode.append(item);
  }
  modeLabel.append(mode);
  const fileLabel = createElement("label", "audio-file-drop", "MP3を選ぶ、またはここにドロップ");
  const fileInput = createElement("input", "");
  fileInput.type = "file"; fileInput.accept = ".mp3,audio/mpeg";
  fileLabel.append(fileInput);
  const assetInfo = createElement("p", "audio-asset-info", "音声ファイルはまだありません。");
  const cueLabel = createElement("label", "", "効果音を鳴らす時刻 (ms)");
  const cue = createElement("input", ""); cue.type="number"; cue.min="0"; cue.step="10";
  cue.setAttribute("aria-label", "効果音を鳴らす時刻 (ms)"); cueLabel.append(cue);
  const previewButton = createElement("button", "", "音を試聴"); previewButton.type = "button";
  const stopButton = createElement("button", "", "停止"); stopButton.type = "button";
  const feedback = createElement("p", "audio-feedback"); feedback.setAttribute("role", "status");
  const actions = createElement("div", "audio-actions"); actions.append(previewButton, stopButton);
  controls.append(modeLabel, fileLabel, assetInfo, cueLabel, actions, feedback);
  root.append(header, controls);

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(config)); } catch { /* This session remains usable. */ }
    onChange();
  }
  function setting(name = emotion) { return config.emotions[name]; }
  function stop() {
    ++playToken;
    if (currentAudio) { currentAudio.pause(); currentAudio.onended = null; currentAudio = null; }
    if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
    currentMode = "none";
  }
  async function getAsset(id) {
    if (assets.has(id)) return assets.get(id);
    const item = await dbGet(id);
    if (item) assets.set(id, item);
    return item;
  }
  async function playFile(name, previewOnly = false) {
    stop();
    const selected = setting(name);
    if (selected.mode === "none" || !selected.assetId) return false;
    const token = playToken;
    let item;
    try { item = await getAsset(selected.assetId); }
    catch { feedback.textContent = "保存された音声を読み込めません。MP3を選び直してください。"; return false; }
    if (!item || token !== playToken) {
      if (!item) feedback.textContent = "保存された音声が見つかりません。MP3を選び直してください。";
      return false;
    }
    currentObjectUrl = URL.createObjectURL(item.blob);
    currentAudio = new Audio(currentObjectUrl);
    currentMode = previewOnly ? "preview" : selected.mode;
    currentAudio.onended = () => {
      const wasBgm = currentMode === "bgm";
      stop();
      if (wasBgm) onBgmEnd(name);
    };
    try { await currentAudio.play(); return true; }
    catch { stop(); feedback.textContent = "ブラウザで音を鳴らせませんでした。試聴ボタンから再生してください。"; return false; }
  }
  async function importFile(file) {
    if (!file) return;
    feedback.textContent = "音声ファイルを確認中…";
    try {
      if (file.size > MAX_AUDIO_FILE_BYTES) throw new RangeError("MP3は1 MB以下にしてください。");
      const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
      if (!isMp3(file, head)) throw new TypeError("MP3ファイルを選んでください。");
      const url = URL.createObjectURL(file);
      let durationMs;
      try { durationMs = await metadataDuration(url); } finally { URL.revokeObjectURL(url); }
      if (durationMs > MAX_AUDIO_DURATION_MS) throw new RangeError("音声は30秒以内にしてください。");
      const id = crypto.randomUUID();
      const item = {name:file.name, blob:file, durationMs, byteLength:file.size};
      await dbPut(id,item); assets.set(id,item);
      setting().assetId = id; save(); render();
      feedback.textContent = `${file.name} を設定しました。`;
    } catch (error) { feedback.textContent = error instanceof Error ? error.message : "音声の取込に失敗しました。"; }
    fileInput.value = "";
  }
  function render() {
    const selected = setting();
    mode.value = selected.mode;
    const duration=Math.max(1,Math.round(Number(getTimelineDuration(emotion))||1));
    cue.max=String(Math.min(MAX_SE_CUE_MS,duration-1));
    cue.value=String(selected.cueMs);
    cueLabel.hidden = selected.mode !== "se";
    fileLabel.hidden = selected.mode === "none";
    previewButton.disabled = selected.mode === "none" || !selected.assetId;
    assetInfo.textContent = selected.assetId ? "音声を読み込み中…" : "音声ファイルはまだありません。";
    if (selected.assetId) getAsset(selected.assetId).then((item) => {
      if (selected.assetId !== setting().assetId) return;
      assetInfo.textContent = item
        ? `${item.name} · ${(item.durationMs / 1000).toFixed(1)}秒 · ${Math.round(item.byteLength / 1024)} KB`
        : "保存された音声が見つかりません。MP3を選び直してください。";
    }).catch(() => { assetInfo.textContent = "音声を読み込めません。"; });
  }
  mode.addEventListener("change", () => { stop(); setting().mode = mode.value; save(); render(); });
  cue.addEventListener("change", () => {
    const value=Number(cue.value);
    if (!Number.isInteger(value) || value<0 || value>Number(cue.max)) {
      cue.value=String(setting().cueMs);
      feedback.textContent=`0〜${cue.max} msで指定してください。`;
      return;
    }
    setting().cueMs=value; feedback.textContent=""; save();
  });
  fileInput.addEventListener("change", () => importFile(fileInput.files?.[0]));
  fileLabel.addEventListener("dragover", (event) => { event.preventDefault(); fileLabel.classList.add("dragging"); });
  fileLabel.addEventListener("dragleave", () => fileLabel.classList.remove("dragging"));
  fileLabel.addEventListener("drop", (event) => { event.preventDefault(); fileLabel.classList.remove("dragging"); importFile(event.dataTransfer.files?.[0]); });
  previewButton.addEventListener("click", () => playFile(emotion,true));
  stopButton.addEventListener("click", stop);
  render();
  return {
    setEmotion(name) { if (!EMOTION_ORDER.includes(name)) throw new RangeError("感情名を確認してください。"); emotion = name; render(); },
    play(name) { if (!EMOTION_ORDER.includes(name)) return; seFired=false; if (setting(name).mode === "bgm") playFile(name); else stop(); },
    onTime(name,elapsedMs) {
      const selected=setting(name);
      if (selected.mode==="se" && !seFired && elapsedMs>=selected.cueMs) {
        seFired=true; playFile(name);
      }
    },
    stop,
    isBgmPlaying() { return currentMode === "bgm" && currentAudio !== null && !currentAudio.paused && !currentAudio.ended; },
    async importConfig(source) {
      if (!source || source.format!==AUDIO_FORMAT || !Array.isArray(source.assets))
        throw new TypeError("読み込む音設定の形式を確認してください。");
      const emotions=normalizeAudioEmotions(source.emotions,getTimelineSteps);
      for (const name of EMOTION_ORDER) {
        const selected=emotions[name];
        const duration=Number(getTimelineDuration(name));
        if (selected.mode==="se" && (!Number.isFinite(duration) || selected.cueMs>=duration))
          throw new RangeError(`${name} のSE時刻が感情の再生時間を超えています。`);
      }
      const incoming=new Map();
      let compressed=0, estimatedPcm=0;
      for (const asset of source.assets) {
        if (!asset || Object.keys(asset).sort().join()!=="base64,durationMs,id,mimeType,name" ||
            asset.mimeType!=="audio/mpeg" || typeof asset.id!=="string" || !asset.id ||
            typeof asset.name!=="string" || !/\.mp3$/i.test(asset.name) ||
            !Number.isInteger(asset.durationMs) || asset.durationMs<1 || asset.durationMs>MAX_AUDIO_DURATION_MS ||
            typeof asset.base64!=="string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.base64) ||
            incoming.has(asset.id)) throw new TypeError("JSON内のMP3設定を確認してください。");
        let binary;
        try { binary=atob(asset.base64); } catch { throw new TypeError("JSON内のMP3を読み込めません。"); }
        const bytes=Uint8Array.from(binary,(character)=>character.charCodeAt(0));
        const blob=new Blob([bytes],{type:"audio/mpeg"});
        if (!isMp3({name:asset.name},bytes)) throw new TypeError("JSON内にMP3以外の音声があります。");
        compressed+=bytes.byteLength;
        estimatedPcm+=Math.ceil(asset.durationMs*32)+44;
        if (compressed>MAX_AUDIO_TOTAL_BYTES || estimatedPcm>MAX_AUDIO_TOTAL_BYTES)
          throw new RangeError("JSON内の音声合計が実機の容量を超えます。");
        incoming.set(asset.id,{name:asset.name,blob,durationMs:asset.durationMs,byteLength:bytes.byteLength});
      }
      for (const name of EMOTION_ORDER) {
        const selected=emotions[name];
        if (selected.mode!=="none" && !incoming.has(selected.assetId))
          throw new TypeError(`${name} の音声ファイルがJSONにありません。`);
      }
      for (const [id,item] of incoming) await dbPut(id,item);
      stop(); assets.clear();
      for (const [id,item] of incoming) assets.set(id,item);
      config={format:AUDIO_FORMAT,emotions}; seFired=false; save(); render();
      feedback.textContent="音設定とMP3を読み込みました。";
    },
    async exportConfig() {
      for (const name of EMOTION_ORDER)
        if (setting(name).mode !== "none" && !setting(name).assetId)
          throw new Error(`${name} の音声ファイルを選んでください。`);
      for (const name of EMOTION_ORDER) {
        const selected=setting(name);
        if (selected.mode==="se" && selected.cueMs>=Number(getTimelineDuration(name)))
          throw new RangeError(`${name} のSE時刻が感情の再生時間を超えています。`);
      }
      const used = [...new Set(EMOTION_ORDER.map((name) => setting(name)).filter((entry) => entry.mode !== "none").map((entry) => entry.assetId))];
      const exported = [];
      let totalBytes = 0, totalPcmBytes = 0;
      for (const id of used) {
        const item = await getAsset(id);
        if (!item) throw new Error("保存された音声が見つかりません。MP3を選び直してください。");
        if (!(item.blob instanceof Blob) || !Number.isInteger(item.byteLength) ||
            item.byteLength <= 0 || item.byteLength > MAX_AUDIO_FILE_BYTES ||
            !Number.isInteger(item.durationMs) || item.durationMs <= 0 ||
            item.durationMs > MAX_AUDIO_DURATION_MS)
          throw new Error("保存された音声が壊れています。MP3を選び直してください。");
        totalBytes += item.byteLength;
        if (totalBytes > MAX_AUDIO_TOTAL_BYTES) throw new RangeError("使用するMP3の合計を1 MB以下にしてください。");
        totalPcmBytes += Math.ceil(item.durationMs * 32) + 44;
        if (totalPcmBytes > MAX_AUDIO_TOTAL_BYTES)
          throw new RangeError("実機用に変換した音声が1 MBを超えます。使用する曲の合計を約30秒以内にしてください。");
        exported.push({id, name:item.name, mimeType:"audio/mpeg", base64:await fileToBase64(item.blob), durationMs:item.durationMs});
      }
      return {format:AUDIO_FORMAT, emotions:compactAudioEmotions(config.emotions), assets:exported};
    },
  };
}
