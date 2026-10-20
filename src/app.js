import { EMOTION_ORDER, getEmotion } from "./emotionCatalog.js?v=11";
import { EmotionPlayer } from "./emotionPlayer.js?v=11";
import { mountCharacterSwitch } from "./characterSwitch.js?v=11";

const sprite = document.getElementById("sprite");
const frameCount = document.getElementById("frameCount");
const directButtons = document.getElementById("directButtons");
const motionToggle = document.getElementById("motionToggle");
let selectedName = "NEUTRAL";

const player = new EmotionPlayer(sprite, (frame, total) => {
  frameCount.textContent = `FRAME ${String(frame).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
});
mountCharacterSwitch(player);

for (const name of EMOTION_ORDER) {
  const config = getEmotion(name);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "direct-button";
  button.dataset.emotion = name;
  button.innerHTML = `<strong>${name}</strong><span>${config.label}</span>`;
  button.addEventListener("click", () => playEmotion(name));
  directButtons.append(button);
}

export function playEmotion(name) {
  const config = getEmotion(name);
  selectedName = name;
  player.playEmotion(name);

  document.getElementById("emotionName").textContent = name;
  document.getElementById("emotionNameJa").textContent = config.label;
  document.getElementById("emotionDescription").textContent = config.description;
  document.getElementById("specFace").textContent = config.face;
  document.getElementById("specMotion").textContent = config.motion;
  document.getElementById("specSpeed").textContent = config.speed;
  document.getElementById("specPlayback").textContent = config.playback === "loop" ? "loop" : "one-shot／デモloop";
  document.getElementById("sequencePosition").textContent =
    `${String(EMOTION_ORDER.indexOf(name) + 1).padStart(2, "0")} / 10`;
  document.getElementById("playbackGuide").textContent = config.playback === "loop"
    ? `${name}の動きを繰り返し再生しています。`
    : `${name}は本来1回の動きです。比較用デモでは繰り返し再生しています。`;
  for (const button of directButtons.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.emotion === name));
  }
  motionToggle.textContent = "一時停止";
  motionToggle.setAttribute("aria-pressed", "false");
}

function moveSelection(offset) {
  const index = EMOTION_ORDER.indexOf(selectedName);
  playEmotion(EMOTION_ORDER[(index + offset + EMOTION_ORDER.length) % EMOTION_ORDER.length]);
}

document.getElementById("previousEmotion").addEventListener("click", () => moveSelection(-1));
document.getElementById("nextEmotion").addEventListener("click", () => moveSelection(1));
document.getElementById("replayEmotion").addEventListener("click", () => playEmotion(selectedName));

motionToggle.addEventListener("click", () => {
  const pause = motionToggle.getAttribute("aria-pressed") !== "true";
  player.setPaused(pause);
  motionToggle.setAttribute("aria-pressed", String(pause));
  motionToggle.textContent = pause ? "再生" : "一時停止";
});

// The demo is intentionally manual. No event selection, AI, JEV, or sensor path runs here.
window.playEmotion = playEmotion;
playEmotion("NEUTRAL");
