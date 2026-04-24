import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playPerfect, playBeat, playBeatMiss, playCombo } from '../../lib/sounds';

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
  const beatsRef = useRef<Beat[]>([]);
  const startRef = useRef(Date.now());
  const hitBeats = useRef<Set<number>>(new Set());
  const floatId = useRef(0);

  useEffect(() => {
    if (gameConfig?.data?.beats) beatsRef.current = gameConfig.data.beats;
    else {
      const beats: Beat[] = []; let t = 800, iv = 700, id = 0;
      while (t < 30000 - 300) {
        const p = t / 30000;
        const w = Math.max(60, 180 - p * 120);
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
  }, [gameConfig]);

  const addFloat = (text: string, color: string) => {
    const fid = floatId.current++;
    setFloats(prev => [...prev, { id: fid, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 600);
  };

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const progress = elapsed / 30000;
      setBpm(Math.round(85 + progress * 90));

      let nextBeat: Beat | null = null;
      for (const beat of beatsRef.current) {
        if (elapsed < beat.time + beat.window) { nextBeat = beat; break; }
      }
      if (nextBeat) {
        setNextBeatType(nextBeat.type);
        const timeToBeat = nextBeat.time - elapsed;
        const approach = 700;
        if (timeToBeat <= approach && timeToBeat > 0) { setRingScale(1 - timeToBeat / approach); }
        else if (timeToBeat <= 0 && timeToBeat > -nextBeat.window) { setRingScale(1); }
        else { setRingScale(0); }

        if (elapsed > nextBeat.time + nextBeat.window * 2 && !hitBeats.current.has(nextBeat.id)) {
          hitBeats.current.add(nextBeat.id); setStreak(0);
          setHitResult('miss'); playBeatMiss();
          addFloat(nextBeat.type === 'danger' ? '-5' : '-1', '#ef4444');
          setTimeout(() => setHitResult(null), 300);
        }
      }
    }, 16);
    return () => clearInterval(iv);
  }, []);

  const handleTap = useCallback(() => {
    if (timeLeft <= 0) return;
    const elapsed = Date.now() - startRef.current;
    let bestBeat: Beat | null = null, bestDiff = Infinity;
    for (const beat of beatsRef.current) {
      if (hitBeats.current.has(beat.id)) continue;
      const diff = Math.abs(elapsed - beat.time);
      if (diff < bestDiff && diff <= beat.window * 3) { bestDiff = diff; bestBeat = beat; }
    }

    if (bestBeat) {
      hitBeats.current.add(bestBeat.id);
      const isDanger = bestBeat.type === 'danger';
      if (bestDiff <= bestBeat.window * 0.3) {
        setHitResult(isDanger ? 'danger_perfect' : 'perfect');
        setStreak(s => s + 1); playPerfect();
        addFloat(isDanger ? '+8 ☠️' : '+3', isDanger ? '#ef4444' : '#a855f7');
      } else if (bestDiff <= bestBeat.window) {
        setHitResult('good'); setStreak(s => s + 1); playBeat();
        addFloat(isDanger ? '+3' : '+1', '#fbbf24');
      } else {
        setHitResult('miss'); setStreak(0); playBeatMiss();
        addFloat(isDanger ? '-5' : '-1', '#ef4444');
      }
    } else {
      setHitResult('miss'); setStreak(0); playBeatMiss();
    }
    setTimeout(() => setHitResult(null), 400);
    if (matchId) sendGameInput(matchId, 'beat_tap', {});
    if (navigator.vibrate) navigator.vibrate(hitResult === 'perfect' ? [20, 10, 20] : 10);
  }, [matchId, timeLeft, hitResult]);

  const isUrgent = timeLeft <= 5;
  const isDanger = nextBeatType === 'danger';
  const ringColor = hitResult === 'perfect' || hitResult === 'danger_perfect' ? '#a855f7'
    : hitResult === 'good' ? '#fbbf24' : hitResult === 'miss' ? '#ef4444'
    : isDanger ? '#ef4444' : '#7c3aed';

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">You</div>
          <div className="text-2xl font-black text-arcane-purple tabular-nums">{myScore}</div>
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

      {/* Streak + Hit Result */}
      <div className="flex items-center justify-between px-2 mb-1 h-7">
        <div>{streak >= 3 && <span className="text-gold font-black text-sm animate-bounce inline-block">⚡ x{streak}</span>}</div>
        <div>
          {hitResult === 'perfect' && <span className="text-arcane-purple font-black text-base animate-[pop_0.3s_ease]">PERFECT +3</span>}
          {hitResult === 'danger_perfect' && <span className="text-danger font-black text-base animate-[pop_0.3s_ease]">☠️ PERFECT +8</span>}
          {hitResult === 'good' && <span className="text-gold font-bold text-sm animate-[pop_0.3s_ease]">GOOD +1</span>}
          {hitResult === 'miss' && <span className="text-danger font-bold text-sm animate-[pop_0.3s_ease]">MISS</span>}
        </div>
        <div>{isDanger && <span className="text-danger font-bold text-xs animate-pulse">☠️ DANGER</span>}</div>
      </div>

      {/* Game Area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden flex items-center justify-center"
        onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
        onClick={handleTap}
        style={{
          background: isDanger
            ? 'linear-gradient(180deg, #1a0505 0%, #2a0808 50%, #0a0a1a 100%)'
            : 'linear-gradient(180deg, #0d0d25 0%, #12082a 50%, #0a0a1a 100%)',
          border: `1px solid ${isDanger ? '#ef444440' : '#7c3aed40'}`,
          borderRadius: '16px',
          animation: isDanger ? 'dangerPulse 1s ease infinite' : 'arcaneGlow 3s ease infinite',
        }}>

        {/* Outer ring (target) */}
        <div className="absolute rounded-full" style={{
          width: 180, height: 180,
          border: `2px solid ${ringColor}40`,
          boxShadow: `inset 0 0 30px ${ringColor}10`,
        }} />

        {/* Approaching ring */}
        {ringScale > 0 && (
          <div className="absolute rounded-full" style={{
            width: 180 * ringScale, height: 180 * ringScale,
            borderWidth: '3px', borderStyle: 'solid',
            borderColor: ringScale > 0.85 ? ringColor : `${ringColor}80`,
            boxShadow: ringScale > 0.85 ? `0 0 30px ${ringColor}60, inset 0 0 20px ${ringColor}20` : `0 0 15px ${ringColor}20`,
          }} />
        )}

        {/* Center orb */}
        <div className="absolute w-6 h-6 rounded-full" style={{
          background: `radial-gradient(circle, ${ringColor}, ${ringColor}80)`,
          boxShadow: hitResult ? `0 0 25px ${ringColor}` : `0 0 10px ${ringColor}60`,
          transition: 'all 0.1s',
        }} />

        {/* Float scores */}
        {floats.map(f => (
          <div key={f.id} className="score-float" style={{ left: '50%', top: '35%', color: f.color, transform: 'translateX(-50%)' }}>{f.text}</div>
        ))}

        {/* Rune particles */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #a855f7 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Instruction */}
        <div className="absolute bottom-5 left-0 right-0 text-center px-4">
          <div className="bg-arcane-dark/80 rounded-lg px-3 py-2 inline-block" style={{ border: '1px solid #7c3aed20' }}>
            <div className="text-white text-[11px] font-semibold">⭕ กดตอนวงชิดกัน! · ☠️ Danger = +8 แต่พลาด = -5</div>
          </div>
        </div>
      </div>
    </div>
  );
}
