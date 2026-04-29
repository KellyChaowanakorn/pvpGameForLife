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

// ===== HELPER =====
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// ===== TARGET TAP (30s) =====
interface Target {
  id: number; x: number; y: number; size: number;
  appearAt: number; duration: number; points: number;
  type: 'normal' | 'gold' | 'boss'; hitsRequired: number;
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
    const rng = seededRandom(seed);
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
}

// ===== COMBO TAP (30s) =====
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
    const rng = seededRandom(seed);
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
          if (combo >= 10) bonus += 3;
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
}

// ===== ENDURANCE (30s) =====
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
    const rng = seededRandom(seed);
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
    if (this.scores[playerId] === undefined) {
      this.scores[playerId] = 0;
      this.inputs[playerId] = [];
      this.beatHits[playerId] = new Set();
    }
    this.inputs[playerId].push(input);

    if (input.type === 'beat_tap') {
      const tapTime = input.time;
      let bestBeat: Beat | null = null;
      let bestDiff = Infinity;

      for (const beat of this.beats) {
        if (this.beatHits[playerId].has(beat.id)) continue;
        const diff = Math.abs(tapTime - beat.time);
        if (diff < bestDiff && diff <= beat.window * 3) {
          bestDiff = diff;
          bestBeat = beat;
        }
      }

      if (bestBeat) {
        this.beatHits[playerId].add(bestBeat.id);
        const isDanger = bestBeat.type === 'danger';

        if (bestDiff <= bestBeat.window * 0.3) {
          // PERFECT
          this.scores[playerId] += isDanger ? 8 : 3;
        } else if (bestDiff <= bestBeat.window) {
          // GOOD
          this.scores[playerId] += isDanger ? 3 : 1;
        } else {
          // LATE - still give 1 point
          this.scores[playerId] += 1;
        }
      } else {
        // No beat nearby - still give 1 point per tap (prevents draw)
        this.scores[playerId] += 1;
      }
    }
    return this.scores[playerId];
  }

  getScore(playerId: string): number {
    return this.scores[playerId] || 0;
  }

  validate(playerId: string): boolean {
    return (this.inputs[playerId]?.length || 0) <= this.beats.length * 5;
  }

  getMaxScore(): number {
    return this.beats.length * 5;
  }
}

// ===== MEMORY FLIP (30s) =====
export class MemoryFlipGame implements GamePlugin {
  mode = 'memory_flip';
  private scores: Record<string, number> = {};
  private inputs: Record<string, PlayerInput[]> = {};
  private combos: Record<string, number> = {};
  private duration: number;
  private seed: number = 0;

  constructor(duration = 30000) { this.duration = duration; }

  generateConfig(): GameConfig {
    this.seed = Date.now();
    return { mode: this.mode, duration: this.duration, seed: this.seed, data: {} };
  }

  processInput(playerId: string, input: PlayerInput): number {
    if (this.scores[playerId] === undefined) {
      this.scores[playerId] = 0;
      this.inputs[playerId] = [];
      this.combos[playerId] = 0;
    }
    this.inputs[playerId].push(input);

    if (input.type === 'memory_match' && input.data) {
      const combo = input.data.combo || 1;
      this.combos[playerId] = combo;
      // More points for consecutive matches
      const points = combo >= 3 ? 5 : combo >= 2 ? 3 : 2;
      this.scores[playerId] += points;
    }
    return this.scores[playerId];
  }

  getScore(playerId: string): number { return this.scores[playerId] || 0; }
  validate(playerId: string): boolean { return (this.inputs[playerId]?.length || 0) <= 100; }
  getMaxScore(): number { return 8 * 5; } // 8 pairs * max 5 points
}

// ===== MATH DUEL (30s) =====
interface MathProblem {
  id: number; a: number; b: number; op: string; answer: number; showAt: number; points: number; difficulty: number;
}

export class MathDuelGame implements GamePlugin {
  mode = 'math_duel';
  private problems: MathProblem[] = [];
  private scores: Record<string, number> = {};
  private inputs: Record<string, PlayerInput[]> = {};
  private solved: Record<string, Set<number>> = {};
  private streaks: Record<string, number> = {};
  private duration: number;

  constructor(duration = 30000) { this.duration = duration; }

