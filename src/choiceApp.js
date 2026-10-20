import { EMOTION_ORDER, getEmotion } from "./emotionCatalog.js?v=16";
import { EmotionPlayer } from "./emotionPlayer.js?v=16";
import { mountCharacterSwitch } from "./characterSwitch.js?v=16";

const sprite = document.getElementById("sprite");
const frameCount = document.getElementById("frameCount");
const form = document.getElementById("choiceForm");
const input = document.getElementById("situationInput");
const submit = document.getElementById("choiceSubmit");
const status = document.getElementById("choiceStatus");
const motionToggle = document.getElementById("motionToggle");
const rows = document.getElementById("probabilityRows");
const player = new EmotionPlayer(sprite, (frame, total) => {
  frameCount.textContent = `FRAME ${String(frame).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
});
mountCharacterSwitch(player);

for (const emotion of EMOTION_ORDER) {
  const row = document.createElement("tr");
  const name = document.createElement("th");
  name.scope = "row";
  name.textContent = emotion;
  const value = document.createElement("td");
  value.dataset.emotion = emotion;
  value.textContent = "—";
  row.append(name, value);
  rows.append(row);
}

function playEmotion(name) {
  const config = getEmotion(name);
  player.playEmotion(name);
  document.getElementById("emotionName").textContent = name;
  document.getElementById("emotionNameJa").textContent = config.label;
  document.getElementById("emotionDescription").textContent = config.description;
  motionToggle.textContent = "一時停止";
  motionToggle.setAttribute("aria-pressed", "false");
}

function showDecision(result) {
  const { emotion, confidence, probabilities } = result;
  if (!EMOTION_ORDER.includes(emotion) || typeof confidence !== "number" ||
      !probabilities || EMOTION_ORDER.some((name) => typeof probabilities[name] !== "number")) {
    throw new Error("判定結果を確認できませんでした。アニメーションは変更していません。");
  }
  document.getElementById("selectedEmotion").textContent = emotion;
  document.getElementById("debugEmotion").textContent = emotion;
  document.getElementById("debugConfidence").textContent = String(confidence);
  for (const name of EMOTION_ORDER) {
    rows.querySelector(`[data-emotion="${name}"]`).textContent = String(probabilities[name]);
  }
  playEmotion(emotion);
  status.textContent = `${emotion} を選びました。`;
  status.dataset.state = "success";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const situation = input.value.trim();
  if (!situation) return;
  submit.disabled = true;
  status.dataset.state = "loading";
  status.textContent = "Jevが状況を判定しています…";
  try {
    const response = await fetch("/api/inari/emotion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situation }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Jevの判定に失敗しました。");
    showDecision(result);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "判定に失敗しました。";
    status.dataset.state = "error";
    // Keep the current emotion visible. Never guess a fallback emotion.
  } finally {
    submit.disabled = false;
  }
});

motionToggle.addEventListener("click", () => {
  const pause = motionToggle.getAttribute("aria-pressed") !== "true";
  player.setPaused(pause);
  motionToggle.setAttribute("aria-pressed", String(pause));
  motionToggle.textContent = pause ? "再生" : "一時停止";
});

playEmotion("NEUTRAL");
