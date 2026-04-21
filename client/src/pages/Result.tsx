import { useGameStore } from '../lib/store';
import { findMatch } from '../lib/socket';

export default function Result() {
  const { result, resultData, setScreen, gameMode } = useGameStore();

  if (!result || !resultData) return null;

  const isWin = result === 'win';
  const isDraw = result === 'draw';

  const icon = isWin ? '🏆' : isDraw ? '🤝' : '😤';
  const title = isWin ? 'You win!' : isDraw ? 'Draw!' : 'You lose';
  const titleColor = isWin ? 'text-neon' : isDraw ? 'text-gold' : 'text-danger';

  let prizeText = '';
  let prizeColor = '';
  if (isWin) {
    prizeText = `+฿${resultData.prize.toFixed(2)}`;
    prizeColor = 'text-neon';
  } else if (isDraw) {
    prizeText = `Refund ฿${resultData.refund.toFixed(2)}`;
    prizeColor = 'text-gold';
  } else {
    prizeText = '-฿5.00';
    prizeColor = 'text-danger';
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center animate-[fadeIn_0.3s_ease]">
      {/* Icon */}
      <div className="text-7xl mb-3 animate-[pop_0.5s_ease]">{icon}</div>

      {/* Title */}
      <div className={`text-2xl font-black mb-1 ${titleColor}`}>{title}</div>

      {/* Reason */}
      {resultData.reason === 'opponent_disconnected' && (
        <div className="text-stake-gray text-xs mb-3">Opponent disconnected</div>
      )}

      {/* Scores */}
      <div className="bg-stake-card rounded-xl px-7 py-4 flex gap-9 my-4 border border-stake-border">
        <div className="text-center">
          <div className="text-[11px] text-stake-gray uppercase font-semibold mb-1">You</div>
          <div className={`text-3xl font-black ${isWin || isDraw ? 'text-neon' : 'text-danger'}`}>
            {resultData.yourScore}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[11px] text-stake-gray uppercase font-semibold mb-1">Opponent</div>
          <div className={`text-3xl font-black ${isWin ? 'text-danger' : isDraw ? 'text-neon' : 'text-neon'}`}>
            {resultData.oppScore}
          </div>
        </div>
      </div>

      {/* Prize */}
      <div className={`text-lg font-extrabold mb-5 ${prizeColor}`}>{prizeText}</div>

      {/* Buttons */}
      <button
        onClick={() => findMatch(gameMode)}
        className="w-full max-w-[280px] bg-neon text-stake-bg font-extrabold py-3.5 rounded-xl text-sm uppercase tracking-wider mb-2 transition-all active:scale-97"
      >
        Play again
      </button>
      <button
        onClick={() => setScreen('lobby')}
        className="w-full max-w-[280px] bg-stake-hover border border-stake-border text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-97"
      >
        Lobby
      </button>
    </div>
  );
}
