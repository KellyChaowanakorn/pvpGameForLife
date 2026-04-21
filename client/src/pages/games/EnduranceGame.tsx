import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playPerfect, playBeat, playBeatMiss } from '../../lib/sounds';

interface Beat {
  id: number; time: number; window: number;
}

type HitResult = 'perfect' | 'good' | 'miss' | null;

export default function EnduranceGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const [ringScale, setRingScale] = useState(0);
  const [hitResult, setHitResult] = useState<HitResult>(null);
  const [streak, setStreak] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);
  const [currentBeatIdx, setCurrentBeatIdx] = useState(0);
  const beatsRef = useRef<Beat[]>([]);
  const startRef = useRef(Date.now());
  const hitBeats = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (gameConfig?.data?.beats) {
      beatsRef.current = gameConfig.data.beats;
    } else {
      // Generate locally
      const beats: Beat[] = [];
      let t = 1000;
      let interval = 800;
      let id = 0;
      while (t < 10000 - 300) {
        const progress = t / 10000;
        const window = Math.max(80, 200 - progress * 120);
        beats.push({ id: id++, time: t, window });
        interval = Math.max(300, 800 - progress * 500);
        t += interval;
      }
      beatsRef.current = beats;
    }
    startRef.current = Date.now();
  }, [gameConfig]);

  // Animate the ring pulse based on beats
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const beats = beatsRef.current;

      // Find next upcoming beat
      let nextBeat: Beat | null = null;
      for (const beat of beats) {
        if (elapsed < beat.time + beat.window) {
          nextBeat = beat;
          break;
        }
      }

      if (nextBeat) {
        const timeToBeat = nextBeat.time - elapsed;
        const totalApproach = 800; // ms to show approaching ring
        if (timeToBeat <= totalApproach && timeToBeat > 0) {
          const progress = 1 - (timeToBeat / totalApproach);
          setRingScale(progress);
          setPulseActive(true);
        } else if (timeToBeat <= 0 && timeToBeat > -nextBeat.window) {
          setRingScale(1);
          setPulseActive(true);
        } else {
          setRingScale(0);
          setPulseActive(false);
        }

        // Auto-miss detection
        if (elapsed > nextBeat.time + nextBeat.window * 2 && !hitBeats.current.has(nextBeat.id)) {
          hitBeats.current.add(nextBeat.id);
          setStreak(0);
          setHitResult('miss');
          playBeatMiss();
          setTimeout(() => setHitResult(null), 300);
        }
      }
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const handleTap = useCallback(() => {
    if (timeLeft <= 0) return;

    const elapsed = Date.now() - startRef.current;
    const beats = beatsRef.current;

    // Find closest beat
    let bestBeat: Beat | null = null;
    let bestDiff = Infinity;

    for (const beat of beats) {
      if (hitBeats.current.has(beat.id)) continue;
      const diff = Math.abs(elapsed - beat.time);
      if (diff < bestDiff && diff <= beat.window * 2.5) {
        bestDiff = diff;
        bestBeat = beat;
      }
    }

    if (bestBeat) {
      hitBeats.current.add(bestBeat.id);

      if (bestDiff <= bestBeat.window * 0.3) {
        // PERFECT
        setHitResult('perfect');
        setStreak(s => s + 1);
        playPerfect();
      } else if (bestDiff <= bestBeat.window) {
        // GOOD
        setHitResult('good');
        setStreak(s => s + 1);
        playBeat();
      } else {
        // BAD
        setHitResult('miss');
        setStreak(0);
        playBeatMiss();
      }
    } else {
      setHitResult('miss');
      setStreak(0);
      playBeatMiss();
    }

    setTimeout(() => setHitResult(null), 400);

    if (matchId) {
      sendGameInput(matchId, 'beat_tap', {});
    }
    if (navigator.vibrate) navigator.vibrate(hitResult === 'perfect' ? [20, 10, 20] : 10);
  }, [matchId, timeLeft, hitResult]);

  const isUrgent = timeLeft <= 3;
  const targetRingSize = 180;
  const currentRingSize = targetRingSize * ringScale;

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
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
          <div className="text-[10px] text-stake-gray uppercase font-semibold">💎 Endurance</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">Opp</div>
          <div className="text-2xl font-black text-danger tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Streak */}
      <div className="text-center mb-1 h-6">
        {streak >= 3 && (
          <div className="animate-bounce">
            <span className="text-gold font-black text-sm">⚡ STREAK x{streak}</span>
          </div>
        )}
      </div>

      {/* Hit Result */}
      <div className="text-center mb-2 h-8">
        {hitResult === 'perfect' && (
          <div className="text-neon font-black text-xl animate-[pop_0.3s_ease]">PERFECT! +3</div>
        )}
        {hitResult === 'good' && (
          <div className="text-gold font-bold text-lg animate-[pop_0.3s_ease]">GOOD +1</div>
        )}
        {hitResult === 'miss' && (
          <div className="text-danger font-bold text-lg animate-[pop_0.3s_ease]">MISS</div>
        )}
      </div>

      {/* Game Area - tap zone */}
      <div
        className="flex-1 relative bg-stake-card rounded-2xl overflow-hidden border border-stake-border flex items-center justify-center"
        onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
        onClick={handleTap}
      >
        {/* Target ring (static) */}
        <div
          className="absolute rounded-full border-2 border-white/20"
          style={{
            width: targetRingSize,
            height: targetRingSize,
            transition: 'border-color 0.1s',
            borderColor: hitResult === 'perfect' ? '#00E701' : hitResult === 'good' ? '#FFD93D' : hitResult === 'miss' ? '#FF4757' : 'rgba(255,255,255,0.2)',
          }}
        />

        {/* Approaching ring (expands toward target) */}
        {pulseActive && (
          <div
            className="absolute rounded-full border-3"
            style={{
              width: currentRingSize,
              height: currentRingSize,
              borderWidth: '3px',
              borderColor: ringScale > 0.85 ? '#00E701' : ringScale > 0.6 ? '#FFD93D' : '#4FC3F7',
              boxShadow: ringScale > 0.85
                ? '0 0 30px #00E70140, inset 0 0 30px #00E70120'
                : '0 0 20px #4FC3F720',
              transition: 'border-color 0.1s',
            }}
          />
        )}

        {/* Center dot */}
        <div
          className="absolute w-4 h-4 rounded-full"
          style={{
            background: hitResult === 'perfect' ? '#00E701' : hitResult === 'good' ? '#FFD93D' : hitResult === 'miss' ? '#FF4757' : '#557086',
            boxShadow: hitResult ? `0 0 20px ${hitResult === 'perfect' ? '#00E701' : hitResult === 'good' ? '#FFD93D' : '#FF4757'}` : 'none',
            transition: 'all 0.1s',
          }}
        />

        {/* Instructions */}
        <div className="absolute bottom-6 left-0 right-0 text-center px-4">
          <div className="bg-stake-bg/70 rounded-lg px-3 py-2 inline-block">
            <div className="text-white text-[11px] font-semibold">💎 วงเล็กวิ่งเข้ามา → กดตอนชิดวงใหญ่!</div>
            <div className="text-stake-gray text-[10px]">Perfect = 3 แต้ม · Good = 1 · Miss = -1</div>
          </div>
        </div>
      </div>
    </div>
  );
}
