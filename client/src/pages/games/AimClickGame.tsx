import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playHit, playPerfect, playGold, playMiss } from '../../lib/sounds';

interface Target {
  id: number; x: number; y: number; size: number;
  appearAt: number; duration: number; points: number;
  type: 'normal' | 'bonus' | 'tiny' | 'moving';
  moveAngle?: number; moveSpeed?: number;
}
interface FloatScore { id: number; x: number; y: number; text: string; color: string; }

const TARGET_EMOJIS = { normal: '🎯', bonus: '⭐', tiny: '💎', moving: '🦋' };
const TARGET_COLORS = {
  normal: { bg: 'linear-gradient(135deg, #FF9BCB, #FF6B9D)', border: '#FF6B9D', glow: '#FF6B9D' },
  bonus: { bg: 'linear-gradient(135deg, #FFE666, #FFD93D)', border: '#FFD93D', glow: '#FFD93D' },
  tiny: { bg: 'linear-gradient(135deg, #B39DFF, #A855F7)', border: '#A855F7', glow: '#A855F7' },
  moving: { bg: 'linear-gradient(135deg, #7DD3FC, #4FC3F7)', border: '#4FC3F7', glow: '#4FC3F7' },
};

export default function AimClickGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const pictureUrl = useGameStore((s) => s.pictureUrl);
  const [visibleTargets, setVisibleTargets] = useState<Target[]>([]);
  const [destroyed, setDestroyed] = useState<Set<number>>(new Set());
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [localScore, setLocalScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const startRef = useRef(Date.now());
  const targetsRef = useRef<Target[]>([]);
  const floatId = useRef(0);

  useEffect(() => {
    if (gameConfig?.data?.targets) targetsRef.current = gameConfig.data.targets;
    else {
      const t: Target[] = [];
      for (let i = 0; i < 70; i++) {
        const p = i / 70; const r = Math.random();
        let type: 'normal' | 'bonus' | 'tiny' | 'moving' = 'normal';
        let sz = Math.max(5, 12 - p * 6), pts = 1;
        if (r > 0.92 && p > 0.3) { type = 'tiny'; sz = 3; pts = 5; }
        else if (r > 0.82 && p > 0.2) { type = 'bonus'; sz = 10; pts = 3; }
        else if (r > 0.7 && p > 0.4) { type = 'moving'; sz = 8; pts = 2; }
        else pts = p > 0.6 ? 2 : 1;
        t.push({ id: i, x: 8 + Math.random() * 84, y: 8 + Math.random() * 74, size: sz, appearAt: 400 + i * 400, duration: type === 'tiny' ? 800 : 1500 - p * 700, points: pts, type, moveAngle: Math.random() * Math.PI * 2, moveSpeed: 5 + p * 15 });
      }
      targetsRef.current = t;
    }
    startRef.current = Date.now();
  }, [gameConfig]);

  // Moving targets + visibility
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setVisibleTargets(targetsRef.current.filter(t => elapsed >= t.appearAt && elapsed <= t.appearAt + t.duration && !destroyed.has(t.id)));
      setTick(t => t + 1);
    }, 30);
    return () => clearInterval(iv);
  }, [destroyed]);

  const getMovingPos = (target: Target) => {
    if (target.type !== 'moving') return { x: target.x, y: target.y };
    const elapsed = Date.now() - startRef.current - target.appearAt;
    const dx = Math.cos(target.moveAngle || 0) * (target.moveSpeed || 10) * (elapsed / 1000);
    const dy = Math.sin(target.moveAngle || 0) * (target.moveSpeed || 10) * (elapsed / 1000);
    return { x: Math.max(5, Math.min(95, target.x + dx)), y: Math.max(5, Math.min(90, target.y + dy)) };
  };

  const addFloat = (x: number, y: number, text: string, color: string) => {
    const fid = floatId.current++;
    setFloats(prev => [...prev, { id: fid, x, y, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 600);
  };

  const handleTargetClick = useCallback((target: Target, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (destroyed.has(target.id) || timeLeft <= 0) return;

    setDestroyed(prev => new Set(prev).add(target.id));
    setHits(h => h + 1);
    setLocalScore(s => s + target.points);

    const pos = getMovingPos(target);
    if (target.type === 'tiny') { playPerfect(); addFloat(pos.x, pos.y, `+${target.points} 💎`, '#A855F7'); }
    else if (target.type === 'bonus') { playGold(); addFloat(pos.x, pos.y, `+${target.points} ⭐`, '#FFD93D'); }
    else { playHit(); addFloat(pos.x, pos.y, `+${target.points}`, '#FF6B9D'); }

    if (matchId) sendGameInput(matchId, 'aim_click', { targetId: target.id });
    if (navigator.vibrate) navigator.vibrate(target.type === 'tiny' ? [15, 8, 15] : 10);
  }, [destroyed, matchId, timeLeft]);

  const handleMiss = (e: React.MouseEvent | React.TouchEvent) => {
    // Only count as miss if no target was clicked
    const target = (e.target as HTMLElement).closest('[data-target]');
    if (!target && timeLeft > 0) {
      setMisses(m => m + 1);
      playMiss();
    }
  };

  const isUrgent = timeLeft <= 5;
  const displayScore = myScore > 0 ? myScore : localScore;
  const accuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 100;

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คุณ</div>
          <div className="text-2xl font-black text-cute-pink tabular-nums">{displayScore}</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-black tabular-nums ${isUrgent ? 'text-cute-red animate-pulse' : 'text-cute-pink'}`}>{timeLeft.toFixed(1)}s</div>
          <div className="text-[10px] text-cute-gray font-semibold">🎯 Aim Click</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คู่แข่ง</div>
          <div className="text-2xl font-black text-cute-blue tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-center gap-4 mb-1 text-[10px] font-semibold">
        <span className="text-cute-gray">🎯 Hits: <b className="text-cute-dark">{hits}</b></span>
        <span className="text-cute-gray">🎪 Accuracy: <b className={accuracy >= 80 ? 'text-cute-mint' : 'text-cute-red'}>{accuracy}%</b></span>
      </div>

      {/* Game Area */}
      <div className="flex-1 relative rounded-3xl overflow-hidden cute-card"
        onClick={handleMiss} onTouchStart={handleMiss}
        style={{ backgroundImage: 'url(/bg-main.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>

        <div className="absolute inset-0" style={{ background: 'rgba(255,248,240,0.8)' }} />

        {/* Targets */}
        {visibleTargets.map(target => {
          const pos = getMovingPos(target);
          const colors = TARGET_COLORS[target.type];
          return (
            <button key={target.id} data-target="true"
              onTouchStart={(e) => handleTargetClick(target, e)}
              onClick={(e) => handleTargetClick(target, e)}
              className="absolute rounded-full active:scale-75 transition-all z-10"
              style={{
                left: `${pos.x}%`, top: `${pos.y}%`,
                width: `${target.size * 2.8}%`, height: `${target.size * 2.8}%`,
                transform: 'translate(-50%, -50%)',
                background: colors.bg,
                border: `3px solid ${colors.border}`,
                boxShadow: `0 4px 15px ${colors.glow}40, 0 6px 0 ${colors.border}80, inset 0 2px 4px rgba(255,255,255,0.4)`,
                animation: target.type === 'moving' ? 'none' : 'pop 0.3s ease',
              }}>
              {/* Shine */}
              <div className="absolute top-0 left-[15%] w-[40%] h-[30%] rounded-full pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.5), transparent)' }} />
              <span className="relative text-xs font-black drop-shadow z-10">
                {TARGET_EMOJIS[target.type]} {target.type === 'tiny' ? '+5' : `+${target.points}`}
              </span>
            </button>
          );
        })}

        {/* Float scores */}
        {floats.map(f => (
          <div key={f.id} className="score-float z-20" style={{ left: `${f.x}%`, top: `${f.y}%`, color: f.color }}>{f.text}</div>
        ))}

        {/* Instructions */}
        {visibleTargets.length === 0 && timeLeft > 28 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <div className="text-cute-gray text-sm animate-pulse">เป้ากำลังจะมา...</div>
            <div className="cute-card px-4 py-3 text-center max-w-[260px]">
              <div className="text-cute-pink text-xs font-bold mb-1">🎯 วิธีเล่น</div>
              <div className="text-cute-gray text-[11px]">กดเป้าให้แม่น! 💎Tiny +5 · ⭐Bonus +3 · 🦋Moving +2</div>
            </div>
          </div>
        )}

        {pictureUrl && <img src={pictureUrl} alt="" className="absolute bottom-2 right-2 w-10 h-10 rounded-full opacity-40 border-2 border-cute-pink/30 z-30" />}
      </div>
    </div>
  );
}
