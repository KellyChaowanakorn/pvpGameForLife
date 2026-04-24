import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playPerfect, playBeat, playBeatMiss } from '../../lib/sounds';

interface Beat { id: number; time: number; window: number; type: 'normal' | 'double' | 'danger'; }
type HitResult = 'perfect' | 'good' | 'miss' | 'danger_perfect' | null;
interface FloatScore { id: number; text: string; color: string; }

export default function EnduranceGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const [ringScale, setRingScale] = useState(0);
  const [hitResult, setHitResult] = useState<HitResult>(null);
  const [streak, setStreak] = useState(0);
  const [nextBeatType, setNextBeatType] = useState<string>('normal');
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [bpm, setBpm] = useState(85);
  const [localScore, setLocalScore] = useState(0);
  const beatsRef = useRef<Beat[]>([]);
  const startRef = useRef(Date.now());
  const hitBeats = useRef<Set<number>>(new Set());
  const floatId = useRef(0);

  useEffect(() => {
    if (gameConfig?.data?.beats) {
      beatsRef.current = gameConfig.data.beats;
    } else {
      const beats: Beat[] = []; let t = 800, iv = 700, id = 0;
      while (t < 30000 - 300) {
        const p = t / 30000;
        const w = Math.max(80, 200 - p * 120);
        const r = Math.random();
        let type: 'normal' | 'double' | 'danger' = 'normal';
        if (r > 0.88 && p > 0.3) type = 'danger';
        else if (r > 0.75 && p > 0.2) type = 'double';
        beats.push({ id: id++, time: t, window: w, type });
        if (type === 'double') { beats.push({ id: id++, time: t + 150, window: w, type: 'normal' }); t += 150; }
        iv = Math.max(250, 700 - p * 450); t += iv;
      }
      beatsRef.current = beats;
    }
    startRef.current = Date.now();
    hitBeats.current = new Set();
    setLocalScore(0);
  }, [gameConfig]);

  const addFloat = (text: string, color: string) => {
    const fid = floatId.current++;
    setFloats(prev => [...prev, { id: fid, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 600);
  };

  // Ring animation + auto-miss
  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(1, elapsed / 30000);
      setBpm(Math.round(85 + progress * 90));

      // Find next un-hit beat
      let nextBeat: Beat | null = null;
      for (const beat of beatsRef.current) {
        if (hitBeats.current.has(beat.id)) continue;
        if (elapsed < beat.time + beat.window * 2) { nextBeat = beat; break; }
        // Auto-miss expired beats
        if (elapsed >= beat.time + beat.window * 2) {
          hitBeats.current.add(beat.id);
        }
      }

      if (nextBeat) {
        setNextBeatType(nextBeat.type);
        const timeToBeat = nextBeat.time - elapsed;
        const approach = 700;
        if (timeToBeat <= approach && timeToBeat > 0) setRingScale(1 - timeToBeat / approach);
        else if (timeToBeat <= 0 && timeToBeat > -nextBeat.window) setRingScale(1);
        else setRingScale(0);
      } else {
        setRingScale(0);
      }
    }, 16);
    return () => clearInterval(iv);
  }, []);

  const handleTap = useCallback(() => {
    if (timeLeft <= 0) return;
    const elapsed = Date.now() - startRef.current;

    // Find closest un-hit beat
    let bestBeat: Beat | null = null, bestDiff = Infinity;
    for (const beat of beatsRef.current) {
      if (hitBeats.current.has(beat.id)) continue;
      const diff = Math.abs(elapsed - beat.time);
      if (diff < bestDiff && diff <= beat.window * 3) { bestDiff = diff; bestBeat = beat; }
    }

    let points = 0;

    if (bestBeat) {
      hitBeats.current.add(bestBeat.id);
      const isDanger = bestBeat.type === 'danger';

      if (bestDiff <= bestBeat.window * 0.3) {
        // PERFECT
        points = isDanger ? 8 : 3;
        setHitResult(isDanger ? 'danger_perfect' : 'perfect');
        setStreak(s => s + 1);
        playPerfect();
        addFloat(`+${points}`, isDanger ? '#ef4444' : '#a855f7');
      } else if (bestDiff <= bestBeat.window) {
        // GOOD
        points = isDanger ? 3 : 1;
        setHitResult('good');
        setStreak(s => s + 1);
        playBeat();
        addFloat(`+${points}`, '#fbbf24');
      } else if (bestDiff <= bestBeat.window * 2) {
        // LATE but still counts a little
        points = 1;
        setHitResult('good');
        playBeat();
        addFloat('+1', '#8b85a8');
      } else {
        // TOO FAR
        setHitResult('miss');
        setStreak(0);
        playBeatMiss();
        addFloat('MISS', '#ef4444');
      }
    } else {
      // No beat nearby - still give 1 point for tapping (prevents draw)
      points = 1;
      setHitResult('good');
      playBeat();
      addFloat('+1', '#8b85a8');
    }

    setLocalScore(s => s + points);
    setTimeout(() => setHitResult(null), 350);

    // Send to server with relative time
    if (matchId) {
      sendGameInput(matchId, 'beat_tap', { time: elapsed });
    }
    if (navigator.vibrate) navigator.vibrate(hitResult === 'perfect' ? [20, 10, 20] : 10);
  }, [matchId, timeLeft, hitResult]);

  const isUrgent = timeLeft <= 5;
  const isDanger = nextBeatType === 'danger';
  const ringColor = hitResult === 'perfect' || hitResult === 'danger_perfect' ? '#a855f7'
    : hitResult === 'good' ? '#fbbf24' : hitResult === 'miss' ? '#ef4444'
    : isDanger ? '#ef4444' : '#7c3aed';

  const displayScore = myScore > 0 ? myScore : localScore;

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">You</div>
          <div className="text-2xl font-black text-arcane-purple tabular-nums">{displayScore}</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-black tabular-nums ${isUrgent ? 'text-danger animate-pulse' : 'text-arcane-purple'}`}>{timeLeft.toFixed(1)}s</div>
          <div className="text-[10px] text-arcane-purple uppercase font-bold">{bpm} BPM</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">Opp</div>
          <div className="text-2xl font-black text-danger tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Streak + Hit */}
      <div className="flex items-center justify-between px-2 mb-1 h-7">
        <div>{streak >= 3 && <span className="text-gold font-black text-sm animate-bounce inline-block">⚡ x{streak}</span>}</div>
        <div>
          {hitResult === 'perfect' && <span className="text-arcane-purple font-black text-base animate-[pop_0.3s_ease]">PERFECT +3</span>}
          {hitResult === 'danger_perfect' && <span className="text-danger font-black text-base animate-[pop_0.3s_ease]">☠️ PERFECT +8</span>}
          {hitResult === 'good' && <span className="text-gold font-bold text-sm animate-[pop_0.3s_ease]">GOOD</span>}
          {hitResult === 'miss' && <span className="text-danger font-bold text-sm animate-[pop_0.3s_ease]">MISS</span>}
        </div>
        <div>{isDanger && <span className="text-danger font-bold text-xs animate-pulse">☠️ DANGER</span>}</div>
      </div>

      {/* Game Area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden flex items-center justify-center"
        onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
        onClick={handleTap}
        style={{
          backgroundImage: 'url(/bg-main.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: `1px solid ${isDanger ? '#ef444440' : '#7c3aed40'}`,
          borderRadius: '16px',
          animation: isDanger ? 'dangerPulse 1s ease infinite' : 'arcaneGlow 3s ease infinite',
        }}>

        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: isDanger ? 'rgba(20,0,0,0.7)' : 'rgba(10,10,26,0.75)' }} />

        {/* Character */}
        <img src="/char3.png" alt="" className="absolute bottom-0 right-0 w-28 opacity-30 pointer-events-none" style={{ filter: 'drop-shadow(0 0 10px #a855f740)' }} />

        {/* Outer ring */}
        <div className="absolute rounded-full z-10" style={{ width: 180, height: 180, border: `2px solid ${ringColor}40`, boxShadow: `inset 0 0 30px ${ringColor}10` }} />

        {/* Approaching ring */}
        {ringScale > 0 && (
          <div className="absolute rounded-full z-10" style={{
            width: 180 * ringScale, height: 180 * ringScale,
            borderWidth: '3px', borderStyle: 'solid',
            borderColor: ringScale > 0.85 ? ringColor : `${ringColor}80`,
            boxShadow: ringScale > 0.85 ? `0 0 30px ${ringColor}60, inset 0 0 20px ${ringColor}20` : `0 0 15px ${ringColor}20`,
          }} />
        )}

        {/* Center orb */}
        <div className="absolute w-6 h-6 rounded-full z-10" style={{
          background: `radial-gradient(circle, ${ringColor}, ${ringColor}80)`,
          boxShadow: hitResult ? `0 0 25px ${ringColor}` : `0 0 10px ${ringColor}60`,
        }} />

        {/* Float scores */}
        {floats.map(f => (
          <div key={f.id} className="score-float z-20" style={{ left: '50%', top: '35%', color: f.color, transform: 'translateX(-50%)' }}>{f.text}</div>
        ))}

        {/* Instruction */}
        <div className="absolute bottom-4 left-0 right-0 text-center px-4 z-10">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 inline-block border border-arcane-purple/20">
            <div className="text-white text-[11px] font-semibold">⭕ กดตอนวงชิดกัน! · ☠️ Danger = +8</div>
          </div>
        </div>
      </div>
    </div>
  );
}