  generateConfig(): GameConfig {
    const seed = Date.now();
    const rng = seededRandom(seed);
    this.problems = [];
    let id = 0; let t = 500;

    while (t < this.duration - 1000) {
      const progress = t / this.duration;
      const diff = progress < 0.3 ? 1 : progress < 0.6 ? 2 : 3;
      let a: number, b: number, op: string, answer: number;

      if (diff === 1) {
        // Easy: addition/subtraction, small numbers
        a = 1 + Math.floor(rng() * 20); b = 1 + Math.floor(rng() * 20);
        if (rng() > 0.5) { op = '+'; answer = a + b; } else { op = '-'; if (a < b) [a, b] = [b, a]; answer = a - b; }
      } else if (diff === 2) {
        // Medium: multiplication, or bigger add/sub
        const r = rng();
        if (r > 0.5) { a = 2 + Math.floor(rng() * 12); b = 2 + Math.floor(rng() * 12); op = '×'; answer = a * b; }
        else { a = 10 + Math.floor(rng() * 90); b = 10 + Math.floor(rng() * 90); op = rng() > 0.5 ? '+' : '-'; if (op === '-' && a < b) [a, b] = [b, a]; answer = op === '+' ? a + b : a - b; }
      } else {
        // Hard: bigger multiply, or tricky
        const r = rng();
        if (r > 0.6) { a = 5 + Math.floor(rng() * 15); b = 5 + Math.floor(rng() * 15); op = '×'; answer = a * b; }
        else if (r > 0.3) { a = 50 + Math.floor(rng() * 150); b = 10 + Math.floor(rng() * 100); op = rng() > 0.5 ? '+' : '-'; if (op === '-' && a < b) [a, b] = [b, a]; answer = op === '+' ? a + b : a - b; }
        else { a = Math.floor(rng() * 12 + 2) * (Math.floor(rng() * 8) + 2); b = Math.floor(rng() * 8) + 2; op = '÷'; answer = Math.floor(a / b); a = answer * b; }
      }

      this.problems.push({ id: id++, a, b, op, answer, showAt: t, points: diff, difficulty: diff });
      t += diff === 1 ? 2500 : diff === 2 ? 3000 : 3500;
    }
    return { mode: this.mode, duration: this.duration, seed, data: { problems: this.problems } };
  }

  processInput(playerId: string, input: PlayerInput): number {
    if (this.scores[playerId] === undefined) { this.scores[playerId] = 0; this.inputs[playerId] = []; this.solved[playerId] = new Set(); this.streaks[playerId] = 0; }
    this.inputs[playerId].push(input);

    if (input.type === 'math_answer' && input.data) {
      const { problemId, answer } = input.data;
      const problem = this.problems.find(p => p.id === problemId);
      if (problem && !this.solved[playerId].has(problemId)) {
        this.solved[playerId].add(problemId);
        if (answer === problem.answer) {
          this.streaks[playerId]++;
          const streak = this.streaks[playerId];
          let bonus = problem.points;
          if (streak >= 5) bonus += 3;
          else if (streak >= 3) bonus += 1;
          this.scores[playerId] += bonus;
        } else {
          this.streaks[playerId] = 0;
          this.scores[playerId] = Math.max(0, this.scores[playerId] - 1);
        }
      }
    }
    return this.scores[playerId];
  }

  getScore(playerId: string): number { return this.scores[playerId] || 0; }
  validate(playerId: string): boolean { return (this.inputs[playerId]?.length || 0) <= this.problems.length * 3; }
  getMaxScore(): number { return this.problems.reduce((s, p) => s + p.points + 3, 0); }
}

// ===== DART AIM (30s) =====
export class DartAimGame implements GamePlugin {
  mode = 'dart_aim';
  private scores: Record<string, number> = {};
  private inputs: Record<string, PlayerInput[]> = {};
  private duration: number;

  constructor(duration = 30000) { this.duration = duration; }

  generateConfig(): GameConfig {
    const seed = Date.now();
    return { mode: this.mode, duration: this.duration, seed, data: {} };
  }

  processInput(playerId: string, input: PlayerInput): number {
    if (!this.scores[playerId]) { this.scores[playerId] = 0; this.inputs[playerId] = []; }
    this.inputs[playerId].push(input);

    if (input.type === 'dart_throw' && input.data) {
      const points = Math.min(input.data.points || 0, 10); // max 10 per throw
      if (points > 0) {
        this.scores[playerId] += points;
      }
    }
    return this.scores[playerId];
  }

  getScore(playerId: string): number { return this.scores[playerId] || 0; }
  validate(playerId: string): boolean { return (this.inputs[playerId]?.length || 0) <= 100; }
  getMaxScore(): number { return 100; }
}

// ===== FACTORY =====
export function createGame(mode: string, duration = 30000): GamePlugin {
  switch (mode) {
    case 'target_tap': return new TargetTapGame(duration);
    case 'combo_tap': return new ComboTapGame(duration);
    case 'endurance': return new EnduranceGame(duration);
    case 'memory_flip': return new MemoryFlipGame(duration);
    case 'math_duel': return new MathDuelGame(duration);
    case 'dart_aim': return new DartAimGame(duration);
    default: return new TargetTapGame(duration);
  }
}
