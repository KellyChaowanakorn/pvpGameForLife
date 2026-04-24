// ===== SOUND SYSTEM =====
// BGM: real music files | SFX: Web Audio API

let audioCtx: AudioContext | null = null;
let bgMusic: HTMLAudioElement | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}

export function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + dur);
  } catch {}
}

// === SFX ===
export function playTap() { tone(900, 0.06, 'square', 0.1); tone(1400, 0.04, 'sine', 0.08, 0.02); }
export function playHit() { tone(1200, 0.08, 'sine', 0.18); tone(1800, 0.06, 'sine', 0.12, 0.04); tone(2200, 0.04, 'sine', 0.08, 0.07); }
export function playMiss() { tone(180, 0.2, 'sawtooth', 0.08); tone(120, 0.15, 'square', 0.05, 0.1); }
export function playCombo(streak: number) { const b = 500 + Math.min(streak, 15) * 60; tone(b, 0.1, 'sine', 0.18); tone(b * 1.25, 0.08, 'sine', 0.14, 0.05); tone(b * 1.5, 0.06, 'sine', 0.1, 0.1); }
export function playCorrect() { tone(880, 0.08, 'sine', 0.16); tone(1100, 0.06, 'sine', 0.12, 0.06); }
export function playWrong() { tone(150, 0.12, 'square', 0.08); tone(100, 0.15, 'sawtooth', 0.06, 0.08); }
export function playPerfect() { tone(1000, 0.06, 'sine', 0.2); tone(1300, 0.06, 'sine', 0.16, 0.05); tone(1600, 0.06, 'sine', 0.12, 0.1); tone(2000, 0.08, 'sine', 0.08, 0.15); }
export function playBeat() { tone(600, 0.08, 'sine', 0.15); tone(800, 0.06, 'triangle', 0.1, 0.04); }
export function playBeatMiss() { tone(120, 0.18, 'square', 0.06); }
export function playDanger() { tone(200, 0.05, 'square', 0.12); tone(400, 0.05, 'square', 0.1, 0.06); }
export function playBoss() { tone(300, 0.1, 'sawtooth', 0.12); tone(450, 0.08, 'square', 0.1, 0.05); }
export function playGold() { [0, 40, 80, 120].forEach((d, i) => tone(800 + i * 200, 0.08, 'sine', 0.12, d / 1000)); }
export function playFireMode() { [0, 50, 100, 150, 200].forEach((d, i) => tone(400 + i * 100, 0.1, 'sawtooth', 0.08, d / 1000)); }
export function playCountdown() { tone(500, 0.12, 'triangle', 0.2); }
export function playGo() { tone(700, 0.08, 'sine', 0.25); tone(900, 0.08, 'sine', 0.2, 0.08); tone(1200, 0.12, 'sine', 0.15, 0.16); }
export function playWin() { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(f, 0.25, 'sine', 0.15, i * 0.12); tone(f * 0.5, 0.3, 'triangle', 0.08, i * 0.12); }); }
export function playLose() { tone(400, 0.3, 'sawtooth', 0.08); tone(300, 0.3, 'sawtooth', 0.06, 0.2); tone(200, 0.4, 'sawtooth', 0.04, 0.4); }

// === BACKGROUND MUSIC (real files) ===
const MUSIC_FILES: Record<string, string> = {
  target_tap: '/music-target.mp3',
  combo_tap: '/music-combo.ogg',
  endurance: '/music-endurance.mp3',
};

export function startBGMusic(mode: string) {
  stopBGMusic();
  try {
    const src = MUSIC_FILES[mode];
    if (!src) return;
    bgMusic = new Audio(src);
    bgMusic.loop = true;
    bgMusic.volume = 0.3;
    bgMusic.play().catch(() => {});
  } catch {}
}

export function stopBGMusic() {
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
    bgMusic = null;
  }
}
