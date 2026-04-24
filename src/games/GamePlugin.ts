// ===== GAME PLUGIN INTERFACE =====
export interface GameConfig {
  mode: string;
  duration: number;
  seed: number;
  data: any;
}

export interface PlayerInput {
  type: string;
  time: number;
  data?: any;
}

export interface GamePlugin {
  mode: string;
  generateConfig(): GameConfig;
  processInput(playerId: string, input: PlayerInput): number;
  getScore(playerId: string): number;
  validate(playerId: string): boolean;
  getMaxScore(): number;
}

// ===== TARGET TAP (30s - boss, gold, power-ups) =====
interface Target {
  id: number; x: number; y: number; size: number;
  appearAt: number; duration: number; points: number;
  type: 'normal' | 'gold' | 'boss';
  hitsRequired: number;
}

export class TargetTapGame implements GamePlugin {
  mode = 'target_tap';
  private targets: Target[] = [];
  private scores: Record<string, number> = {};
  private hits: Record<string, Record<number, number>> = {};
  private inputs: Record<string, PlayerInput[]> = {};
  private duration: number;

  constructor(duration = 30000) { this.duration = duration; }

  generateConfig(): GameConfig {
    const seed = Date.now();
    const rng = this.seededRandom(seed);
    this.targets = [];
    let id = 0;

    for (let t = 400; t < this.duration - 500; t += 250 + Math.floor(rng() * 200)) {
      const progress = t / this.duration;
      const phase = progress < 0.33 ? 1 : progress < 0.66 ? 2 : 3;
      const r = rng();

      let type: 'normal' | 'gold' | 'boss' = 'normal';
      let points = 1;
      let hitsRequired = 1;
      let size = Math.max(5, 13 - progress * 7);

      if (r > 0.92 && phase >= 2) {
        type = 'boss'; points = 10; hitsRequired = 3; size = 16;
      } else if (r > 0.8) {
        type = 'gold'; points = 5; size = Math.max(4, 10 - progress * 5);
      } else {
        points = phase;
        size = Math.max(5, 14 - progress * 8);
      }

      this.targets.push({
        id: id++, x: 8 + rng() * 84, y: 8 + rng() * 74,
        size, appearAt: t,
        duration: type === 'boss' ? 2500 : Math.max(800, 1800 - progress * 800),
        points, type, hitsRequired,
      });
    }
    return { mode: this.mode, duration: this.duration, seed, data: { targets: this.targets } };
  }

  processInput(playerId: string, input: PlayerInput): number {
    if (!this.scores[playerId]) { this.scores[playerId] = 0; this.hits[playerId] = {}; this.inputs[playerId] = []; }
    this.inputs[playerId].push(input);
    if (input.type === 'tap' && input.data) {
      const { targetId } = input.data;
      const target = this.targets.find(t => t.id === targetId);
      if (target) {
        if (!this.hits[playerId][targetId]) this.hits[playerId][targetId] = 0;
        this.hits[playerId][targetId]++;
        if (this.hits[playerId][targetId] >= target.hitsRequired) {
          this.scores[playerId] += target.points;
        }
      }
    }
    return this.scores[playerId];
  }

  getScore(playerId: string): number { return this.scores[playerId] || 0; }
  validate(playerId: string): boolean { return (this.inputs[playerId]?.length || 0) <= this.targets.length * 5; }
  getMaxScore(): number { return this.targets.reduce((s, t) => s + t.points, 0); }
  private seededRandom(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
}

// ===== COMBO TAP (30s - phases, rainbow, fire mode) =====
interface ComboStep {
  id: number; color: string; showAt: number; timeLimit: number;
  type: 'normal' | 'rainbow';
}

export class ComboTapGame implements GamePlugin {
  mode = 'combo_tap';
  private steps: ComboStep[] = [];
  private scores: Record<string, number> = {};
  private combos: Record<string, number> = {};
  private inputs: Record<string, PlayerInput[]> = {};
  private stepIndex: Record<string, number> = {};
  private duration: number;

  constructor(duration = 30000) { this.duration = duration; }

  generateConfig(): GameConfig {
    const seed = Date.now();
    const rng = this.seededRandom(seed);
    const colors = ['red', 'blue', 'green', 'yellow'];
    this.steps = [];
    let id = 0; let t = 600;

    while (t < this.duration - 400) {
      const progress = t / this.duration;
      const phase = progress < 0.33 ? 1 : progress < 0.66 ? 2 : 3;
      const timeLimit = Math.max(350, 1000 - progress * 600);
      const isRainbow = rng() > 0.9 && phase >= 2;

      this.steps.push({
        id: id++,
        color: isRainbow ? 'rainbow' : colors[Math.floor(rng() * colors.length)],
        showAt: t, timeLimit,
        type: isRainbow ? 'rainbow' : 'normal',
      });
      t += timeLimit + 80;
    }
    return { mode: this.mode, duration: this.duration, seed, data: { steps: this.steps } };
  }

