import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playHit, playMiss, playPerfect, playCombo } from '../../lib/sounds';

interface Target {
  id: number; x: number; y: number; size: number;
  appearAt: number; duration: number; points: number;
  type: 'normal' | 'gold' | 'boss'; hitsRequired: number;
}
interface FloatScore { id: number; x: number; y: number; text: string; color: string; }

export default function TargetTapGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const [visibleTargets, setVisibleTargets] = useState<Target[]>([]);
  const [hitCounts, setHitCounts] = useState<Record<number, number>>({});
  const [destroyed, setDestroyed] = useState<Set<number>>(new Set());
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [phase, setPhase] = useState(1);
  const startRef = useRef(Date.now());
  const targetsRef = useRef<Target[]>([]);
  const floatId = useRef(0);

  useEffect(() => {
    if (gameConfig?.data?.targets) targetsRef.current = gameConfig.data.targets;
    else {
      const t: Target[] = [];
      for (let i = 0; i < 80; i++) {
        const p = i / 80;
        const r = Math.random();
        let type: 'normal' | 'gold' | 'boss' = 'normal', pts = Math.ceil(p * 3), hits = 1, sz = Math.max(5, 13 - p * 7);
        if (r > 0.92 && p > 0.3) { type = 'boss'; pts = 10; hits = 3; sz = 16; }
        else if (r > 0.8) { type = 'gold'; pts = 5; sz = Math.max(4, 10 - p * 5); }
        t.push({ id: i, x: 8 + Math.random() * 84, y: 8 + Math.random() * 74, size: sz, appearAt: 400 + i * 360, duration: type === 'boss' ? 2500 : Math.max(800, 1800 - p * 800), points: pts, type, hitsRequired: hits });
      }
      targetsRef.current = t;
    }
    startRef.current = Date.now();
  }, [gameConfig]);

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setPhase(elapsed < 10000 ? 1 : elapsed < 20000 ? 2 : 3);
      setVisibleTargets(targetsRef.current.filter(t => elapsed >= t.appearAt && elapsed <= t.appearAt + t.duration && !destroyed.has(t.id)));
    }, 30);
    return () => clearInterval(iv);
  }, [destroyed]);

  const handleTap = useCallback((target: Target, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (destroyed.has(target.id) || timeLeft <= 0) return;

    const newHits = { ...hitCounts, [target.id]: (hitCounts[target.id] || 0) + 1 };
    setHitCounts(newHits);

    if (newHits[target.id] >= target.hitsRequired) {
      setDestroyed(prev => new Set(prev).add(target.id));
      if (target.type === 'boss') playPerfect();
      else if (target.type === 'gold') playCombo(5);
      else playHit();

      const fid = floatId.current++;
      const color = target.type === 'boss' ? '#ef4444' : target.type === 'gold' ? '#fbbf24' : '#a855f7';
      setFloats(prev => [...prev, { id: fid, x: target.x, y: target.y, text: `+${target.points}`, color }]);
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 600);
    } else {
      playHit();
    }

    if (matchId) sendGameInput(matchId, 'tap', { targetId: target.id, x: target.x, y: target.y });
    if (navigator.vibrate) navigator.vibrate(target.type === 'boss' ? [20, 10, 20] : 12);
  }, [hitCounts, destroyed, matchId, timeLeft]);

  const isUrgent = timeLeft <= 5;
  const phaseLabel = phase === 1 ? 'PHASE I' : phase === 2 ? 'PHASE II' : 'PHASE III';
  const phaseColor = phase === 1 ? '#a855f7' : phase === 2 ? '#3b82f6' : '#ef4444';

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">You</div>
          <div className="text-2xl font-black text-arcane-purple tabular-nums">{myScore}</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-black tabular-nums ${isUrgent ? 'text-danger animate-pulse' : 'text-arcane-purple'}`}>
            {timeLeft.toFixed(1)}s
          </div>
          <div className="text-[10px] uppercase font-bold tracking-widest" style={{ color: phaseColor }}>{phaseLabel}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">Opp</div>
          <div className="text-2xl font-black text-danger tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden rune-border" style={{ background: 'linear-gradient(180deg, #0d0d25 0%, #12082a 50%, #0a0a1a 100%)' }}>
        {/* Rune grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #a855f7 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        {/* Phase overlay */}
        {phase === 3 && <div className="absolute inset-0 animate-pulse" style={{ background: 'radial-gradient(circle at center, transparent 50%, #ef444410 100%)' }} />}

        {/* Targets */}
        {visibleTargets.map(target => {
          const hits = hitCounts[target.id] || 0;
          const bossProgress = target.type === 'boss' ? hits / target.hitsRequired : 0;
          return (
            <button
              key={target.id}
              onTouchStart={(e) => handleTap(target, e)}
              onClick={(e) => handleTap(target, e)}
              className="absolute rounded-full active:scale-75 transition-transform"
              style={{
                left: `${target.x}%`, top: `${target.y}%`,
                width: `${target.size * 2.5}%`, height: `${target.size * 2.5}%`,
                transform: 'translate(-50%, -50%)',
                background: target.type === 'boss'
                  ? `radial-gradient(circle, #ef4444 ${bossProgress * 100}%, #7c3aed 100%)`
                  : target.type === 'gold'
                    ? 'radial-gradient(circle, #fbbf24 0%, #f59e0b 100%)'
                    : `radial-gradient(circle, #a855f7 0%, #7c3aed 100%)`,
                boxShadow: target.type === 'boss'
                  ? '0 0 20px #ef444460, 0 0 40px #7c3aed30'
                  : target.type === 'gold'
                    ? '0 0 15px #fbbf2460, 0 0 30px #f59e0b20'
                    : '0 0 12px #a855f740',
                border: target.type === 'boss' ? '2px solid #ef4444' : target.type === 'gold' ? '2px solid #fbbf24' : '1px solid #a855f760',
                animation: target.type === 'boss' ? 'bossBreath 1s ease infinite' : 'pop 0.3s ease',
              }}
            >
              <span className="text-white font-black text-xs drop-shadow-lg">
                {target.type === 'boss' ? `💀${target.hitsRequired - hits}` : target.type === 'gold' ? '⭐' : `+${target.points}`}
              </span>
            </button>
          );
        })}

        {/* Float scores */}
        {floats.map(f => (
          <div key={f.id} className="score-float" style={{ left: `${f.x}%`, top: `${f.y}%`, color: f.color }}>{f.text}</div>
        ))}

        {/* Instructions */}
        {visibleTargets.length === 0 && timeLeft > 28 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="text-stake-gray text-sm animate-pulse">เป้ากำลังจะมา...</div>
            <div className="bg-arcane-dark/90 rune-border rounded-xl px-4 py-3 text-center max-w-[260px]">
              <div className="text-arcane-purple text-xs font-bold mb-1">🎯 วิธีเล่น</div>
              <div className="text-stake-gray text-[11px]">กดเป้าให้เร็ว! ⭐ทอง = +5 · 💀บอส = +10 (กด 3 ครั้ง)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
