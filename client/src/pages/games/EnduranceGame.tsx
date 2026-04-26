import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playPerfect, playBeat, playBeatMiss, playDanger } from '../../lib/sounds';

interface Beat { id: number; time: number; window: number; type: 'normal' | 'double' | 'danger'; }
type HitResult = 'perfect' | 'good' | 'miss' | 'danger_perfect' | null;
interface FloatScore { id: number; text: string; color: string; }

export default function EnduranceGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const pictureUrl = useGameStore((s) => s.pictureUrl);
  const [ringScale, setRingScale] = useState(0);
  const [hitResult, setHitResult] = useState<HitResult>(null);
  const [streak, setStreak] = useState(0);
  const [nextBeatType, setNextBeatType] = useState<string>('normal');
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [bpm, setBpm] = useState(85);
  const [localScore, setLocalScore] = useState(0);
  const [ripple, setRipple] = useState(false);
  const beatsRef = useRef<Beat[]>([]);
  const startRef = useRef(Date.now());
  const hitBeats = useRef<Set<number>>(new Set());
  const floatId = useRef(0);

  useEffect(() => {
    if (gameConfig?.data?.beats) beatsRef.current = gameConfig.data.beats;
    else {
      const beats: Beat[] = []; let t = 800, iv = 700, id = 0;
      while (t < 30000 - 300) {
        const p = t / 30000; const w = Math.max(80, 200 - p * 120); const r = Math.random();
        let type: 'normal' | 'double' | 'danger' = 'normal';
        if (r > 0.88 && p > 0.3) type = 'danger';
        else if (r > 0.75 && p > 0.2) type = 'double';
        beats.push({ id: id++, time: t, window: w, type });
        if (type === 'double') { beats.push({ id: id++, time: t + 150, window: w, type: 'normal' }); t += 150; }
        iv = Math.max(250, 700 - p * 450); t += iv;
      }
      beatsRef.current = beats;
    }
    startRef.current = Date.now(); hitBeats.current = new Set(); setLocalScore(0);
  }, [gameConfig]);

  const addFloat = (text: string, color: string) => {
    const fid = floatId.current++;
    setFloats(prev => [...prev, { id: fid, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 600);
  };

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setBpm(Math.round(85 + Math.min(1, elapsed / 30000) * 90));
      let nextBeat: Beat | null = null;
      for (const beat of beatsRef.current) {
        if (hitBeats.current.has(beat.id)) continue;
        if (elapsed < beat.time + beat.window * 2) { nextBeat = beat; break; }
        if (elapsed >= beat.time + beat.window * 2) hitBeats.current.add(beat.id);
      }
      if (nextBeat) {
        setNextBeatType(nextBeat.type);
        const ttb = nextBeat.time - elapsed;
        if (ttb <= 700 && ttb > 0) setRingScale(1 - ttb / 700);
        else if (ttb <= 0 && ttb > -nextBeat.window) setRingScale(1);
        else setRingScale(0);
      } else setRingScale(0);
    }, 16);
    return () => clearInterval(iv);
  }, []);

  const handleTap = useCallback(() => {
    if (timeLeft <= 0) return;
    const elapsed = Date.now() - startRef.current;
    setRipple(true); setTimeout(() => setRipple(false), 300);

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
        points = isDanger ? 8 : 3;
        setHitResult(isDanger ? 'danger_perfect' : 'perfect'); setStreak(s => s + 1);
        isDanger ? playDanger() : playPerfect();
        addFloat(`+${points}`, isDanger ? '#f87171' : '#c084fc');
      } else if (bestDiff <= bestBeat.window) {
        points = isDanger ? 3 : 1;
        setHitResult('good'); setStreak(s => s + 1); playBeat();
        addFloat(`+${points}`, '#fbbf24');
      } else {
        points = 1; setHitResult('good'); playBeat(); addFloat('+1', '#8b85a8');
      }
    } else {
      points = 1; setHitResult('good'); playBeat(); addFloat('+1', '#8b85a8');
    }

    setLocalScore(s => s + points);
    setTimeout(() => setHitResult(null), 350);
    if (matchId) sendGameInput(matchId, 'beat_tap', { time: elapsed });
    if (navigator.vibrate) navigator.vibrate(hitResult === 'perfect' ? [20, 10, 20] : 10);
  }, [matchId, timeLeft, hitResult]);

  const isUrgent = timeLeft <= 5;
  const isDanger = nextBeatType === 'danger';
  const ringColor = hitResult === 'perfect' || hitResult === 'danger_perfect' ? '#c084fc'
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
          {hitResult === 'perfect' && <span className="text-arcane-purple font-black text-base animate-[pop_0.3s_ease]">✨ PERFECT +3</span>}
          {hitResult === 'danger_perfect' && <span className="text-danger font-black text-base animate-[pop_0.3s_ease]">☠️ PERFECT +8</span>}
          {hitResult === 'good' && <span className="text-gold font-bold text-sm animate-[pop_0.3s_ease]">GOOD</span>}
          {hitResult === 'miss' && <span className="text-danger font-bold text-sm animate-[pop_0.3s_ease]">MISS</span>}
        </div>
        <div>{isDanger && <span className="text-danger font-bold text-xs animate-pulse">☠️ DANGER</span>}</div>
      </div>

      {/* Game Area - TAP ZONE */}
      <div className="flex-1 relative rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer"
        onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
        onClick={handleTap}
        style={{
          backgroundImage: 'url(/bg-main.png)', backgroundSize: 'cover', backgroundPosition: 'center',
          border: `1px solid ${isDanger ? '#ef444440' : '#7c3aed40'}`,
          borderRadius: '16px',
          animation: isDanger ? 'dangerPulse 1s ease infinite' : 'arcaneGlow 3s ease infinite',
        }}>

        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: isDanger ? 'rgba(20,0,0,0.75)' : 'rgba(10,10,26,0.78)' }} />

        {/* Player Profile */}
        {pictureUrl && <img src={pictureUrl} alt="" className="absolute bottom-2 right-2 w-12 h-12 rounded-full opacity-50 pointer-events-none border-2 border-arcane-purple/30 z-30" />}

        {/* Outer ring - magic circle style */}
        <div className="absolute rounded-full z-10" style={{
          width: 190, height: 190,
          border: `3px solid ${ringColor}30`,
          boxShadow: `inset 0 0 40px ${ringColor}08, 0 0 20px ${ringColor}10`,
        }}>
          {/* Decorative dots on ring */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
            <div key={deg} className="absolute w-2 h-2 rounded-full" style={{
              background: `${ringColor}60`,
              top: '50%', left: '50%',
              transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-95px)`,
              boxShadow: `0 0 6px ${ringColor}40`,
            }} />
          ))}
        </div>

        {/* Inner ring */}
        <div className="absolute rounded-full z-10" style={{
          width: 140, height: 140,
          border: `1px dashed ${ringColor}25`,
        }} />

        {/* Approaching ring */}
        {ringScale > 0 && (
          <div className="absolute rounded-full z-10 transition-all" style={{
            width: 190 * ringScale, height: 190 * ringScale,
            borderWidth: '4px', borderStyle: 'solid',
            borderColor: ringScale > 0.85 ? ringColor : `${ringColor}60`,
            boxShadow: ringScale > 0.85
              ? `0 0 30px ${ringColor}80, 0 0 60px ${ringColor}30, inset 0 0 20px ${ringColor}20`
              : `0 0 15px ${ringColor}20`,
            background: ringScale > 0.9 ? `radial-gradient(circle, ${ringColor}08, transparent 70%)` : 'transparent',
          }} />
        )}

        {/* Center orb - premium gem style */}
        <div className="absolute z-10" style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${ringColor}ff, ${ringColor}80 50%, ${ringColor}40 100%)`,
          boxShadow: hitResult
            ? `0 0 30px ${ringColor}, 0 0 60px ${ringColor}60, inset 0 -3px 5px rgba(0,0,0,0.3), inset 0 3px 5px rgba(255,255,255,0.3)`
            : `0 0 12px ${ringColor}60, inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.2)`,
          transition: 'all 0.1s',
        }}>
          {/* Orb shine */}
          <div className="absolute top-1 left-[20%] w-[35%] h-[25%] rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
        </div>

        {/* Ripple effect on tap */}
        {ripple && (
          <div className="absolute rounded-full z-10" style={{
            width: 60, height: 60,
            border: `2px solid ${ringColor}`,
            animation: 'ringExpand 0.3s ease forwards',
          }} />
        )}

        {/* Float scores */}
        {floats.map(f => (
          <div key={f.id} className="score-float z-20" style={{ left: '50%', top: '35%', color: f.color, transform: 'translateX(-50%)', textShadow: `0 0 10px ${f.color}` }}>{f.text}</div>
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
