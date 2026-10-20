import { CHARACTER_STYLES, getArtworkFile, getEmotion } from "./emotionCatalog.js?v=16";

export class EmotionPlayer {
  constructor(spriteElement, onFrame = () => {}, onComplete = () => {}, { loopPreview = true, visualStyle = "stackchan" } = {}) {
    this.sprite = spriteElement;
    this.body = spriteElement.querySelector?.(".sprite-body") ?? spriteElement;
    this.onFrame = onFrame;
    this.onComplete = onComplete;
    this.loopPreview = loopPreview;
    if (!Object.hasOwn(CHARACTER_STYLES, visualStyle)) throw new RangeError("Unknown INARI character style: " + visualStyle);
    this.visualStyle = visualStyle;
    this.timer = null;
    this.emotion = null;
    this.frameIndex = 0;
    this.paused = false;
    this.complete = false;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(spriteElement);
    this.reducedMotion.addEventListener?.("change", () => this.playEmotion(this.emotion ?? "NEUTRAL"));
  }

  playEmotion(name) {
    getEmotion(name);
    this.emotion = name;
    this.frameIndex = 0;
    this.paused = false;
    this.complete = false;
    clearTimeout(this.timer);
    this.render();
    this.scheduleNext();
  }

  play(name) { this.playEmotion(name); }

  setVisualStyle(style) {
    if (!Object.hasOwn(CHARACTER_STYLES, style)) throw new RangeError("Unknown INARI character style: " + style);
    this.visualStyle = style;
    this.render();
  }

  setPaused(paused) {
    this.paused = paused;
    clearTimeout(this.timer);
    if (!paused) this.scheduleNext();
  }

  scheduleNext() {
    if (this.paused || this.complete || this.reducedMotion.matches || !this.emotion) return;
    const config = getEmotion(this.emotion);
    this.timer = window.setTimeout(() => {
      if (!this.loopPreview && config.playback === "once" && this.frameIndex === config.steps.length - 1) {
        this.complete = true;
        this.onComplete(this.emotion);
        return;
      }
      this.frameIndex = (this.frameIndex + 1) % config.steps.length;
      this.render();
      this.scheduleNext();
    }, config.steps[this.frameIndex].ms);
  }

  render() {
    if (!this.emotion) return;
    const config = getEmotion(this.emotion);
    const index = this.reducedMotion.matches && config.playback === "once"
      ? config.steps.length - 1 : this.reducedMotion.matches ? 0 : this.frameIndex;
    const current = config.steps[index];
    const artwork = current.artwork ?? this.emotion;
    const width = this.sprite.clientWidth;
    const height = this.sprite.clientHeight || width;
    this.body.style.backgroundImage = `url("${new URL(getArtworkFile(this.visualStyle, artwork), import.meta.url).href}")`;
    this.body.style.backgroundSize = `${width}px ${height}px`;
    this.body.style.backgroundPosition = "center";
    const [x, y, angle, scaleX = 1, scaleY = 1] = this.reducedMotion.matches
      ? [0, 0, 0]
      : current.pose;
    const poseScale = width / 192;
    this.sprite.style.transitionDuration = `${Math.min(480, Math.round(current.ms * 0.65))}ms`;
    this.sprite.style.transform = `translate(${x * poseScale}px, ${y * poseScale}px) rotate(${angle}deg) scale(${scaleX}, ${scaleY})`;
    this.sprite.dataset.emotion = this.emotion;
    this.sprite.dataset.artwork = artwork;
    this.sprite.dataset.characterStyle = this.visualStyle;
    this.sprite.setAttribute("aria-label", `INARI ${CHARACTER_STYLES[this.visualStyle]}: ${this.emotion}、${config.label}`);
    this.onFrame(index + 1, config.steps.length);
  }

  destroy() {
    clearTimeout(this.timer);
    this.resizeObserver.disconnect();
  }
}
