// All sounds are synthesized with the Web Audio API, so no audio assets
// are shipped. The context is created lazily inside a user gesture
// (first keystroke / start click) to satisfy autoplay policies.
const STORAGE_KEY = "hk-mtr-typing-muted";

let context = null;
let muted = false;

export function loadMuted(storage) {
  try {
    muted = storage?.getItem(STORAGE_KEY) === "1";
  } catch {
    muted = false;
  }
  return muted;
}

export function setMuted(storage, value) {
  muted = value;
  try {
    storage?.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Private browsing may block storage; the in-session toggle still works.
  }
}

function ensureContext() {
  if (muted || typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === "suspended") context.resume();
  return context;
}

function tone(
  frequency,
  { at = 0, duration = 0.15, type = "triangle", peak = 0.07 } = {},
) {
  const ctx = ensureContext();
  if (!ctx) return;
  const start = ctx.currentTime + at;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

// Soft tick for each correct character.
export function playKeystroke() {
  tone(1760, { duration: 0.045, peak: 0.03 });
}

// Low buzz for a wrong key.
export function playError() {
  tone(145, { duration: 0.15, type: "square", peak: 0.05 });
}

// Ascending three-note chime when the train reaches a station.
export function playArrival() {
  tone(523.25, { at: 0, duration: 0.22 });
  tone(659.25, { at: 0.09, duration: 0.22 });
  tone(783.99, { at: 0.18, duration: 0.38, peak: 0.09 });
}

// Small fanfare for the result screen.
export function playFinish() {
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) =>
    tone(frequency, {
      at: index * 0.12,
      duration: index === 3 ? 0.6 : 0.2,
      peak: 0.08,
    }),
  );
}
