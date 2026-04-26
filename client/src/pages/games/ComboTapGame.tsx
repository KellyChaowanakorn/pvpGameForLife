import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playCorrect, playWrong, playCombo, playPerfect, playFireMode } from '../../lib/sounds';

const COLORS = [
  { id: 'red', label: 'R',
    bg: 'linear-gradient(145deg, #fca5a5 0%, #ef4444 25%, #dc2626 60%, #7f1d1d 100%)',
    glow: '#ef4444', shadow: '#7f1d1d', shine: '#fca5a5' },
  { id: 'blue', label: 'B',
    bg: 'linear-gradient(145deg, #93c5fd 0%, #3b82f6 25%, #2563eb 60%, #1e3a8a 100%)',
    glow: '#3b82f6', shadow: '#1e3a8a', shine: '#93c5fd' },
  { id: 'green', label: 'G',
    bg: 'linear-gradient(145deg, #86efac 0%, #22c55e 25%, #16a34a 60%, #14532d 100%)',
    glow: '#22c55e', shadow: '#14532d', shine: '#86efac' },
  { id: 'yellow', label: 'Y',
    bg: 'linear-gradient(145deg, #fde68a 0%, #fbbf24 25%, #f59e0b 60%, #78350f 100%)',
    glow: '#fbbf24', shadow: '#78350f', shine: '#fde68a' },
];

interface ComboStep { id: number; color: string; showAt: number; timeLimit: number; type: 'normal' | 'rainbow'; }
interface FloatScore { id: number; text: string; color: string; }

