import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playHit, playPerfect, playCombo, playGold, playBoss } from '../../lib/sounds';

interface Target {
  id: number; x: number; y: number; size: number;
  appearAt: number; duration: number; points: number;
  type: 'normal' | 'gold' | 'boss'; hitsRequired: number;
}
interface FloatScore { id: number; x: number; y: number; text: string; color: string; }

export default function TargetTapGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const pictureUrl = useGameStore((s) => s.pictureUrl);
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
        const p = i / 80; const r = Math.random();
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
      if (target.type === 'boss') playBoss();
      else if (target.type === 'gold') playGold();
      else playHit();
      const fid = floatId.current++;
      const color = target.type === 'boss' ? '#ff4444' : target.type === 'gold' ? '#fbbf24' : '#c084fc';
      setFloats(prev => [...prev, { id: fid, x: target.x, y: target.y, text: `+${target.points}`, color }]);
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 600);
    } else { playHit(); }
    if (matchId) sendGameInput(matchId, 'tap', { targetId: target.id, x: target.x, y: target.y });
    if (navigator.vibrate) navigator.vibrate(target.type === 'boss' ? [20, 10, 20] : 12);
  }, [hitCounts, destroyed, matchId, timeLeft]);

  const isUrgent = timeLeft <= 5;
  const phaseLabel = phase === 1 ? 'PHASE I' : phase === 2 ? 'PHASE II' : 'PHASE III';
  const phaseColor = phase === 1 ? '#c084fc' : phase === 2 ? '#60a5fa' : '#f87171';

  // Target styles per type
  const getTargetStyle = (target: Target) => {
    const hits = hitCounts[target.id] || 0;
    const bossProgress = target.type === 'boss' ? hits / target.hitsRequired : 0;

    if (target.type === 'boss') return {
      background: `conic-gradient(from 0deg, #ef4444 ${bossProgress * 360}deg, #1a0520 ${bossProgress * 360}deg)`,
      border: '3px solid #ef4444',
      boxShadow: '0 0 25px #ef444480, 0 0 50px #ef444430, inset 0 0 15px #ef444420, 0 6px 0 #7f1d1d',
    };
    if (target.type === 'gold') return {
      background: 'linear-gradient(145deg, #fde68a 0%, #f59e0b 30%, #d97706 70%, #92400e 100%)',
      border: '2px solid #fbbf24',
      boxShadow: '0 0 20px #fbbf2460, 0 0 40px #fbbf2420, inset 0 -3px 6px #92400e80, inset 0 3px 6px #fde68a60, 0 4px 0 #78350f',
    };
    return {
      background: `linear-gradient(145deg, #e9d5ff 0%, #a855f7 30%, #7c3aed 70%, #4c1d95 100%)`,
      border: '2px solid #a855f780',
      boxShadow: '0 0 15px #a855f740, 0 0 30px #a855f720, inset 0 -2px 5px #4c1d9580, inset 0 2px 5px #e9d5ff40, 0 3px 0 #3b0764',
    };
  };

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-center">
          <div className="text-[10px] text-cute-gray uppercase font-semibold">You</div>
          <div className="text-2xl font-black text-cute-pink tabular-nums">{myScore}</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-black tabular-nums ${isUrgent ? 'text-cute-red animate-pulse' : 'text-cute-pink'}`}>{timeLeft.toFixed(1)}s</div>
          <div className="text-[10px] uppercase font-bold tracking-widest" style={{ color: phaseColor }}>{phaseLabel}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-cute-gray uppercase font-semibold">Opp</div>
          <div className="text-2xl font-black text-cute-red tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden cute-card" style={{ backgroundImage: 'url(/bg-main.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0" style={{ background: phase === 3 ? 'rgba(255,248,240,0.85)' : 'rgba(255,248,240,0.8)' }} />

        {/* Player Profile */}
        {pictureUrl && <img src={pictureUrl} alt="" className="absolute bottom-2 right-2 w-12 h-12 rounded-full opacity-50 pointer-events-none border-2 border-cute-pink/30 z-30" style={{ filter: 'drop-shadow(0 0 10px #a855f740)' }} />}

        {/* Targets */}
        {visibleTargets.map(target => {
          const style = getTargetStyle(target);
          const hits = hitCounts[target.id] || 0;
          return (
            <button key={target.id}
              onTouchStart={(e) => handleTap(target, e)}
              onClick={(e) => handleTap(target, e)}
              className="absolute rounded-full active:scale-75 transition-all z-10"
              style={{
                left: `${target.x}%`, top: `${target.y}%`,
                width: `${target.size * 2.5}%`, height: `${target.size * 2.5}%`,
                transform: 'translate(-50%, -50%)',
                ...style,
                animation: target.type === 'boss' ? 'bossBreath 1s ease infinite' : 'pop 0.3s ease',
              }}>
              {/* Shine overlay */}
              <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-[10%] w-[40%] h-[35%] rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 100%)' }} />
              </div>
              {/* Ring decoration for boss */}
              {target.type === 'boss' && (
                <div className="absolute -inset-1 rounded-full border border-red-500/30 animate-ping" style={{ animationDuration: '2s' }} />
              )}
              {/* Label */}
              <span className="relative text-white font-black text-xs drop-shadow-lg z-10" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {target.type === 'boss' ? `💀${target.hitsRequired - hits}` : target.type === 'gold' ? '⭐' : `+${target.points}`}
              </span>
            </button>
          );
        })}

        {/* Float scores */}
        {floats.map(f => (
          <div key={f.id} className="score-float z-20" style={{ left: `${f.x}%`, top: `${f.y}%`, color: f.color, textShadow: `0 0 10px ${f.color}` }}>{f.text}</div>
        ))}

        {/* Instructions */}
        {visibleTargets.length === 0 && timeLeft > 28 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <div className="text-cute-gray text-sm animate-pulse">เป้ากำลังจะมา...</div>
            <div className="bg-white/80 backdrop-blur-sm cute-card rounded-xl px-4 py-3 text-center max-w-[260px]">
              <div className="text-cute-pink text-xs font-bold mb-1">🎯 วิธีเล่น</div>
              <div className="text-cute-gray text-[11px]">กดเป้าให้เร็ว! ⭐ทอง = +5 · 💀บอส = +10 (กด 3 ครั้ง)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
