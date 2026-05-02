import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playHit, playPerfect, playMiss, playWrong, playCorrect } from '../../lib/sounds';

interface FloatScore { id: number; x: number; y: number; text: string; color: string; }

export default function ArcherBattleGame() {
  const { matchId, myScore, oppScore, timeLeft } = useGameStore();
  const pictureUrl = useGameStore((s) => s.pictureUrl);
  const [myHP, setMyHP] = useState(3);
  const [oppHP, setOppHP] = useState(3);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [phase, setPhase] = useState<'aim' | 'power' | 'fly' | 'wait'>('aim');
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(50);
  const [powerDir, setPowerDir] = useState(1);
  const [arrowPos, setArrowPos] = useState<{ x: number; y: number } | null>(null);
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [localScore, setLocalScore] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const floatId = useRef(0);
  const powerRef = useRef(50);
  const powerDirRef = useRef(1);

  // Power bar auto-cycle
  useEffect(() => {
    if (phase !== 'power') return;
    const iv = setInterval(() => {
      powerRef.current += powerDirRef.current * 2;
      if (powerRef.current >= 100) { powerRef.current = 100; powerDirRef.current = -1; }
      if (powerRef.current <= 0) { powerRef.current = 0; powerDirRef.current = 1; }
      setPower(powerRef.current);
    }, 20);
    return () => clearInterval(iv);
  }, [phase]);

  // Simulate opponent turn
  useEffect(() => {
    if (phase === 'wait' && !isMyTurn) {
      const timeout = setTimeout(() => {
        // Opponent shoots (random accuracy)
        const oppAccuracy = 0.3 + Math.random() * 0.4; // 30-70% hit chance
        const hit = Math.random() < oppAccuracy;

        if (hit) {
          setMyHP(hp => {
            const newHP = Math.max(0, hp - 1);
            if (newHP === 0) setLastResult('💀 คุณถูกยิง!');
            return newHP;
          });
          setLastResult('💥 คู่แข่งยิงโดน!');
          playWrong();
          addFloat(25, 65, '-1 ❤️', '#F87171');
        } else {
          setLastResult('😮‍💨 คู่แข่งยิงพลาด!');
          playMiss();
        }

        setTimeout(() => {
          setIsMyTurn(true);
          setPhase('aim');
          setAngle(45);
          powerRef.current = 50;
          setPower(50);
          powerDirRef.current = 1;
          setLastResult(null);
          setTurnCount(t => t + 1);
        }, 1200);
      }, 1000 + Math.random() * 800);
      return () => clearTimeout(timeout);
    }
  }, [phase, isMyTurn]);

  const addFloat = (x: number, y: number, text: string, color: string) => {
    const fid = floatId.current++;
    setFloats(prev => [...prev, { id: fid, x, y, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 700);
  };

  // Aim: drag up/down to change angle
  const handleAimTouch = useCallback((e: React.TouchEvent) => {
    if (phase !== 'aim') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.touches[0].clientY - rect.top;
    const pct = Math.max(0, Math.min(100, (y / rect.height) * 100));
    setAngle(Math.round(10 + (100 - pct) * 0.7)); // 10-80 degrees
  }, [phase]);

  // Confirm aim → go to power phase
  const confirmAim = useCallback(() => {
    if (phase === 'aim') {
      setPhase('power');
      powerRef.current = 50;
      setPower(50);
      powerDirRef.current = 1;
      playCorrect();
    }
  }, [phase]);

  // Shoot arrow
  const shoot = useCallback(() => {
    if (phase !== 'power') return;
    setPhase('fly');
    playHit();
    if (navigator.vibrate) navigator.vibrate([15, 8, 15]);

    // Calculate hit based on angle + power
    const idealAngle = 40 + Math.random() * 10; // sweet spot ~40-50
    const idealPower = 60 + Math.random() * 20; // sweet spot ~60-80
    const angleDiff = Math.abs(angle - idealAngle) / 40;
    const powerDiff = Math.abs(power - idealPower) / 50;
    const accuracy = Math.max(0, 1 - angleDiff - powerDiff);
    const hit = accuracy > 0.4; // need ~40% accuracy to hit

    // Arrow animation
    setArrowPos({ x: 15, y: 70 });
    setTimeout(() => setArrowPos({ x: hit ? 78 : 85 + Math.random() * 10, y: hit ? 60 + Math.random() * 15 : 30 + Math.random() * 40 }), 50);

    setTimeout(() => {
      setArrowPos(null);

      if (hit) {
        const pts = accuracy > 0.8 ? 5 : accuracy > 0.6 ? 3 : 2;
        setOppHP(hp => Math.max(0, hp - 1));
        setLocalScore(s => s + pts);
        setLastResult(pts >= 5 ? '💎 PERFECT HIT!' : pts >= 3 ? '⭐ GREAT HIT!' : '🎯 HIT!');
        if (pts >= 5) playPerfect(); else playHit();
        addFloat(75, 60, `+${pts}`, pts >= 5 ? '#A855F7' : '#FF6B9D');
        if (matchId) sendGameInput(matchId, 'archer_hit', { points: pts, angle, power: Math.round(power) });
      } else {
        setLastResult('💨 ยิงพลาด!');
        playMiss();
        if (matchId) sendGameInput(matchId, 'archer_miss', { angle, power: Math.round(power) });
      }

      // Switch turn
      setTimeout(() => {
        setIsMyTurn(false);
        setPhase('wait');
        setLastResult(null);
        setTurnCount(t => t + 1);
      }, 1000);
    }, 600);
  }, [phase, angle, power, matchId]);

  const isUrgent = timeLeft <= 5;
  const displayScore = myScore > 0 ? myScore : localScore;

  // Game over check
  const gameOver = myHP <= 0 || oppHP <= 0;

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คุณ</div>
          <div className="text-lg font-black text-cute-pink tabular-nums">{displayScore} pts</div>
          <div className="flex gap-0.5">{[...Array(3)].map((_, i) => <span key={i} className="text-sm">{i < myHP ? '❤️' : '🖤'}</span>)}</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-black tabular-nums ${isUrgent ? 'text-cute-red animate-pulse' : 'text-cute-pink'}`}>{timeLeft.toFixed(1)}s</div>
          <div className="text-[10px] text-cute-gray font-semibold">🏹 Archer Battle</div>
          <div className="text-[10px] font-bold mt-0.5" style={{ color: isMyTurn ? '#4ADE80' : '#FFD93D' }}>
            {gameOver ? '🏁 จบเกม!' : isMyTurn ? '🎯 ตาคุณ!' : '⏳ ตาคู่แข่ง...'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คู่แข่ง</div>
          <div className="text-lg font-black text-cute-blue tabular-nums">{oppScore} pts</div>
          <div className="flex gap-0.5">{[...Array(3)].map((_, i) => <span key={i} className="text-sm">{i < oppHP ? '❤️' : '🖤'}</span>)}</div>
        </div>
      </div>

      {/* Result flash */}
      <div className="text-center h-6 mb-1">
        {lastResult && <span className={`font-black text-sm animate-[pop_0.3s_ease] ${lastResult.includes('PERFECT') ? 'text-cute-purple' : lastResult.includes('HIT') || lastResult.includes('พลาด!') && lastResult.includes('คู่') ? 'text-cute-pink' : lastResult.includes('พลาด') ? 'text-cute-gold' : 'text-cute-red'}`}>{lastResult}</span>}
      </div>

      {/* Game Arena */}
      <div className="flex-1 relative rounded-3xl overflow-hidden cute-card"
        style={{ backgroundImage: 'url(/bg-main.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
        onTouchMove={handleAimTouch}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(200,230,255,0.6) 0%, rgba(150,200,150,0.7) 60%, rgba(100,160,100,0.8) 100%)' }} />

        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 h-[25%]" style={{ background: 'linear-gradient(180deg, #7CB342, #558B2F)', borderRadius: '60% 60% 0 0' }} />

        {/* Trees decoration */}
        <div className="absolute bottom-[20%] left-[5%] text-3xl pointer-events-none">🌳</div>
        <div className="absolute bottom-[22%] left-[15%] text-2xl pointer-events-none">🌲</div>
        <div className="absolute bottom-[20%] right-[5%] text-3xl pointer-events-none">🌳</div>
        <div className="absolute bottom-[22%] right-[15%] text-2xl pointer-events-none">🌲</div>
        <div className="absolute top-[10%] right-[10%] text-xl pointer-events-none opacity-60">☁️</div>
        <div className="absolute top-[5%] left-[20%] text-lg pointer-events-none opacity-40">☁️</div>

        {/* My Archer (left) */}
        <div className="absolute bottom-[22%] left-[10%] text-center pointer-events-none z-10">
          <div className="text-4xl" style={{ transform: `rotate(${-(angle - 45)}deg)`, transformOrigin: 'bottom center' }}>🏹</div>
          <div className="text-[10px] font-bold text-cute-pink bg-white/70 rounded-full px-2 mt-1">คุณ</div>
        </div>

        {/* Opponent Archer (right) */}
        <div className="absolute bottom-[22%] right-[10%] text-center pointer-events-none z-10">
          <div className="text-4xl" style={{ transform: 'scaleX(-1)' }}>🏹</div>
          <div className="text-[10px] font-bold text-cute-blue bg-white/70 rounded-full px-2 mt-1">คู่แข่ง</div>
        </div>

        {/* Arrow flight */}
        {arrowPos && (
          <div className="absolute z-20 transition-all duration-500 ease-out pointer-events-none"
            style={{ left: `${arrowPos.x}%`, top: `${arrowPos.y}%`, transform: 'translate(-50%, -50%)' }}>
            <div className="text-2xl" style={{ transform: 'rotate(-30deg)' }}>➜</div>
          </div>
        )}

        {/* Aim line (when aiming) */}
        {phase === 'aim' && isMyTurn && (
          <svg className="absolute inset-0 w-full h-full z-15 pointer-events-none" viewBox="0 0 100 100">
            <line x1="15" y1="72" x2={15 + Math.cos(angle * Math.PI / 180) * 30} y2={72 - Math.sin(angle * Math.PI / 180) * 30}
              stroke="#FF6B9D" strokeWidth="0.4" strokeDasharray="1,1" opacity="0.7" />
            <text x="22" y="60" fill="#FF6B9D" fontSize="3" fontWeight="bold">{angle}°</text>
          </svg>
        )}

        {/* Float scores */}
        {floats.map(f => <div key={f.id} className="score-float z-30" style={{ left: `${f.x}%`, top: `${f.y}%`, color: f.color }}>{f.text}</div>)}

        {pictureUrl && <img src={pictureUrl} alt="" className="absolute bottom-2 right-2 w-10 h-10 rounded-full opacity-30 border-2 border-cute-pink/30 z-30 pointer-events-none" />}
      </div>

      {/* Controls */}
      <div className="mt-2">
        {phase === 'aim' && isMyTurn && !gameOver && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-cute-gray text-xs font-semibold w-16">มุม: {angle}°</span>
              <input type="range" min="10" max="80" value={angle} onChange={(e) => setAngle(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none" style={{ background: `linear-gradient(to right, #FF6B9D ${((angle - 10) / 70) * 100}%, #F3E8DE ${((angle - 10) / 70) * 100}%)` }} />
            </div>
            <button onClick={confirmAim}
              className="cute-btn w-full h-14 bg-cute-pink text-white text-lg font-black shadow-lg shadow-cute-pink/20 active:bg-cute-pink/80 touch-manipulation">
              🎯 ล็อคมุม → ตั้งพลัง
            </button>
          </div>
        )}

        {phase === 'power' && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-cute-gray text-xs font-semibold w-16">พลัง:</span>
              <div className="flex-1 h-4 bg-cute-border rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-75" style={{
                  width: `${power}%`,
                  background: power > 75 ? 'linear-gradient(90deg, #4ADE80, #FF6B9D)' : power > 40 ? 'linear-gradient(90deg, #4ADE80, #FFD93D)' : '#4FC3F7',
                }} />
              </div>
              <span className="text-cute-dark text-xs font-black w-10 tabular-nums">{Math.round(power)}%</span>
            </div>
            <button onClick={shoot}
              className="cute-btn w-full h-14 bg-cute-red text-white text-lg font-black shadow-lg shadow-cute-red/20 active:bg-cute-red/80 touch-manipulation animate-pulse">
              🏹 ยิง!
            </button>
          </div>
        )}

        {phase === 'fly' && (
          <div className="text-center text-cute-pink font-bold text-sm py-4 animate-pulse">🏹 ลูกธนูกำลังบิน...</div>
        )}

        {phase === 'wait' && !isMyTurn && !gameOver && (
          <div className="text-center text-cute-gold font-bold text-sm py-4 animate-[bounce-cute_1s_ease_infinite]">⏳ รอคู่แข่งยิง...</div>
        )}

        {gameOver && (
          <div className="text-center py-3">
            <div className="text-2xl font-black mb-1">{myHP > oppHP ? '🏆 คุณชนะ!' : '😤 คุณแพ้!'}</div>
          </div>
        )}

        {/* First turn instruction */}
        {turnCount === 0 && phase === 'aim' && (
          <div className="text-center mt-1">
            <div className="inline-block cute-card px-3 py-1.5 text-[10px] text-cute-gray">
              📌 เลื่อนแถบเลือกมุม → กดล็อค → กดยิงตอน power bar ตรง!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
