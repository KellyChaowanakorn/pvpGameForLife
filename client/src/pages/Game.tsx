import { useGameStore } from '../lib/store';
import { sendTap } from '../lib/socket';

export default function Game() {
  const { myScore, oppScore, timeLeft } = useGameStore();
  const isUrgent = timeLeft <= 2;
  const isOver = timeLeft <= 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center select-none animate-[fadeIn_0.3s_ease]">
      {/* Timer */}
      <div className={`text-6xl font-black tabular-nums transition-colors ${isUrgent ? 'text-danger' : 'text-neon'} ${isUrgent && !isOver ? 'animate-pulse' : ''}`}>
        {timeLeft.toFixed(1)}
      </div>
      <div className="text-stake-gray text-xs uppercase tracking-widest font-semibold mb-5">
        Tap as fast as you can!
      </div>

      {/* Tap Button */}
      <button
        onTouchStart={(e) => { e.preventDefault(); if (!isOver) sendTap(); }}
        onClick={() => { if (!isOver) sendTap(); }}
        disabled={isOver}
        className={`w-44 h-44 rounded-full font-black text-lg uppercase tracking-widest transition-transform
          ${isOver
            ? 'bg-stake-border text-stake-gray cursor-not-allowed'
            : 'bg-neon text-stake-bg active:scale-90 shadow-[0_0_40px_rgba(0,231,1,0.25)]'
          }`}
      >
        TAP
      </button>

      {/* Your Score */}
      <div className="text-5xl font-black mt-5 tabular-nums">{myScore}</div>
      <div className="text-stake-gray text-[11px] uppercase tracking-wider font-semibold mt-1">Your taps</div>

      {/* Opponent Score */}
      <div className="mt-3 text-stake-gray text-sm">
        Opponent: <span className="text-danger font-extrabold text-lg">{oppScore}</span>
      </div>
    </div>
  );
}
