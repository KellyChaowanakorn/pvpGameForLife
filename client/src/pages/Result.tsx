import { useGameStore } from '../lib/store';
import { findMatch } from '../lib/socket';

export default function Result() {
  const { result, resultData, setScreen, gameMode } = useGameStore();
  if (!result || !resultData) return null;
  const isWin = result === 'win', isDraw = result === 'draw';

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center animate-[fadeIn_0.3s_ease]">
      <div className="text-7xl mb-3 animate-[pop_0.5s_ease]">{isWin ? '🏆' : isDraw ? '🤝' : '😤'}</div>
      <div className={`text-2xl font-black mb-1 ${isWin ? 'text-cute-mint' : isDraw ? 'text-cute-gold' : 'text-cute-red'}`}>
        {isWin ? 'คุณชนะ! 🎉' : isDraw ? 'เสมอ!' : 'คุณแพ้...'}
      </div>
      {resultData.reason === 'opponent_disconnected' && (
        <div className="text-cute-gray text-xs mb-3">คู่แข่งหลุดการเชื่อมต่อ</div>
      )}
      <div className="cute-card px-7 py-4 flex gap-10 my-4">
        <div className="text-center">
          <div className="text-[11px] text-cute-gray font-semibold mb-1">คุณ</div>
          <div className={`text-3xl font-black ${isWin || isDraw ? 'text-cute-mint' : 'text-cute-red'}`}>{resultData.yourScore}</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] text-cute-gray font-semibold mb-1">คู่แข่ง</div>
          <div className={`text-3xl font-black ${isWin ? 'text-cute-red' : 'text-cute-mint'}`}>{resultData.oppScore}</div>
        </div>
      </div>
      <div className={`text-lg font-extrabold mb-5 ${isWin ? 'text-cute-mint' : isDraw ? 'text-cute-gold' : 'text-cute-red'}`}>
        {isWin ? `+฿${resultData.prize.toFixed(2)} 🎉` : isDraw ? `คืน ฿${resultData.refund.toFixed(2)}` : '-฿5.00'}
      </div>
      <button onClick={() => findMatch(gameMode)}
        className="cute-btn w-full max-w-[280px] bg-cute-pink text-white py-3.5 text-sm shadow-lg shadow-cute-pink/20 mb-2">
        🎮 เล่นอีกครั้ง
      </button>
      <button onClick={() => setScreen('lobby')}
        className="cute-btn w-full max-w-[280px] bg-white text-cute-dark border-2 border-cute-border py-3 text-sm">
        🏠 กลับ Lobby
      </button>
    </div>
  );
}
