export const MAX_PREVIEW_SPEECH_BYTES = 2 * 1024 * 1024;

export function debugDeerTrigger() {
  throw new Error("通知テストはローカル版で使用してください。");
}

export function announcementFrontPoseReady(yaw, pitch) {
  return Number.isFinite(yaw) && Number.isFinite(pitch) && Math.abs(yaw) < 0.1 && Math.abs(pitch - 30) < 0.1;
}

export function announcementDeviceProgress(status) {
  return status === "queued"
    ? "通知を受け付けました。会話や先の通知が終わったあと、首を正面へ向けて再生します。"
    : "実機へ送信しました。首を正面へ向けて通知し、再生の完了を待っています。";
}

export function announcementIntroTiming(steps, faceFrames, elapsedMs) {
  const duration = (items, key) => items.slice(0, 4).reduce((total, item) => total + item[key], 0);
  const lastFrameStarts = (items, key) => items.slice(0, Math.min(4, items.length) - 1)
    .reduce((total, item) => total + item[key], 0);
  const motionDuration = duration(steps, "ms"), faceDuration = duration(faceFrames, "durationMs");
  if (!motionDuration || !faceDuration) throw new RangeError("ALERTのコマを確認してください。");
  return {
    motionElapsedMs: Math.min(Math.max(elapsedMs, 0), motionDuration - 1),
    faceElapsedMs: Math.min(Math.max(elapsedMs, 0), faceDuration - 1),
    ready: elapsedMs >= Math.max(lastFrameStarts(steps, "ms"), lastFrameStarts(faceFrames, "durationMs")),
  };
}

// Own one fully loaded WAV. Changing the emotion or replaying invalidates an
// unfinished fetch and releases the old audio, so late responses cannot play.
export function createPreparedAnnouncementAudio({fetchImpl = fetch, AudioClass = Audio, urlApi = URL} = {}) {
  let generation = 0, audio = null, objectUrl = null, request = null, cancelReady = null;
  function clear() {
    generation += 1;
    request?.abort(); request = null;
    cancelReady?.(); cancelReady = null;
    if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); audio = null; }
    if (objectUrl) { urlApi.revokeObjectURL(objectUrl); objectUrl = null; }
  }
  async function prepare(trigger) {
    clear();
    const current = generation;
    request = new AbortController();
    try {
      const response = await fetchImpl("/api/inari/debug/deer/speech", {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(trigger),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(65000)]),
      });
      if (current !== generation) throw new DOMException("Cancelled", "AbortError");
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(typeof result?.error === "string" ? result.error : "読み上げ音声を準備できませんでした。");
      }
      const mime = response.headers.get("content-type")?.split(";", 1)[0].trim();
      const blob = await response.blob();
      if (current !== generation) throw new DOMException("Cancelled", "AbortError");
      if (!["audio/wav", "audio/x-wav"].includes(mime) || !blob.size || blob.size > MAX_PREVIEW_SPEECH_BYTES)
        throw new Error("読み上げ音声の形式を確認できませんでした。");
      audio = new AudioClass(); audio.preload = "auto";
      objectUrl = urlApi.createObjectURL(blob);
      const readyAudio = audio;
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          readyAudio.removeEventListener("canplay", loaded);
          readyAudio.removeEventListener("error", failed);
          cancelReady = null;
        };
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error("読み上げ音声を再生できませんでした。")); };
        cancelReady = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
        const timeout = setTimeout(failed, 10000);
        readyAudio.addEventListener("canplay", loaded, {once: true});
        readyAudio.addEventListener("error", failed, {once: true});
        readyAudio.src = objectUrl; readyAudio.load();
        if (readyAudio.readyState >= 3) loaded();
      });
      if (current !== generation) throw new DOMException("Cancelled", "AbortError");
      request = null;
    } catch (error) {
      if (current === generation) clear();
      throw error;
    }
  }
  function play({onStarted, onEnded, onError}) {
    if (!audio || audio.readyState < 3) { onError(); return; }
    const currentAudio = audio;
    let started = false;
    currentAudio.onplaying = () => {
      if (audio === currentAudio && !started) { started = true; onStarted(); }
    };
    currentAudio.onended = () => { if (audio === currentAudio) onEnded(); };
    currentAudio.onerror = () => { if (audio === currentAudio) onError(); };
    currentAudio.play().catch(() => { if (audio === currentAudio) onError(); });
  }
  return {prepare, play, clear, pause: () => audio?.pause(), resume: () => audio?.play().catch(() => {})};
}

export function announcementPhotoRect(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new RangeError("表示画像の大きさを確認できませんでした。");
  const scale = Math.min(310 / width, 240 / height);
  const displayWidth = width * scale, displayHeight = height * scale;
  return {x: (320 - displayWidth) / 2, y: (240 - displayHeight) / 2,
    width: displayWidth, height: displayHeight};
}

export function drawAnnouncementPhoto(image, ...canvases) {
  const rect = announcementPhotoRect(image.naturalWidth, image.naturalHeight);
  for (const canvas of canvases) {
    canvas.width = 320; canvas.height = 240;
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, 320, 240);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }
  return rect;
}

// This runs only after speech ends. The generation binds fetch, decode and the
// display timer to that run; a late response cannot overwrite a new emotion.
export function createAnnouncementPhotoPreview({fetchImpl = fetch, ImageClass = Image, urlApi = URL,
  setTimer = setTimeout, clearTimer = clearTimeout} = {}) {
  let generation = 0, request = null, image = null, objectUrl = null, timer = null, cancelReady = null;
  function clear() {
    generation += 1;
    request?.abort(); request = null;
    cancelReady?.(); cancelReady = null;
    if (timer !== null) { clearTimer(timer); timer = null; }
    if (image) { image.onload = image.onerror = null; image.src = ""; image = null; }
    if (objectUrl) { urlApi.revokeObjectURL(objectUrl); objectUrl = null; }
  }
  async function show(trigger, {onShown, onFinished, onError}) {
    clear();
    const current = generation;
    request = new AbortController();
    try {
      const response = await fetchImpl("/api/inari/debug/deer/photo", {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(trigger),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
      });
      if (current !== generation) return;
      if (!response.ok) throw new Error("表示画像を取得できませんでした。");
      const mime = response.headers.get("content-type")?.split(";", 1)[0].trim();
      const blob = await response.blob();
      if (current !== generation) return;
      if (mime !== "image/jpeg" || blob.size < 4 || blob.size > 128 * 1024)
        throw new Error("表示画像の形式を確認できませんでした。");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (current !== generation) return;
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9)
        throw new Error("表示画像を読み込めませんでした。");
      image = new ImageClass();
      objectUrl = urlApi.createObjectURL(blob);
      const currentImage = image;
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          clearTimer(timeout);
          currentImage.onload = currentImage.onerror = null;
          cancelReady = null;
        };
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error("表示画像を読み込めませんでした。")); };
        cancelReady = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
        const timeout = setTimer(failed, 10000);
        currentImage.onload = loaded; currentImage.onerror = failed;
        currentImage.src = objectUrl;
        if (currentImage.complete && currentImage.naturalWidth > 0) loaded();
      });
      if (current !== generation) return;
      const rect = announcementPhotoRect(currentImage.naturalWidth, currentImage.naturalHeight);
      onShown(currentImage, rect);
      timer = setTimer(() => {
        if (current !== generation) return;
        clear();
        onFinished();
      }, 30000);
      request = null;
    } catch (error) {
      if (current === generation) { clear(); onError(error); }
    }
  }
  return {show, clear};
}
