// ===== GAME PLUGIN INTERFACE =====
// Every game mode must implement this interface

export interface GameConfig {
  mode: string;
  duration: number;        // ms
  seed: number;            // random seed for reproducibility
  data: any;               // mode-specific config (targets, colors, beats)
}

export interface PlayerInput {
  type: string;            // 'tap', 'color_tap', 'beat_tap'
  time: number;            // ms since game start
  data?: any;              // mode-specific (x,y for target / color for combo)
}

export interface GamePlugin {
  mode: string;
  generateConfig(): GameConfig;
  processInput(playerId: string, input: PlayerInput): number;  // returns current score
  getScore(playerId: string): number;
  validate(playerId: string): boolean;   // anti-cheat check
  getMaxScore(): number;
}

// ===== TARGET TAP =====
interface Target {
  id: number;
  x: number;       // 0-100 percent
  y: number;       // 0-100 percent
  size: number;    // radius in percent (smaller = harder)
  appearAt: number; // ms from start
  duration: number; // ms to tap before disappearing
  points: number;
}

export class TargetTapGame implements GamePlugin {
  mode = 'target_tap';
  private targets: Target[] = [];
  private scores: Record<string, number> = {};
  private hits: Record<string, Set<number>> = {};
  private inputs: Record<string, PlayerInput[]> = {};
  private duration: number;

  constructor(duration = 10000) {
    this.duration = duration;
  }

  generateConfig(): GameConfig {
    const seed = Date.now();
    const rng = this.seededRandom(seed);
    this.targets = [];

    let id = 0;
    for (let t = 500; t < this.duration - 500; t += 350 + Math.floor(rng() * 200)) {
      const progress = t / this.duration;
      const size = Math.max(6, 14 - progress * 8);  // gets smaller over time
      const points = size < 8 ? 3 : size < 11 ? 2 : 1;

      this.targets.push({
        id: id++,
        x: 10 + rng() * 80,
        y: 10 + rng() * 70,
        size,
        appearAt: t,
        duration: 1500 - progress * 500,  // less time to tap
        points,
      });
    }

    return {
      mode: this.mode,
      duration: this.duration,
      seed,
      data: { targets: this.targets },
    };
  }

  processInput(playerId: string, input: PlayerInput): number {
    if (!this.scores[playerId]) { this.scores[playerId] = 0; this.hits[playerId] = new Set(); this.inputs[playerId] = []; }
    this.inputs[playerId].push(input);

    if (input.type === 'tap' && input.data) {
      const { targetId, x, y } = input.data;
      const target = this.targets.find(t => t.id === targetId);
      if (target && !this.hits[playerId].has(targetId)) {
        const dist = Math.sqrt((x - target.x) ** 2 + (y - target.y) ** 2);
        if (dist <= target.size * 1.5) {
          this.hits[playerId].add(targetId);
          this.scores[playerId] += target.points;
        }
      }
    }
    return this.scores[playerId] || 0;
  }

  getScore(playerId: string): number { return this.scores[playerId] || 0; }
  validate(playerId: string): boolean {
    const inputs = this.inputs[playerId] || [];
    return inputs.length <= this.targets.length * 3; // max 3 taps per target
  }
  getMaxScore(): number { return this.targets.reduce((s, t) => s + t.points, 0); }

  private seededRandom(seed: number) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
  }
}

// ===== COMBO TAP =====
interface ComboStep {
  id: number;
  color: string;      // 'red' | 'blue' | 'green' | 'yellow'
  showAt: number;      // ms from start
  timeLimit: number;   // ms to respond
}

export class ComboTapGame implements GamePlugin {
  mode = 'combo_tap';
  private steps: ComboStep[] = [];
  private scores: Record<string, number> = {};
  private combos: Record<string, number> = {};
  private inputs: Record<string, PlayerInput[]> = {};
  private stepIndex: Record<string, number> = {};
  private duration: number;

  constructor(duration = 10000) {
    this.duration = duration;
  }

  generateConfig(): GameConfig {
    const seed = Date.now();
    const rng = this.seededRandom(seed);
    const colors = ['red', 'blue', 'green', 'yellow'];
    this.steps = [];

    let id = 0;
    let t = 800;
    while (t < this.duration - 500) {
      const progress = t / this.duration;
      const timeLimit = Math.max(500, 1200 - progress * 700);  // faster over time

      this.steps.push({
        id: id++,
        color: colors[Math.floor(rng() * colors.length)],
        showAt: t,
        timeLimit,
      });
      t += timeLimit + 100;
    }

    return {
      mode: this.mode,
      duration: this.duration,
      seed,
      data: { steps: this.steps },
    };
  }

