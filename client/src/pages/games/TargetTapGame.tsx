import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playHit, playMiss } from '../../lib/sounds';

interface Target {
  id: number; x: number; y: number; size: number;
  appearAt: number; duration: number; points: number;
}

interface Particle {
  id: number; x: number; y: number; color: string;
}

export default function TargetTapGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const [visibleTargets, setVisibleTargets] = useState<Target[]>([]);
  const [hitIds, setHitIds] = useState<Set<number>>(new Set());
  const [particles, setParticles] = useState<Particle[]>([]);
  const [combo, setCombo] = useState(0);
  const startRef = useRef(Date.now());
  const targetsRef = useRef<Target[]>([]);
  const particleId = useRef(0);

  useEffect(() => {
    if (gameConfig?.data?.targets) {
      targetsRef.current = gameConfig.data.targets;
    } else {
      // Generate locally if no server config
      const targets: Target[] = [];
      for (let i = 0; i < 25; i++) {
        const progress = i / 25;
        targets.push({
          id: i, x: 10 + Math.random() * 80, y: 10 + Math.random() * 70,
          size: Math.max(6, 14 - progress * 8), appearAt: 400 + i * 380,
          duration: 1500 - progress * 500, points: progress > 0.7 ? 3 : progress > 0.4 ? 2 : 1,
        });
      }
      targetsRef.current = targets;
    }
    startRef.current = Date.now();
  }, [gameConfig]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const targets = targetsRef.current;
      const visible = targets.filter(t =>
        elapsed >= t.appearAt &&
        elapsed <= t.appearAt + t.duration &&
        !hitIds.has(t.id)
      );
      setVisibleTargets(visible);
    }, 30);
    return () => clearInterval(interval);
  }, [hitIds]);

  const handleTap = useCallback((target: Target, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (hitIds.has(target.id) || timeLeft <= 0) return;

    setHitIds(prev => new Set(prev).add(target.id));
    playHit();
    setCombo(c => c + 1);

    // Particles
    const newParticles: Particle[] = [];
    const colors = ['#00E701', '#FFD93D', '#FF6B6B', '#6BCB77', '#4FC3F7'];
    for (let i = 0; i < 6; i++) {
      newParticles.push({
        id: particleId.current++,
        x: target.x + (Math.random() - 0.5) * 10,
        y: target.y + (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id))), 500);

    if (matchId) {
      sendGameInput(matchId, 'tap', { targetId: target.id, x: target.x, y: target.y });
    }
    if (navigator.vibrate) navigator.vibrate(15);
  }, [hitIds, matchId, timeLeft]);

  const isUrgent = timeLeft <= 3;

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
          <div className="text-[10px] text-stake-gray uppercase font-semibold">🎯 Target Tap</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-stake-gray uppercase font-semibold">Opp</div>
          <div className="text-2xl font-black text-danger tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Combo indicator */}
      {combo >= 3 && (
        <div className="text-center mb-1 animate-bounce">
          <span className="text-gold font-black text-sm">🔥 COMBO x{combo}</span>
        </div>
      )}

      {/* Game Area */}
      <div className="flex-1 relative bg-stake-card rounded-2xl overflow-hidden border border-stake-border">
        {/* Grid lines for visual depth */}
        <div className="absolute inset-0 opacity-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="absolute w-full h-px bg-white" style={{ top: `${i * 10}%` }} />
          ))}
          {[...Array(10)].map((_, i) => (
            <div key={`v${i}`} className="absolute h-full w-px bg-white" style={{ left: `${i * 10}%` }} />
          ))}
        </div>

        {/* Targets */}
        {visibleTargets.map(target => (
          <button
            key={target.id}
            onTouchStart={(e) => handleTap(target, e)}
            onClick={(e) => handleTap(target, e)}
            className="absolute rounded-full border-2 border-white/40 transition-transform active:scale-75"
            style={{
              left: `${target.x}%`,
              top: `${target.y}%`,
              width: `${target.size * 2.5}%`,
              height: `${target.size * 2.5}%`,
              transform: 'translate(-50%, -50%)',
              background: target.points >= 3
                ? 'radial-gradient(circle, #FF6B6B 0%, #FF3333 100%)'
                : target.points >= 2
                  ? 'radial-gradient(circle, #FFD93D 0%, #FFB800 100%)'
                  : 'radial-gradient(circle, #00E701 0%, #00B801 100%)',
              boxShadow: `0 0 ${target.size}px ${target.points >= 3 ? '#FF6B6B' : target.points >= 2 ? '#FFD93D' : '#00E701'}50`,
              animation: 'pop 0.3s ease',
            }}
          >
            <span className="text-white font-black text-xs drop-shadow">
              {target.points >= 3 ? '+3' : target.points >= 2 ? '+2' : '+1'}
            </span>
          </button>
        ))}

        {/* Particles */}
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{
              left: `${p.x}%`, top: `${p.y}%`,
              background: p.color,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

        {/* Empty state + instruction */}
        {visibleTargets.length === 0 && timeLeft > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="text-stake-gray text-sm animate-pulse">Waiting for targets...</div>
            <div className="bg-stake-bg/80 rounded-xl px-4 py-2 text-center max-w-[250px]">
              <div className="text-white text-xs font-semibold mb-1">🎯 วิธีเล่น</div>
              <div className="text-stake-gray text-[11px]">กดเป้าที่ปรากฏบนจอให้เร็วที่สุด เป้าเล็ก = คะแนนเยอะ!</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
