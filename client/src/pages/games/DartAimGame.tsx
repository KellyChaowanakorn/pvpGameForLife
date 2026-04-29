import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playHit, playPerfect, playGold, playMiss } from '../../lib/sounds';

interface FloatScore { id: number; x: number; y: number; text: string; color: string; }
interface FlyingDart { id: number; startX: number; startY: number; endX: number; endY: number; startTime: number; }

// Board center position (percentage of game area)
const BOARD_CX = 50;
const BOARD_CY = 35;
const BOARD_RADIUS = 28; // % of width

const RINGS = [
  { radius: 0.12, points: 10, color: '#FF6B9D', label: '💎 10' },
  { radius: 0.25, points: 7, color: '#A855F7', label: '⭐ 7' },
  { radius: 0.45, points: 5, color: '#4FC3F7', label: '5' },
  { radius: 0.7, points: 3, color: '#FFD93D', label: '3' },
  { radius: 1.0, points: 1, color: '#4ADE80', label: '1' },
];

export default function DartAimGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const pictureUrl = useGameStore((s) => s.pictureUrl);
  const [localScore, setLocalScore] = useState(0);
  const [throws, setThrows] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [flyingDart, setFlyingDart] = useState<FlyingDart | null>(null);
  const [landedDarts, setLandedDarts] = useState<{ x: number; y: number; points: number }[]>([]);
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [lastHit, setLastHit] = useState<string | null>(null);
  const [canThrow, setCanThrow] = useState(true);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const floatId = useRef(0);
  const dartId = useRef(0);

  const addFloat = (x: number, y: number, text: string, color: string) => {
    const fid = floatId.current++;
    setFloats(prev => [...prev, { id: fid, x, y, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 700);
  };

  // Get touch/mouse position relative to game area (0-100%)
  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  // Start drag
  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!canThrow || timeLeft <= 0) return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos || pos.y < 60) return; // Only drag from bottom area
    setIsDragging(true);
    setDragStart(pos);
    setDragCurrent(pos);
  }, [canThrow, timeLeft]);

  // Move drag
  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const pos = getPos(e);
    if (pos) setDragCurrent(pos);
  }, [isDragging]);

  // Release - launch dart!
  const handleEnd = useCallback(() => {
    if (!isDragging || !dragStart || !dragCurrent) return;
    setIsDragging(false);

    // Calculate launch vector (opposite of drag direction)
    const dx = dragStart.x - dragCurrent.x;
    const dy = dragStart.y - dragCurrent.y;
    const power = Math.sqrt(dx * dx + dy * dy);

    if (power < 5) { // Too short, cancel
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    // Normalize and calculate landing position
    const maxPower = 50;
    const normalizedPower = Math.min(power / maxPower, 1);

    // Aim toward board center with drag offset
    const angle = Math.atan2(dy, dx);
    const spread = (1 - normalizedPower) * 25; // More power = more accurate
    const randomOffset = (Math.random() - 0.5) * spread;

    const landX = BOARD_CX + Math.cos(angle + randomOffset * 0.1) * (1 - normalizedPower) * 20 + (Math.random() - 0.5) * spread;
    const landY = BOARD_CY + Math.sin(angle + randomOffset * 0.1) * (1 - normalizedPower) * 15 + (Math.random() - 0.5) * spread * 0.7;

    // Launch animation
    setCanThrow(false);
    const dart: FlyingDart = {
      id: dartId.current++,
      startX: dragStart.x,
      startY: dragStart.y,
      endX: Math.max(5, Math.min(95, landX)),
      endY: Math.max(10, Math.min(60, landY)),
      startTime: Date.now(),
    };
    setFlyingDart(dart);

    // After flight, calculate score
    setTimeout(() => {
      setFlyingDart(null);

      // Distance from board center
      const distX = (dart.endX - BOARD_CX) / BOARD_RADIUS;
      const distY = (dart.endY - BOARD_CY) / BOARD_RADIUS;
      const dist = Math.sqrt(distX * distX + distY * distY);

      let points = 0;
      let hitLabel = '';
      for (const ring of RINGS) {
        if (dist <= ring.radius) {
          points = ring.points;
          hitLabel = ring.label;
          break;
        }
      }

      if (points > 0) {
        setLocalScore(s => s + points);
        setLandedDarts(prev => [...prev, { x: dart.endX, y: dart.endY, points }]);
        setThrows(t => t + 1);

        if (points >= 10) { playPerfect(); setLastHit('BULLSEYE! 💎'); addFloat(dart.endX, dart.endY, `+${points}`, '#FF6B9D'); }
        else if (points >= 7) { playGold(); setLastHit('GREAT! ⭐'); addFloat(dart.endX, dart.endY, `+${points}`, '#A855F7'); }
        else { playHit(); setLastHit(`+${points}`); addFloat(dart.endX, dart.endY, `+${points}`, '#4ADE80'); }

        if (matchId) sendGameInput(matchId, 'dart_throw', { points, dist: dist.toFixed(3) });
        if (navigator.vibrate) navigator.vibrate(points >= 10 ? [20, 10, 20, 10, 20] : [15]);
      } else {
        playMiss();
        setLastHit('MISS! 😅');
        setThrows(t => t + 1);
        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
      }

      setTimeout(() => setLastHit(null), 800);
      setTimeout(() => setCanThrow(true), 300);
    }, 400);

    setDragStart(null);
    setDragCurrent(null);
  }, [isDragging, dragStart, dragCurrent, matchId]);

  // Calculate pull info
  const pullPower = dragStart && dragCurrent ? Math.min(Math.sqrt((dragStart.x - dragCurrent.x) ** 2 + (dragStart.y - dragCurrent.y) ** 2) / 50, 1) : 0;
  const isUrgent = timeLeft <= 5;
  const displayScore = myScore > 0 ? myScore : localScore;

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คุณ</div>
          <div className="text-2xl font-black text-cute-pink tabular-nums">{displayScore}</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-black tabular-nums ${isUrgent ? 'text-cute-red animate-pulse' : 'text-cute-pink'}`}>{timeLeft.toFixed(1)}s</div>
          <div className="text-[10px] text-cute-gray font-semibold">🎯 Dart Aim</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คู่แข่ง</div>
          <div className="text-2xl font-black text-cute-blue tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Hit result */}
      <div className="text-center h-6 mb-1">
        {lastHit && <span className={`font-black text-sm animate-[pop_0.3s_ease] ${lastHit.includes('BULL') ? 'text-cute-pink' : lastHit.includes('GREAT') ? 'text-cute-purple' : lastHit.includes('MISS') ? 'text-cute-red' : 'text-cute-mint'}`}>{lastHit}</span>}
      </div>

      {/* Game Area */}
      <div ref={gameAreaRef}
        className="flex-1 relative rounded-3xl overflow-hidden cute-card touch-none"
        style={{ backgroundImage: 'url(/bg-dart.png)', backgroundSize: 'contain', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat', backgroundColor: '#FFF8F0' }}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
      >
        <div className="absolute inset-0" style={{ background: 'rgba(255,248,240,0.3)' }} />

        {/* Board scoring zones are from the background image */}
        {/* Center reference point (invisible, for score calculation) */}

        {/* Landed darts */}
        {landedDarts.map((d, i) => (
          <div key={i} className="absolute z-20 pointer-events-none" style={{ left: `${d.x}%`, top: `${d.y}%`, transform: 'translate(-50%, -50%)' }}>
            <div className="text-lg">🎯</div>
          </div>
        ))}

        {/* Flying dart animation */}
        {flyingDart && (
          <div className="absolute z-20 pointer-events-none transition-all duration-[400ms] ease-out"
            style={{
              left: `${flyingDart.endX}%`,
              top: `${flyingDart.endY}%`,
              transform: 'translate(-50%, -50%) scale(1.3)',
            }}>
            <div className="text-2xl animate-[pop_0.3s_ease]">🏹</div>
          </div>
        )}

        {/* Drag/aim visualization */}
        {isDragging && dragStart && dragCurrent && (
          <svg className="absolute inset-0 w-full h-full z-30 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Pull line */}
            <line x1={dragStart.x} y1={dragStart.y} x2={dragCurrent.x} y2={dragCurrent.y}
              stroke="#FF6B9D" strokeWidth="0.6" strokeDasharray="1,1" opacity="0.8" />

            {/* Aim direction (opposite) */}
            <line
              x1={dragStart.x} y1={dragStart.y}
              x2={dragStart.x + (dragStart.x - dragCurrent.x) * 0.5}
              y2={dragStart.y + (dragStart.y - dragCurrent.y) * 0.5}
              stroke="#FF6B9D" strokeWidth="0.4" opacity="0.5" />

            {/* Launch point */}
            <circle cx={dragStart.x} cy={dragStart.y} r="2" fill="#FF6B9D" opacity="0.6" />

            {/* Drag handle */}
            <circle cx={dragCurrent.x} cy={dragCurrent.y} r="3" fill="#FF6B9D" opacity="0.4" />
          </svg>
        )}

        {/* Power meter */}
        {isDragging && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30">
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-lg border border-cute-pink/30">
              <div className="text-xs font-bold text-cute-dark">
                💪 พลัง: <span className={pullPower > 0.7 ? 'text-cute-red' : pullPower > 0.4 ? 'text-cute-orange' : 'text-cute-mint'}>{Math.round(pullPower * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Float scores */}
        {floats.map(f => (
          <div key={f.id} className="score-float z-40" style={{ left: `${f.x}%`, top: `${f.y}%`, color: f.color }}>{f.text}</div>
        ))}

        {/* Launch zone indicator */}
        {canThrow && !isDragging && timeLeft > 0 && (
          <div className="absolute bottom-4 left-0 right-0 text-center z-10">
            <div className="inline-block bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2 border border-cute-pink/20 animate-[bounce-cute_2s_ease_infinite]">
              <div className="text-cute-dark text-xs font-bold">👆 ลากลงแล้วปล่อย! ยิ่งดึงแรง ยิ่งแม่น</div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="absolute top-2 left-2 z-10 bg-white/70 rounded-xl px-2 py-1 text-[10px] font-semibold text-cute-gray">
          🎯 ยิงแล้ว: {throws}
        </div>

        {pictureUrl && <img src={pictureUrl} alt="" className="absolute bottom-2 right-2 w-10 h-10 rounded-full opacity-30 border-2 border-cute-pink/30 z-30 pointer-events-none" />}
      </div>
    </div>
  );
}
