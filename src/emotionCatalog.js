// Each centered frame contains the complete face and body. Motion steps only
// choose whole drawings and small servo-like poses.
const step = (ms, pose = [0, 0, 0], artwork) => ({ ms, pose, artwork });

export const EMOTION_ORDER = Object.freeze([
  "NEUTRAL", "NOTICE", "CURIOUS", "ATTENTIVE", "HAPPY",
  "CELEBRATE", "CONCERN", "ALERT", "RELIEF", "REST",
]);

// These assets were extracted by character silhouette, not by dividing the
// source sheet into equal cells. That keeps neighboring characters out of view.
export const ARTWORK_FILES = Object.freeze({
  ...Object.fromEntries(EMOTION_ORDER.map((name) => [name, `../assets/emotions/${name}.png`])),
  ATTENTIVE_BLINK: "../assets/emotions/ATTENTIVE_BLINK.png",
  HAPPY_OPEN: "../assets/emotions/HAPPY_OPEN.png",
});

export const CHARACTER_STYLES = Object.freeze({
  stackchan: "狐の被せ物をつけたStack-chan",
  original: "現行の白狐INARI",
});

export const STACKCHAN_ARTWORK_FILES = Object.freeze(
  Object.fromEntries(Object.keys(ARTWORK_FILES).map((name) => [name, `../assets/stackchan-emotions/${name}.svg?v=5`])),
);

export function getArtworkFile(style, artwork) {
  if (!Object.hasOwn(CHARACTER_STYLES, style)) throw new RangeError("Unknown INARI character style: " + style);
  const file = style === "stackchan" ? STACKCHAN_ARTWORK_FILES[artwork] : ARTWORK_FILES[artwork];
  if (!file) throw new RangeError("Unknown INARI artwork: " + artwork);
  return file;
}

export const EMOTIONS = Object.freeze({
  NEUTRAL: {
    label: "見守る", face: "正面を向いた穏やかな目", motion: "静止を中心に、ときどき瞬きと小さな視線の間", speed: "very slow", playback: "loop",
    description: "静かに作物を見守り、ときどき瞬きをする。",
    steps: [step(1700), step(190, [0, 0, 0], "REST"), step(2100), step(950, [1, 0, 1]), step(180, [1, 0, 1], "REST"), step(2400)],
  },
  NOTICE: {
    label: "気づく", face: "一瞬だけ少し開く目", motion: "小さく顔を上げ、見つけた方向で止まる", speed: "quick → stop", playback: "once",
    description: "小さな変化に、ぴくっと気づく。",
    steps: [step(140, [0, 0, 0], "NEUTRAL"), step(180, [1, -4, 2]), step(900, [2, -3, 2])],
  },
  CURIOUS: {
    label: "気にする", face: "少し考えている目", motion: "ゆっくり首を傾けて観察する", speed: "slow", playback: "loop",
    description: "気になるものを、少し長く見つめる。",
    steps: [step(900), step(1600, [1, 0, -2]), step(1700, [1, 0, -2]), step(1100), step(1900, [-1, 0, 2])],
  },
  ATTENTIVE: {
    label: "聞く", face: "相手を見る優しい目と自然な瞬き", motion: "正面のまま瞬きし、うんうんと2回頷く", speed: "medium", playback: "loop",
    description: "正面で話を聞き、瞬きしてから、うんうんと頷く。",
    steps: [
      step(1200),
      step(130, [0, 0, 0], "ATTENTIVE_BLINK"),
      step(360),
      step(280, [0, 2, 0, 1, 0.955]),
      step(220),
      step(300, [0, 2.5, 0, 1, 0.95]),
      step(540),
      step(960),
      step(130, [0, 0, 0], "ATTENTIVE_BLINK"),
      step(1300),
    ],
  },
  HAPPY: {
    label: "よろこぶ", face: "いつもの目を少し見開き、瞬きする笑顔", motion: "左右に揺れながら2回瞬きして正面へ", speed: "medium", playback: "once",
    description: "いつもの目を明るく見開いて水やりを喜び、左右に揺れながら瞬きする。",
    steps: [
      step(300, [0, 0, 0], "HAPPY_OPEN"),
      step(150, [7, -2, 3], "HAPPY"),
      step(370, [10, -2, 4], "HAPPY_OPEN"),
      step(160, [-7, -2, -3], "HAPPY"),
      step(400, [-10, -2, -4], "HAPPY_OPEN"),
      step(620, [0, 0, 0], "HAPPY_OPEN"),
    ],
  },
  CELEBRATE: {
    label: "豊穣", face: "弧を描く目と大きめの笑顔", motion: "左・右・左・右・正面の豊穣の舞", speed: "medium-fast", playback: "once",
    description: "新芽や収穫を、首振りでも再現できる舞で祝う。",
    steps: [step(230), step(270, [-17, -2, -5]), step(270, [17, -2, 5]), step(270, [-17, -2, -5]), step(270, [17, -2, 5]), step(800)],
  },
  CONCERN: {
    label: "心配", face: "ハの字眉と汗、開いた口", motion: "下を向いて首を傾け、そのまま見守る", speed: "slow", playback: "loop",
    description: "水が足りるか、静かに気にかける。",
    steps: [step(650), step(950, [-1, 4, -3]), step(2600, [-1, 4, -3]), step(1800, [-1, 3, -2])],
  },
  ALERT: {
    label: "知らせる", face: "はっきり見開いた目", motion: "素早く顔を上げ、2回だけ注意を引いて保つ", speed: "fast", playback: "once",
    description: "対応してほしいことを、落ち着いて知らせる。",
    steps: [step(120, [0, 2, 0], "ATTENTIVE"), step(170, [0, -7, 0]), step(190, [6, -6, 3]), step(190, [-5, -6, -3]), step(1100, [0, -4, 0])],
  },
  RELIEF: {
    label: "安心", face: "目を閉じた、ほっとした微笑み", motion: "同じ表情のまま、ゆっくり上下に一往復して落ち着く", speed: "slow", playback: "once",
    description: "目を閉じてほっと一息。静かに上下へ揺れる。",
    steps: [
      step(550, [0, 0, 0]),
      step(650, [0, -4, 0]),
      step(680, [0, 0, 0]),
      step(700, [0, 3, 0]),
      step(900, [0, 0, 0]),
    ],
  },
  REST: {
    label: "休む", face: "閉じた眠そうな目", motion: "頭を少し下げ、ごく小さく呼吸", speed: "very slow", playback: "loop",
    description: "安心して休みながら、小さな呼吸を続ける。",
    steps: [step(1900, [0, 2, 0]), step(800, [0, 1, 0]), step(1700, [0, 0, 0]), step(800, [0, 1, 0])],
  },
});

export function getEmotion(name) {
  const emotion = EMOTIONS[name];
  if (!emotion) throw new RangeError("Unknown INARI emotion: " + name);
  return emotion;
}
