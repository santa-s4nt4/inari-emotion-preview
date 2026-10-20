import { CHARACTER_STYLES } from "./emotionCatalog.js?v=15";

const STORAGE_KEY = "inari-character-style";

export function mountCharacterSwitch(player, root = document) {
  const inputs = [...root.querySelectorAll('input[name="characterStyle"]')];
  if (inputs.length !== Object.keys(CHARACTER_STYLES).length) {
    throw new Error("Character style switch is incomplete.");
  }

  let saved;
  try { saved = window.localStorage.getItem(STORAGE_KEY); } catch { /* Private browsing may disable storage. */ }
  const initial = Object.hasOwn(CHARACTER_STYLES, saved) ? saved : "stackchan";
  player.setVisualStyle(initial);
  for (const input of inputs) {
    input.checked = input.value === initial;
    input.addEventListener("change", () => {
      if (!input.checked || !Object.hasOwn(CHARACTER_STYLES, input.value)) return;
      player.setVisualStyle(input.value);
      try { window.localStorage.setItem(STORAGE_KEY, input.value); } catch { /* Keep the current tab usable. */ }
    });
  }
}