  processInput(playerId: string, input: PlayerInput): number {
    if (this.scores[playerId] === undefined) { this.scores[playerId] = 0; this.combos[playerId] = 0; this.inputs[playerId] = []; this.stepIndex[playerId] = 0; }
    this.inputs[playerId].push(input);
    if (input.type === 'color_tap' && input.data) {
      const idx = this.stepIndex[playerId];
      if (idx < this.steps.length) {
        const step = this.steps[idx];
        const correct = step.type === 'rainbow' ? true : input.data.color === step.color;
        if (correct) {
          this.combos[playerId]++;
          const combo = this.combos[playerId];
          let bonus = Math.min(combo, 5);
          if (step.type === 'rainbow') bonus = 10;
          if (combo >= 10) bonus += 3; // fire mode
          this.scores[playerId] += bonus;
        } else {
          this.combos[playerId] = 0;
          this.scores[playerId] = Math.max(0, this.scores[playerId] - 2);
        }
        this.stepIndex[playerId]++;
      }
    }
    return this.scores[playerId];
  }

  getScore(playerId: string): number { return this.scores[playerId] || 0; }
  validate(playerId: string): boolean { return (this.inputs[playerId]?.length || 0) <= this.steps.length * 2; }
  getMaxScore(): number { return this.steps.length * 10; }
  private seededRandom(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
}

// ===== ENDURANCE (30s - double beats, danger zones) =====
interface Beat {
  id: number; time: number; window: number;
  type: 'normal' | 'double' | 'danger';
}

export class EnduranceGame implements GamePlugin {
  mode = 'endurance';
  private beats: Beat[] = [];
  private scores: Record<string, number> = {};
  private inputs: Record<string, PlayerInput[]> = {};
  private beatHits: Record<string, Set<number>> = {};
  private duration: number;

  constructor(duration = 30000) { this.duration = duration; }

  generateConfig(): GameConfig {
    const seed = Date.now();
    const rng = this.seededRandom(seed);
    this.beats = [];
    let id = 0; let t = 800; let interval = 700;

    while (t < this.duration - 300) {
      const progress = t / this.duration;
      const window = Math.max(60, 180 - progress * 120);
      const r = rng();

      let type: 'normal' | 'double' | 'danger' = 'normal';
      if (r > 0.88 && progress > 0.3) type = 'danger';
      else if (r > 0.75 && progress > 0.2) type = 'double';

      this.beats.push({ id: id++, time: t, window, type });
      if (type === 'double') {
        this.beats.push({ id: id++, time: t + 150, window, type: 'normal' });
        t += 150;
      }
      interval = Math.max(250, 700 - progress * 450);
      t += interval;
    }
    return { mode: this.mode, duration: this.duration, seed, data: { beats: this.beats } };
  }

  processInput(playerId: string, input: PlayerInput): number {
    if (this.scores[playerId] === undefined) { this.scores[playerId] = 0; this.inputs[playerId] = []; this.beatHits[playerId] = new Set(); }
    this.inputs[playerId].push(input);
    if (input.type === 'beat_tap') {
      const tapTime = input.time;
      let bestBeat: Beat | null = null; let bestDiff = Infinity;
      for (const beat of this.beats) {
        if (this.beatHits[playerId].has(beat.id)) continue;
        const diff = Math.abs(tapTime - beat.time);
        if (diff < bestDiff && diff <= beat.window * 3) { bestDiff = diff; bestBeat = beat; }
      }
      if (bestBeat) {
        this.beatHits[playerId].add(bestBeat.id);
        if (bestBeat.type === 'danger') {
          if (bestDiff <= bestBeat.window * 0.3) this.scores[playerId] += 8;
          else if (bestDiff <= bestBeat.window) this.scores[playerId] += 3;
          else this.scores[playerId] = Math.max(0, this.scores[playerId] - 5);
        } else {
          if (bestDiff <= bestBeat.window * 0.3) this.scores[playerId] += 3;
          else if (bestDiff <= bestBeat.window) this.scores[playerId] += 1;
          else this.scores[playerId] = Math.max(0, this.scores[playerId] - 1);
        }
      }
    }
    return this.scores[playerId];
  }

  getScore(playerId: string): number { return this.scores[playerId] || 0; }
  validate(playerId: string): boolean { return (this.inputs[playerId]?.length || 0) <= this.beats.length * 3; }
  getMaxScore(): number { return this.beats.length * 5; }
  private seededRandom(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
}

// ===== FACTORY =====
export function createGame(mode: string, duration = 30000): GamePlugin {
  switch (mode) {
    case 'target_tap': return new TargetTapGame(duration);
    case 'combo_tap': return new ComboTapGame(duration);
    case 'endurance': return new EnduranceGame(duration);
    default: return new TargetTapGame(duration);
  }
}