export default function ComboTapGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const pictureUrl = useGameStore((s) => s.pictureUrl);
  const [currentColor, setCurrentColor] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState<'normal' | 'rainbow'>('normal');
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [fireMode, setFireMode] = useState(false);
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState(1);
  const [pressedBtn, setPressedBtn] = useState<string | null>(null);
  const stepsRef = useRef<ComboStep[]>([]);
  const startRef = useRef(Date.now());
  const floatId = useRef(0);

  useEffect(() => {
    if (gameConfig?.data?.steps) stepsRef.current = gameConfig.data.steps;
    else {
      const colors = ['red', 'blue', 'green', 'yellow'];
      const steps: ComboStep[] = []; let t = 600, id = 0;
      while (t < 30000 - 400) {
        const p = t / 30000; const tl = Math.max(350, 1000 - p * 600);
        const isRainbow = Math.random() > 0.9 && p > 0.3;
        steps.push({ id: id++, color: isRainbow ? 'rainbow' : colors[Math.floor(Math.random() * 4)], showAt: t, timeLimit: tl, type: isRainbow ? 'rainbow' : 'normal' });
        t += tl + 80;
      }
      stepsRef.current = steps;
    }
    startRef.current = Date.now();
  }, [gameConfig]);

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setPhase(elapsed < 10000 ? 1 : elapsed < 20000 ? 2 : 3);
      if (stepIdx < stepsRef.current.length) {
        const step = stepsRef.current[stepIdx];
        if (elapsed >= step.showAt) {
          setCurrentColor(step.color); setCurrentType(step.type);
          if (elapsed > step.showAt + step.timeLimit) { setStepIdx(i => i + 1); setCombo(0); setFireMode(false); setCurrentColor(null); }
        }
      } else setCurrentColor(null);
    }, 30);
    return () => clearInterval(iv);
  }, [stepIdx]);

  const addFloat = (text: string, color: string) => {
    const fid = floatId.current++;
    setFloats(prev => [...prev, { id: fid, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 600);
  };

  const handleColorTap = useCallback((color: string) => {
    if (timeLeft <= 0 || !currentColor) return;
    setPressedBtn(color); setTimeout(() => setPressedBtn(null), 120);
    const correct = currentType === 'rainbow' ? true : color === currentColor;
    if (correct) {
      const nc = combo + 1; setCombo(nc); setFlash('correct');
      if (nc >= 10 && !fireMode) { setFireMode(true); playFireMode(); addFloat('🔥 FIRE MODE!', '#ff6b00'); }
      else if (nc >= 5) { playCombo(nc); addFloat(`+${nc} COMBO`, '#fbbf24'); }
      else if (currentType === 'rainbow') { playPerfect(); addFloat('+10 🌈', '#c084fc'); }
      else { playCorrect(); addFloat(`+${Math.min(nc, 5)}`, '#c084fc'); }
    } else {
      setCombo(0); setFireMode(false); setFlash('wrong'); setShake(true);
      playWrong(); addFloat('-2', '#ef4444');
      setTimeout(() => setShake(false), 200);
    }
    setTimeout(() => setFlash(null), 150);
    setStepIdx(i => i + 1); setCurrentColor(null);
    if (matchId) sendGameInput(matchId, 'color_tap', { color });
    if (navigator.vibrate) navigator.vibrate(correct ? 10 : [30, 20, 30]);
  }, [currentColor, currentType, combo, fireMode, matchId, timeLeft]);

  const isUrgent = timeLeft <= 5;
  const colorObj = currentColor && currentColor !== 'rainbow' ? COLORS.find(c => c.id === currentColor) : null;

  return (
    <div className={`flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none ${shake ? 'animate-[shake_0.2s_ease]' : ''}`}>
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">You</div>
          <div className={`text-2xl font-black tabular-nums ${fireMode ? 'fire-text' : 'text-arcane-purple'}`}>{myScore}</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-black tabular-nums ${isUrgent ? 'text-danger animate-pulse' : 'text-arcane-purple'}`}>{timeLeft.toFixed(1)}s</div>
          <div className="text-[10px] text-arcane-purple uppercase font-bold tracking-widest">
            {fireMode ? '🔥 FIRE MODE' : `PHASE ${phase === 1 ? 'I' : phase === 2 ? 'II' : 'III'}`}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">Opp</div>
          <div className="text-2xl font-black text-danger tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Combo */}
      <div className="text-center mb-1 h-7">
        {combo >= 2 && (
          <span className={`font-black text-sm ${fireMode ? 'fire-text' : 'text-gold'} animate-bounce inline-block`}>
            {fireMode ? '🔥🔥🔥' : combo >= 5 ? '🔥🔥' : '🔥'} x{combo}
          </span>
        )}
      </div>

      {/* Game Area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden rune-border flex items-center justify-center"
        style={{ backgroundImage: 'url(/bg-main.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0" style={{ background: fireMode ? 'rgba(26,5,0,0.82)' : 'rgba(10,10,26,0.78)' }} />
        {pictureUrl && <img src={pictureUrl} alt="" className="absolute bottom-2 right-2 w-12 h-12 rounded-full opacity-50 pointer-events-none z-0 border-2 border-arcane-purple/30" />}

        {flash === 'correct' && <div className="absolute inset-0 bg-arcane-purple/10 z-10" />}
        {flash === 'wrong' && <div className="absolute inset-0 bg-danger/20 z-10" />}

        {/* Float scores */}
        {floats.map(f => (
          <div key={f.id} className="score-float z-20" style={{ left: '50%', top: '40%', color: f.color, transform: 'translateX(-50%)', textShadow: `0 0 10px ${f.color}` }}>{f.text}</div>
        ))}

        {currentColor ? (
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="text-white/60 text-sm uppercase font-semibold tracking-wider">
              {currentType === 'rainbow' ? '🌈 กดสีอะไรก็ได้!' : 'กดสีนี้!'}
            </div>
            {/* Display gem */}
            <div className="w-32 h-32 rounded-3xl flex items-center justify-center text-white text-4xl font-black animate-[pop_0.3s_ease] relative"
              style={{
                background: currentType === 'rainbow'
                  ? 'conic-gradient(from 0deg, #ef4444, #fbbf24, #22c55e, #3b82f6, #a855f7, #ef4444)'
                  : colorObj?.bg || '#7c3aed',
                boxShadow: currentType === 'rainbow'
                  ? '0 0 40px #a855f760, 0 0 80px #a855f730, 0 8px 0 #3b0764, inset 0 3px 8px rgba(255,255,255,0.3)'
                  : `0 0 30px ${colorObj?.glow || '#7c3aed'}60, 0 0 60px ${colorObj?.glow || '#7c3aed'}20, 0 6px 0 ${colorObj?.shadow || '#3b0764'}, inset 0 3px 8px ${colorObj?.shine || '#fff'}40`,
                border: `2px solid ${currentType === 'rainbow' ? '#c084fc' : (colorObj?.glow || '#a855f7')}80`,
              }}>
              {/* Shine */}
              <div className="absolute top-1 left-3 w-[45%] h-[30%] rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%)' }} />
              <span className="relative z-10 drop-shadow-lg">{currentType === 'rainbow' ? '🌈' : colorObj?.label}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 z-10">
            <div className="text-stake-gray text-sm animate-pulse">รอสีถัดไป...</div>
            {stepIdx === 0 && (
              <div className="bg-black/60 backdrop-blur-sm rune-border rounded-xl px-4 py-3 text-center max-w-[260px]">
                <div className="text-arcane-purple text-xs font-bold mb-1">🔥 วิธีเล่น</div>
                <div className="text-stake-gray text-[11px]">ดูสีตรงกลาง กดปุ่มสีด้านล่างให้ตรง! Combo 10+ = 🔥 Fire Mode!</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* GEM BUTTONS */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {COLORS.map((c) => {
          const isPressed = pressedBtn === c.id;
          return (
            <button key={c.id}
              onTouchStart={(e) => { e.preventDefault(); handleColorTap(c.id); }}
              onClick={() => handleColorTap(c.id)}
              className="relative h-[68px] rounded-2xl font-black text-xl text-white transition-all overflow-hidden"
              style={{
                background: c.bg,
                boxShadow: isPressed
                  ? `0 0 20px ${c.glow}80, 0 2px 0 ${c.shadow}, inset 0 2px 5px rgba(0,0,0,0.3)`
                  : `0 0 12px ${c.glow}40, 0 5px 0 ${c.shadow}, inset 0 -2px 4px rgba(0,0,0,0.2)`,
                border: `1px solid ${c.glow}50`,
                transform: isPressed ? 'translateY(3px)' : 'translateY(0)',
              }}>
              {/* Top shine */}
              <div className="absolute top-0 left-[10%] w-[80%] h-[40%] pointer-events-none" style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 100%)',
                borderRadius: '0 0 50% 50%',
              }} />
              {/* Inner glow */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: `radial-gradient(circle at 50% 30%, ${c.shine}30, transparent 60%)`,
              }} />
              <span className="relative z-10 drop-shadow-md" style={{ textShadow: `0 1px 3px ${c.shadow}` }}>{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
