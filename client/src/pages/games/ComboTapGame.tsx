import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playCorrect, playWrong, playCombo, playPerfect } from '../../lib/sounds';

const COLORS = [
  { id: 'red', bg: 'linear-gradient(135deg, #ef4444, #dc2626)', glow: '#ef444480', border: '#ef4444', label: 'R' },
  { id: 'blue', bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', glow: '#3b82f680', border: '#3b82f6', label: 'B' },
  { id: 'green', bg: 'linear-gradient(135deg, #22c55e, #16a34a)', glow: '#22c55e80', border: '#22c55e', label: 'G' },
  { id: 'yellow', bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)', glow: '#fbbf2480', border: '#fbbf24', label: 'Y' },
];

interface ComboStep { id: number; color: string; showAt: number; timeLimit: number; type: 'normal' | 'rainbow'; }
interface FloatScore { id: number; text: string; color: string; }

export default function ComboTapGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const [currentColor, setCurrentColor] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState<'normal' | 'rainbow'>('normal');
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [fireMode, setFireMode] = useState(false);
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState(1);
  const stepsRef = useRef<ComboStep[]>([]);
  const startRef = useRef(Date.now());
  const floatId = useRef(0);

  useEffect(() => {
    if (gameConfig?.data?.steps) stepsRef.current = gameConfig.data.steps;
    else {
      const colors = ['red', 'blue', 'green', 'yellow'];
      const steps: ComboStep[] = []; let t = 600, id = 0;
      while (t < 30000 - 400) {
        const p = t / 30000;
        const tl = Math.max(350, 1000 - p * 600);
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
      } else { setCurrentColor(null); }
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
    const correct = currentType === 'rainbow' ? true : color === currentColor;

    if (correct) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      setFlash('correct');
      if (newCombo >= 10) { setFireMode(true); playPerfect(); addFloat(`+${newCombo} 🔥FIRE`, '#ff6b00'); }
      else if (newCombo >= 5) { playCombo(newCombo); addFloat(`+${newCombo} COMBO`, '#fbbf24'); }
      else if (currentType === 'rainbow') { playPerfect(); addFloat('+10 🌈', '#a855f7'); }
      else { playCorrect(); addFloat(`+${Math.min(newCombo, 5)}`, '#a855f7'); }
    } else {
      setCombo(0); setFireMode(false);
      setFlash('wrong'); setShake(true);
      playWrong(); addFloat('-2', '#ef4444');
      setTimeout(() => setShake(false), 200);
    }
    setTimeout(() => setFlash(null), 150);
    setStepIdx(i => i + 1); setCurrentColor(null);
    if (matchId) sendGameInput(matchId, 'color_tap', { color });
    if (navigator.vibrate) navigator.vibrate(correct ? 10 : [30, 20, 30]);
  }, [currentColor, currentType, combo, matchId, timeLeft]);

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
          <div className="inline-flex items-center gap-1 animate-bounce">
            <span className={`font-black text-sm ${fireMode ? 'fire-text' : 'text-gold'}`}>
              {fireMode ? '🔥🔥🔥' : combo >= 5 ? '🔥🔥' : '🔥'} x{combo}
              {combo >= 10 && ' FIRE MODE!'}
            </span>
          </div>
        )}
      </div>

      {/* Game Area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden rune-border flex items-center justify-center"
        style={{ background: fireMode
          ? 'linear-gradient(180deg, #1a0500 0%, #2a0800 50%, #0a0a1a 100%)'
          : 'linear-gradient(180deg, #0d0d25 0%, #12082a 50%, #0a0a1a 100%)' }}>

        {flash === 'correct' && <div className="absolute inset-0 bg-arcane-purple/10 z-10" />}
        {flash === 'wrong' && <div className="absolute inset-0 bg-danger/20 z-10" />}

        {/* Float scores */}
        {floats.map(f => (
          <div key={f.id} className="score-float" style={{ left: '50%', top: '40%', color: f.color, transform: 'translateX(-50%)' }}>{f.text}</div>
        ))}

        {currentColor ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-stake-gray text-sm uppercase font-semibold tracking-wider">
              {currentType === 'rainbow' ? '🌈 กดสีอะไรก็ได้!' : 'กดสีนี้!'}
            </div>
            <div className="w-32 h-32 rounded-3xl flex items-center justify-center text-white text-4xl font-black animate-[pop_0.3s_ease]"
              style={{
                background: currentType === 'rainbow'
                  ? 'linear-gradient(135deg, #ef4444, #fbbf24, #22c55e, #3b82f6, #a855f7)'
                  : colorObj?.bg || '#7c3aed',
                boxShadow: currentType === 'rainbow'
                  ? '0 0 40px #a855f760, 0 0 80px #3b82f630'
                  : `0 0 40px ${colorObj?.glow || '#7c3aed80'}, 0 0 80px ${colorObj?.glow || '#7c3aed40'}`,
                border: currentType === 'rainbow' ? '2px solid #a855f7' : `2px solid ${colorObj?.border || '#7c3aed'}`,
              }}>
              {currentType === 'rainbow' ? '🌈' : colorObj?.label}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-stake-gray text-sm animate-pulse">รอสีถัดไป...</div>
            {stepIdx === 0 && (
              <div className="bg-arcane-dark/90 rune-border rounded-xl px-4 py-3 text-center max-w-[260px]">
                <div className="text-arcane-purple text-xs font-bold mb-1">🔥 วิธีเล่น</div>
                <div className="text-stake-gray text-[11px]">ดูสีตรงกลาง กดปุ่มสีด้านล่างให้ตรง! Combo 10+ = 🔥 Fire Mode!</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Color Buttons */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {COLORS.map((c) => (
          <button key={c.id}
            onTouchStart={(e) => { e.preventDefault(); handleColorTap(c.id); }}
            onClick={() => handleColorTap(c.id)}
            className="h-16 rounded-xl font-black text-lg text-white active:scale-90 transition-transform"
            style={{ background: c.bg, boxShadow: `0 4px 15px ${c.glow}`, border: `1px solid ${c.border}40` }}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
