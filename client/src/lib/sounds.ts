// ===== SOUND SYSTEM (Web Audio API) =====
// No external audio files - all generated programmatically

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

// Unlock audio on first user interaction (required for mobile)
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch {}
}

// ===== SOUND EFFECTS =====

export function playTap() {
  tone(800, 0.08, 'square', 0.15);
}

export function playHit() {
  tone(1200, 0.1, 'sine', 0.2);
  setTimeout(() => tone(1600, 0.08, 'sine', 0.15), 50);
}

export function playMiss() {
  tone(200, 0.2, 'sawtooth', 0.1);
}

export function playCombo(streak: number) {
  const baseFreq = 400 + Math.min(streak, 10) * 80;
  tone(baseFreq, 0.12, 'sine', 0.2);
  setTimeout(() => tone(baseFreq * 1.5, 0.1, 'sine', 0.15), 60);
}

export function playCorrect() {
  tone(880, 0.1, 'sine', 0.2);
  setTimeout(() => tone(1100, 0.08, 'sine', 0.15), 80);
}

export function playWrong() {
  tone(150, 0.15, 'square', 0.1);
  setTimeout(() => tone(120, 0.15, 'square', 0.08), 100);
}

export function playPerfect() {
  tone(1000, 0.08, 'sine', 0.25);
  setTimeout(() => tone(1200, 0.08, 'sine', 0.2), 60);
  setTimeout(() => tone(1500, 0.1, 'sine', 0.15), 120);
}

export function playCountdown() {
  tone(600, 0.15, 'sine', 0.25);
}

export function playGo() {
  tone(800, 0.1, 'sine', 0.3);
  setTimeout(() => tone(1000, 0.1, 'sine', 0.25), 100);
  setTimeout(() => tone(1200, 0.15, 'sine', 0.2), 200);
}

export function playWin() {
  [0, 100, 200, 300, 400].forEach((delay, i) => {
    setTimeout(() => tone(500 + i * 150, 0.2, 'sine', 0.2), delay);
  });
}

export function playLose() {
  tone(400, 0.3, 'sawtooth', 0.1);
  setTimeout(() => tone(300, 0.3, 'sawtooth', 0.08), 200);
  setTimeout(() => tone(200, 0.4, 'sawtooth', 0.06), 400);
}

export function playBeat() {
  tone(500, 0.1, 'sine', 0.2);
}

export function playBeatMiss() {
  tone(100, 0.2, 'square', 0.08);
}
