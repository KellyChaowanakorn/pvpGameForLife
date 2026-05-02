import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playHit, playPerfect, playMiss, playWrong, playCorrect } from '../../lib/sounds';

interface FloatScore { id: number; x: number; y: number; text: string; color: string; }
interface Bird { id: number; x: number; y: number; speed: number; type: string; }

export default function ArcherBattleGame() {
  const { matchId, myScore, oppScore, timeLeft } = useGameStore();
  const pictureUrl = useGameStore((s) => s.pictureUrl);
  const [myHP, setMyHP] = useState(3);
  const [oppHP, setOppHP] = useState(3);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [phase, setPhase] = useState<'ready' | 'aiming' | 'fly' | 'wait'>('ready');
  const [power, setPower] = useState(50);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [arrowPos, setArrowPos] = useState<{ x: number; y: number } | null>(null);
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [localScore, setLocalScore] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [birds, setBirds] = useState<Bird[]>([]);
  const [wind, setWind] = useState(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const floatId = useRef(0);
  const powerRef = useRef(50);
  const powerDirRef = useRef(1);

  useEffect(() => {
    const bl: Bird[] = [
      { id: 1, x: -10, y: 8, speed: 0.15, type: '🕊️' },
      { id: 2, x: -30, y: 12, speed: 0.12, type: '🐦' },
      { id: 3, x: -50, y: 6, speed: 0.18, type: '🕊️' },
      { id: 4, x: -70, y: 15, speed: 0.1, type: '🐦' },
    ];
    setBirds(bl);
    const iv = setInterval(() => {
      setBirds(prev => prev.map(b => ({ ...b, x: b.x > 110 ? -15 - Math.random() * 20 : b.x + b.speed, y: b.y + Math.sin(Date.now() * 0.002 + b.id) * 0.05 })));
    }, 30);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { setWind(Math.round((Math.random() - 0.5) * 10)); }, [turnCount]);

  useEffect(() => {
    if (phase !== 'aiming') return;
    const iv = setInterval(() => {
      powerRef.current += powerDirRef.current * 1.5;
      if (powerRef.current >= 100) { powerRef.current = 100; powerDirRef.current = -1; }
      if (powerRef.current <= 0) { powerRef.current = 0; powerDirRef.current = 1; }
      setPower(powerRef.current);
    }, 20);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase === 'wait' && !isMyTurn) {
      const t = setTimeout(() => {
        const hit = Math.random() < 0.45;
        if (hit) { setMyHP(hp => Math.max(0, hp - 1)); setLastResult('💥 คู่แข่งยิงโดน!'); playWrong(); addFloat(25, 55, '-1 ❤️', '#F87171'); }
        else { setLastResult('😮‍💨 คู่แข่งยิงพลาด!'); playMiss(); }
        setTimeout(() => { setIsMyTurn(true); setPhase('ready'); powerRef.current = 50; setPower(50); powerDirRef.current = 1; setLastResult(null); setTurnCount(t => t + 1); }, 1200);
      }, 1000 + Math.random() * 800);
      return () => clearTimeout(t);
    }
  }, [phase, isMyTurn]);

  const addFloat = (x: number, y: number, text: string, color: string) => {
    const fid = floatId.current++; setFloats(prev => [...prev, { id: fid, x, y, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 700);
  };

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = gameAreaRef.current?.getBoundingClientRect(); if (!rect) return null;
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: ((cx - rect.left) / rect.width) * 100, y: ((cy - rect.top) / rect.height) * 100 };
  };

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (phase !== 'ready' || !isMyTurn || timeLeft <= 0 || myHP <= 0 || oppHP <= 0) return;
    e.preventDefault(); const pos = getPos(e); if (!pos) return;
    setDragStart(pos); setDragCurrent(pos); setPhase('aiming');
    powerRef.current = 50; setPower(50); powerDirRef.current = 1;
  }, [phase, isMyTurn, timeLeft, myHP, oppHP]);

  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (phase !== 'aiming' || !dragStart) return; e.preventDefault();
    const pos = getPos(e); if (pos) setDragCurrent(pos);
  }, [phase, dragStart]);

  const handleEnd = useCallback(() => {
    if (phase !== 'aiming' || !dragStart || !dragCurrent) return;
    const dx = dragStart.x - dragCurrent.x, dy = dragStart.y - dragCurrent.y;
    if (Math.sqrt(dx * dx + dy * dy) < 5) { setPhase('ready'); setDragStart(null); setDragCurrent(null); return; }
    const aimAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    const cp = powerRef.current;
    setPhase('fly'); playHit(); if (navigator.vibrate) navigator.vibrate([15, 8, 15]);
    const idealAngle = 30 + Math.random() * 20, idealPower = 55 + Math.random() * 25;
    const accuracy = Math.max(0, 1 - Math.abs(aimAngle - idealAngle) / 60 - Math.abs(cp - idealPower) / 60 - Math.abs(wind) * 0.02);
    const hit = accuracy > 0.35;
    const tx = hit ? 75 + Math.random() * 8 : 70 + Math.random() * 25;
    const ty = hit ? 50 + Math.random() * 15 : 25 + Math.random() * 45;
    setArrowPos({ x: 18, y: 65 }); setTimeout(() => setArrowPos({ x: tx, y: ty }), 50);
    setTimeout(() => {
      setArrowPos(null);
      if (hit) {
        const pts = accuracy > 0.75 ? 5 : accuracy > 0.55 ? 3 : 2;
        setOppHP(hp => Math.max(0, hp - 1)); setLocalScore(s => s + pts);
        setLastResult(pts >= 5 ? '💎 PERFECT!' : pts >= 3 ? '⭐ GREAT!' : '🎯 HIT!');
        if (pts >= 5) playPerfect(); else playCorrect();
        addFloat(tx, ty, `+${pts}`, pts >= 5 ? '#A855F7' : '#FF6B9D');
        if (matchId) sendGameInput(matchId, 'archer_hit', { points: pts });
      } else { setLastResult('💨 พลาด!'); playMiss(); if (matchId) sendGameInput(matchId, 'archer_miss', {}); }
      if (navigator.vibrate) navigator.vibrate(hit ? [10, 5, 10] : [30, 20, 30]);
      setTimeout(() => { setIsMyTurn(false); setPhase('wait'); setLastResult(null); setDragStart(null); setDragCurrent(null); setTurnCount(t => t + 1); }, 1000);
    }, 600);
  }, [phase, dragStart, dragCurrent, matchId, wind]);

  const isUrgent = timeLeft <= 5;
  const displayScore = myScore > 0 ? myScore : localScore;
  const gameOver = myHP <= 0 || oppHP <= 0;
  const swipeAngle = dragStart && dragCurrent ? Math.atan2(dragStart.y - dragCurrent.y, dragStart.x - dragCurrent.x) * 180 / Math.PI : 0;

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คุณ 🏹</div>
          <div className="text-lg font-black text-cute-pink tabular-nums">{displayScore}</div>
          <div className="flex gap-0.5 justify-center">{[...Array(3)].map((_, i) => <span key={i} className="text-sm">{i < myHP ? '❤️' : '🖤'}</span>)}</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-black tabular-nums ${isUrgent ? 'text-cute-red animate-pulse' : 'text-cute-pink'}`}>{timeLeft.toFixed(1)}s</div>
          <div className="text-[10px] text-cute-gray font-semibold">🏹 Archer Battle</div>
          <div className="text-[10px] font-bold mt-0.5" style={{ color: isMyTurn ? '#4ADE80' : '#FFD93D' }}>
            {gameOver ? '🏁 จบ!' : isMyTurn ? '🎯 ตาคุณ!' : '⏳ รอคู่แข่ง...'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คู่แข่ง 🏹</div>
          <div className="text-lg font-black text-cute-blue tabular-nums">{oppScore}</div>
          <div className="flex gap-0.5 justify-center">{[...Array(3)].map((_, i) => <span key={i} className="text-sm">{i < oppHP ? '❤️' : '🖤'}</span>)}</div>
        </div>
      </div>

      <div className="text-center h-5 mb-0.5">
        <span className="text-[10px] text-cute-gray">💨 ลม: <b className={wind > 0 ? 'text-cute-blue' : wind < 0 ? 'text-cute-orange' : 'text-cute-mint'}>{wind > 0 ? `→ ${wind}` : wind < 0 ? `← ${Math.abs(wind)}` : 'สงบ'}</b></span>
        {lastResult && <span className={`ml-2 font-black text-sm animate-[pop_0.3s_ease] ${lastResult.includes('PERFECT') ? 'text-cute-purple' : lastResult.includes('HIT') || lastResult.includes('GREAT') ? 'text-cute-pink' : lastResult.includes('พลาด') ? 'text-cute-gold' : 'text-cute-red'}`}>{lastResult}</span>}
      </div>

      <div ref={gameAreaRef} className="flex-1 relative rounded-3xl overflow-hidden cute-card touch-none"
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}>

        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #B0E2FF 30%, #E0F4FF 55%, #90C695 60%, #6B8F3C 65%, #5A7A32 100%)' }} />
        <div className="absolute top-[6%] right-[12%] w-10 h-10 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #FFE082, #FFD54F)', boxShadow: '0 0 30px #FFE08280' }} />
        <div className="absolute top-[8%] left-[5%] text-3xl pointer-events-none opacity-70">☁️</div>
        <div className="absolute top-[4%] left-[35%] text-2xl pointer-events-none opacity-50">☁️</div>
        <div className="absolute top-[12%] right-[25%] text-xl pointer-events-none opacity-40">☁️</div>

        {birds.map(b => (<div key={b.id} className="absolute pointer-events-none text-lg" style={{ left: `${b.x}%`, top: `${b.y}%` }}>{b.type}</div>))}

        <svg className="absolute bottom-[38%] w-full pointer-events-none" viewBox="0 0 100 20" preserveAspectRatio="none">
          <polygon points="0,20 10,5 25,12 35,3 50,15 60,6 75,13 85,4 100,20" fill="#7BA05B" opacity="0.4" />
        </svg>

        <div className="absolute bottom-[32%] left-[2%] pointer-events-none text-2xl">🌳</div>
        <div className="absolute bottom-[34%] left-[8%] pointer-events-none text-3xl">🌲</div>
        <div className="absolute bottom-[31%] left-[22%] pointer-events-none text-xl">🌿</div>
        <div className="absolute bottom-[33%] right-[3%] pointer-events-none text-2xl">🌳</div>
        <div className="absolute bottom-[35%] right-[9%] pointer-events-none text-3xl">🌲</div>
        <div className="absolute bottom-[31%] right-[20%] pointer-events-none text-xl">🌿</div>
        <div className="absolute bottom-[32%] left-[45%] pointer-events-none text-xl">🌿</div>
        <div className="absolute bottom-[28%] left-[15%] pointer-events-none text-xs">🌼</div>
        <div className="absolute bottom-[27%] left-[30%] pointer-events-none text-xs">🌷</div>
        <div className="absolute bottom-[28%] right-[18%] pointer-events-none text-xs">🌻</div>

        {/* My Archer - Female */}
        <div className="absolute bottom-[30%] left-[10%] pointer-events-none z-10">
          <svg width="50" height="70" viewBox="0 0 50 70" style={{ transform: phase === 'aiming' ? `rotate(${-Math.min(30, Math.max(-10, swipeAngle - 30))}deg)` : 'none', transformOrigin: 'bottom center', transition: 'transform 0.1s' }}>
            <ellipse cx="25" cy="12" rx="12" ry="10" fill="#8B4513" />
            <ellipse cx="30" cy="14" rx="6" ry="12" fill="#8B4513" />
            <circle cx="25" cy="14" r="9" fill="#FFD5B8" />
            <circle cx="22" cy="13" r="1.5" fill="#3D2914" /><circle cx="28" cy="13" r="1.5" fill="#3D2914" />
            <circle cx="22.5" cy="12.5" r="0.5" fill="white" /><circle cx="28.5" cy="12.5" r="0.5" fill="white" />
            <path d="M23 17 Q25 19 27 17" stroke="#E57373" strokeWidth="0.8" fill="none" />
            <circle cx="19" cy="16" r="2" fill="#FFB6C1" opacity="0.5" /><circle cx="31" cy="16" r="2" fill="#FFB6C1" opacity="0.5" />
            <rect x="18" y="24" width="14" height="22" rx="3" fill="#FF6B9D" />
            <rect x="17" y="36" width="16" height="3" rx="1" fill="#8B4513" />
            <path d="M18 24 L10 40 L18 38" fill="#C62828" opacity="0.7" />
            <rect x="20" y="46" width="4" height="18" rx="2" fill="#FFD5B8" /><rect x="26" y="46" width="4" height="18" rx="2" fill="#FFD5B8" />
            <rect x="19" y="60" width="6" height="5" rx="2" fill="#5D4037" /><rect x="25" y="60" width="6" height="5" rx="2" fill="#5D4037" />
            <line x1="32" y1="28" x2="42" y2="22" stroke="#FFD5B8" strokeWidth="3" strokeLinecap="round" />
            <path d="M42 15 Q48 22 42 30" stroke="#8B4513" strokeWidth="2" fill="none" />
            <line x1="42" y1="15" x2="42" y2="30" stroke="#A0A0A0" strokeWidth="0.5" />
          </svg>
          <div className="text-[9px] font-bold text-cute-pink bg-white/80 rounded-full px-2 text-center mt-1">คุณ</div>
        </div>

        {/* Opponent Archer - Male */}
        <div className="absolute bottom-[30%] right-[8%] pointer-events-none z-10">
          <svg width="50" height="70" viewBox="0 0 50 70" style={{ transform: 'scaleX(-1)' }}>
            <ellipse cx="25" cy="11" rx="11" ry="9" fill="#3D2914" />
            <circle cx="25" cy="14" r="9" fill="#FFCCAA" />
            <circle cx="22" cy="13" r="1.5" fill="#3D2914" /><circle cx="28" cy="13" r="1.5" fill="#3D2914" />
            <circle cx="22.5" cy="12.5" r="0.5" fill="white" /><circle cx="28.5" cy="12.5" r="0.5" fill="white" />
            <path d="M23 17 Q25 18 27 17" stroke="#3D2914" strokeWidth="0.8" fill="none" />
            <rect x="18" y="24" width="14" height="22" rx="3" fill="#4FC3F7" />
            <rect x="17" y="36" width="16" height="3" rx="1" fill="#5D4037" />
            <path d="M18 24 L10 40 L18 38" fill="#1565C0" opacity="0.7" />
            <rect x="20" y="46" width="4" height="18" rx="2" fill="#FFCCAA" /><rect x="26" y="46" width="4" height="18" rx="2" fill="#FFCCAA" />
            <rect x="19" y="60" width="6" height="5" rx="2" fill="#3E2723" /><rect x="25" y="60" width="6" height="5" rx="2" fill="#3E2723" />
            <line x1="32" y1="28" x2="42" y2="22" stroke="#FFCCAA" strokeWidth="3" strokeLinecap="round" />
            <path d="M42 15 Q48 22 42 30" stroke="#5D4037" strokeWidth="2" fill="none" />
            <line x1="42" y1="15" x2="42" y2="30" stroke="#A0A0A0" strokeWidth="0.5" />
          </svg>
          <div className="text-[9px] font-bold text-cute-blue bg-white/80 rounded-full px-2 text-center mt-1">คู่แข่ง</div>
        </div>

        {/* Swipe trail */}
        {phase === 'aiming' && dragStart && dragCurrent && (
          <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1={dragStart.x} y1={dragStart.y} x2={dragStart.x + (dragStart.x - dragCurrent.x) * 0.8} y2={dragStart.y + (dragStart.y - dragCurrent.y) * 0.8}
              stroke="#FF6B9D" strokeWidth="0.3" strokeDasharray="1,1.5" opacity="0.5" />
            <circle cx={dragCurrent.x} cy={dragCurrent.y} r="2.5" fill="#FF6B9D" opacity="0.4" />
          </svg>
        )}

        {arrowPos && (
          <div className="absolute z-20 pointer-events-none transition-all duration-500 ease-out" style={{ left: `${arrowPos.x}%`, top: `${arrowPos.y}%`, transform: 'translate(-50%, -50%)' }}>
            <div className="text-xl" style={{ transform: 'rotate(-25deg)' }}>🏹</div>
          </div>
        )}

        {/* Power bar bottom-left */}
        {phase === 'aiming' && (
          <div className="absolute bottom-3 left-3 z-30 bg-white/85 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-cute-border" style={{ width: '45px' }}>
            <div className="text-[8px] font-bold text-cute-dark text-center mb-1">💪</div>
            <div className="w-full h-20 bg-cute-border rounded-full overflow-hidden relative">
              <div className="absolute bottom-0 w-full rounded-full transition-all duration-75" style={{
                height: `${power}%`,
                background: power > 75 ? 'linear-gradient(0deg, #4ADE80, #FF6B9D)' : power > 40 ? 'linear-gradient(0deg, #4ADE80, #FFD93D)' : '#4FC3F7',
              }} />
            </div>
            <div className="text-[8px] font-black text-cute-dark text-center mt-1 tabular-nums">{Math.round(power)}%</div>
          </div>
        )}

        {floats.map(f => <div key={f.id} className="score-float z-30" style={{ left: `${f.x}%`, top: `${f.y}%`, color: f.color }}>{f.text}</div>)}

        {phase === 'ready' && isMyTurn && !gameOver && turnCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-3 text-center shadow-lg border border-cute-pink/20 animate-[bounce-cute_2s_ease_infinite]">
              <div className="text-lg mb-1">👆</div>
              <div className="text-cute-dark text-xs font-bold">ลากนิ้วเล็ง แล้วปล่อยเพื่อยิง!</div>
              <div className="text-cute-gray text-[10px]">power bar ซ้ายล่าง · กะจังหวะดีๆ</div>
            </div>
          </div>
        )}

        {phase === 'ready' && isMyTurn && !gameOver && turnCount > 0 && (
          <div className="absolute bottom-3 right-3 z-20">
            <div className="bg-cute-pink/90 text-white rounded-2xl px-4 py-2 text-xs font-bold shadow-lg animate-pulse">👆 ลากเพื่อเล็ง!</div>
          </div>
        )}

        {phase === 'wait' && !isMyTurn && !gameOver && (
          <div className="absolute bottom-3 right-3 z-20">
            <div className="bg-cute-gold/90 text-cute-dark rounded-2xl px-4 py-2 text-xs font-bold shadow-lg animate-[bounce-cute_1s_ease_infinite]">⏳ คู่แข่งกำลังเล็ง...</div>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/20">
            <div className="bg-white/95 rounded-3xl px-8 py-5 text-center shadow-xl">
              <div className="text-4xl mb-2">{myHP > oppHP ? '🏆' : '😤'}</div>
              <div className={`text-xl font-black ${myHP > oppHP ? 'text-cute-mint' : 'text-cute-red'}`}>{myHP > oppHP ? 'คุณชนะ!' : 'คุณแพ้!'}</div>
            </div>
          </div>
        )}

        {pictureUrl && <img src={pictureUrl} alt="" className="absolute top-2 left-2 w-8 h-8 rounded-full opacity-40 border-2 border-cute-pink/30 z-30 pointer-events-none" />}
      </div>
    </div>
  );
}