  processInput(playerId: string, input: PlayerInput): number {
    if (this.scores[playerId] === undefined) { this.scores[playerId] = 0; this.combos[playerId] = 0; this.inputs[playerId] = []; this.stepIndex[playerId] = 0; }
    this.inputs[playerId].push(input);

    if (input.type === 'color_tap' && input.data) {
      const idx = this.stepIndex[playerId];
      if (idx < this.steps.length) {
        const step = this.steps[idx];
        if (input.data.color === step.color) {
          this.combos[playerId]++;
          const comboBonus = Math.min(this.combos[playerId], 5);
          this.scores[playerId] += comboBonus;
        } else {
          this.combos[playerId] = 0;
          this.scores[playerId] = Math.max(0, this.scores[playerId] - 1);
        }
        this.stepIndex[playerId]++;
      }
    }
    return this.scores[playerId];
  }

  getScore(playerId: string): number { return this.scores[playerId] || 0; }
  validate(playerId: string): boolean {
    const inputs = this.inputs[playerId] || [];
    return inputs.length <= this.steps.length * 2;
  }
  getMaxScore(): number { return this.steps.length * 5; }

  private seededRandom(seed: number) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
  }
}

// ===== ENDURANCE =====
interface Beat {
  id: number;
  time: number;       // ms from start (when to tap)
  window: number;     // ms tolerance
}

export class EnduranceGame implements GamePlugin {
  mode = 'endurance';
  private beats: Beat[] = [];
  private scores: Record<string, number> = {};
  private inputs: Record<string, PlayerInput[]> = {};
  private beatHits: Record<string, Set<number>> = {};
  private duration: number;

  constructor(duration = 10000) {
    this.duration = duration;
  }

  generateConfig(): GameConfig {
    const seed = Date.now();
    this.beats = [];

    let id = 0;
    let t = 1000;
    let interval = 800;  // start slow

    while (t < this.duration - 300) {
      const progress = t / this.duration;
      const window = Math.max(80, 200 - progress * 120);  // tighter timing

      this.beats.push({ id: id++, time: t, window });
      interval = Math.max(300, 800 - progress * 500);  // faster tempo
      t += interval;
    }

    return {
      mode: this.mode,
      duration: this.duration,
      seed,
      data: { beats: this.beats },
    };
  }

  processInput(playerId: string, input: PlayerInput): number {
    if (this.scores[playerId] === undefined) { this.scores[playerId] = 0; this.inputs[playerId] = []; this.beatHits[playerId] = new Set(); }
    this.inputs[playerId].push(input);

    if (input.type === 'beat_tap') {
      const tapTime = input.time;
      let bestBeat: Beat | null = null;
      let bestDiff = Infinity;

      for (const beat of this.beats) {
        if (this.beatHits[playerId].has(beat.id)) continue;
        const diff = Math.abs(tapTime - beat.time);
        if (diff < bestDiff && diff <= beat.window * 2) {
          bestDiff = diff;
          bestBeat = beat;
        }
      }

      if (bestBeat) {
        this.beatHits[playerId].add(bestBeat.id);
        if (bestDiff <= bestBeat.window * 0.3) {
          this.scores[playerId] += 3;  // PERFECT
        } else if (bestDiff <= bestBeat.window) {
          this.scores[playerId] += 1;  // GOOD
        } else {
          this.scores[playerId] = Math.max(0, this.scores[playerId] - 1);  // BAD
        }
      }
    }
    return this.scores[playerId];
  }

  getScore(playerId: string): number { return this.scores[playerId] || 0; }
  validate(playerId: string): boolean {
    const inputs = this.inputs[playerId] || [];
    return inputs.length <= this.beats.length * 3;
  }
  getMaxScore(): number { return this.beats.length * 3; }
}

// ===== FACTORY =====
export function createGame(mode: string, duration = 10000): GamePlugin {
  switch (mode) {
    case 'target_tap': return new TargetTapGame(duration);
    case 'combo_tap': return new ComboTapGame(duration);
    case 'endurance': return new EnduranceGame(duration);
    default: return new TargetTapGame(duration);
  }
}
