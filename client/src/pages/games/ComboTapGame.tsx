import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playCorrect, playWrong, playCombo } from '../../lib/sounds';

const COLORS = [
  { id: 'red', bg: '#FF4757', glow: '#FF475780', label: 'R' },
  { id: 'blue', bg: '#4FC3F7', glow: '#4FC3F780', label: 'B' },
  { id: 'green', bg: '#00E701', glow: '#00E70180', label: 'G' },
  { id: 'yellow', bg: '#FFD93D', glow: '#FFD93D80', label: 'Y' },
];

interface ComboStep {
  id: number; color: string; showAt: number; timeLimit: number;
}

export default function ComboTapGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const [currentColor, setCurrentColor] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const stepsRef = useRef<ComboStep[]>([]);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (gameConfig?.data?.steps) {
      stepsRef.current = gameConfig.data.steps;
    } else {
      // Generate locally
      const colors = ['red', 'blue', 'green', 'yellow'];
      const steps: ComboStep[] = [];
      let t = 800;
      let id = 0;
      while (t < 10000 - 500) {
        const progress = t / 10000;
        const timeLimit = Math.max(500, 1200 - progress * 700);
        steps.push({ id: id++, color: colors[Math.floor(Math.random() * 4)], showAt: t, timeLimit });
        t += timeLimit + 100;
      }
      stepsRef.current = steps;
    }
    startRef.current = Date.now();
  }, [gameConfig]);

  // Show current color based on time
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const steps = stepsRef.current;
      if (stepIdx < steps.length) {
        const step = steps[stepIdx];
        if (elapsed >= step.showAt) {
          setCurrentColor(step.color);
          // Auto-skip if time expired
          if (elapsed > step.showAt + step.timeLimit) {
            setStepIdx(i => i + 1);
            setCombo(0);
            setCurrentColor(null);
          }
        }
      } else {
        setCurrentColor(null);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [stepIdx]);

  const handleColorTap = useCallback((color: string) => {
    if (timeLeft <= 0 || !currentColor) return;

    const isCorrect = color === currentColor;

    if (isCorrect) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      setFlash('correct');
      if (newCombo >= 5) playCombo(newCombo);
      else playCorrect();
    } else {
      setCombo(0);
      setFlash('wrong');
      setShake(true);
      playWrong();
      setTimeout(() => setShake(false), 200);
    }

    setTimeout(() => setFlash(null), 150);
    setStepIdx(i => i + 1);
    setCurrentColor(null);

    if (matchId) {
      sendGameInput(matchId, 'color_tap', { color });
    }
    if (navigator.vibrate) navigator.vibrate(isCorrect ? 10 : [30, 20, 30]);
  }, [currentColor, combo, matchId, timeLeft]);

  const isUrgent = timeLeft <= 3;
  const colorObj = currentColor ? COLORS.find(c => c.id === currentColor) : null;

  return (
    <div className={`flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none ${shake ? 'animate-[shake_0.2s_ease]' : ''}`}>
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">You</div>
          <div className="text-2xl font-black text-neon tabular-nums">{myScore}</div>
        </div>
        <div className="text-center">
          <div className={`text-4xl font-black tabular-nums ${isUrgent ? 'text-danger animate-pulse' : 'text-neon'}`}>
            {timeLeft.toFixed(1)}
          </div>
          <div className="text-[10px] text-stake-gray uppercase font-semibold">🔥 Combo Tap</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">Opp</div>
          <div className="text-2xl font-black text-danger tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Combo streak */}
      <div className="text-center mb-2 h-6">
        {combo >= 2 && (
          <div className="inline-flex items-center gap-1 animate-bounce">
            <span className="text-gold font-black text-sm">
              {combo >= 5 ? '🔥🔥🔥' : combo >= 3 ? '🔥🔥' : '🔥'} COMBO x{combo}
              {combo >= 5 && <span className="text-neon"> (x5 BONUS!)</span>}
            </span>
          </div>
        )}
      </div>

      {/* Color Display Area */}
      <div className="flex-1 relative bg-stake-card rounded-2xl overflow-hidden border border-stake-border flex items-center justify-center">
        {/* Flash overlay */}
        {flash === 'correct' && <div className="absolute inset-0 bg-neon/10 z-10" />}
        {flash === 'wrong' && <div className="absolute inset-0 bg-danger/20 z-10" />}

        {currentColor ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-stake-gray text-sm uppercase font-semibold tracking-wider">กดสีนี้!</div>
            <div
              className="w-32 h-32 rounded-3xl flex items-center justify-center text-white text-4xl font-black animate-[pop_0.3s_ease]"
              style={{
                background: colorObj?.bg,
                boxShadow: `0 0 60px ${colorObj?.glow}, 0 0 120px ${colorObj?.glow}`,
              }}
            >
              {colorObj?.label}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="text-stake-gray text-sm animate-pulse">รอสีถัดไป...</div>
            {stepIdx === 0 && (
              <div className="bg-stake-bg/80 rounded-xl px-4 py-2 text-center max-w-[250px]">
                <div className="text-white text-xs font-semibold mb-1">🔥 วิธีเล่น</div>
                <div className="text-stake-gray text-[11px]">ดูสีที่ขึ้นตรงกลาง แล้วกดปุ่มสีด้านล่างให้ตรง กดถูกต่อกัน = combo x5!</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Color Buttons */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {COLORS.map((color) => (
          <button
            key={color.id}
            onTouchStart={(e) => { e.preventDefault(); handleColorTap(color.id); }}
            onClick={() => handleColorTap(color.id)}
            className="h-16 rounded-xl font-black text-lg text-white active:scale-90 transition-transform"
            style={{
              background: color.bg,
              boxShadow: `0 4px 15px ${color.glow}`,
            }}
          >
            {color.label}
          </button>
        ))}
      </div>
    </div>
  );
}
