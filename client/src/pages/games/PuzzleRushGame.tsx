import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../lib/store';

type PuzzleType = 'number_tap' | 'color_match' | 'missing_tile';
type GameState = 'lobby' | 'matchmaking' | 'countdown' | 'playing' | 'result';
interface Puzzle { type: PuzzleType; data: any; correctAnswer: number | string; }

const COLOR_MAP: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7',
};

export default function PuzzleRushGame() {
  const navigate = useNavigate();
  const playerProfile = useGameStore((s) => s.playerProfile);
  const opponent = useGameStore((s) => s.opponent);
  const setOpponent = useGameStore((s) => s.setOpponent);
  const addVirtualCoins = useGameStore((s) => s.addVirtualCoins);
  const incrementWinStreak = useGameStore((s) => s.incrementWinStreak);
  const resetWinStreak = useGameStore((s) => s.resetWinStreak);
  const addRankPoints = useGameStore((s) => s.addRankPoints);

  const [gameState, setGameState] = useState<GameState>('lobby');
  const [timeLeft, setTimeLeft] = useState(30);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [combo, setCombo] = useState(0);
  const [floatingTexts, setFloatingTexts] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [opponentCorrectCount, setOpponentCorrectCount] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const opponentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const floatingIdRef = useRef(0);

  const playSound = (type: string) => { console.log(`🔊 ${type}`); };

  const generatePuzzle = useCallback((): Puzzle => {
    const types: PuzzleType[] = ['number_tap', 'color_match', 'missing_tile'];
    const type = types[Math.floor(Math.random() * types.length)];
    switch (type) {
      case 'number_tap': {
        const numbers = Array.from({ length: 5 }, (_, i) => i + 1 + Math.floor(Math.random() * 5));
        const shuffled = [...numbers].sort(() => Math.random() - 0.5);
        return { type, data: { numbers: shuffled }, correctAnswer: Math.min(...numbers) };
      }
      case 'color_match': {
        const colors = ['red', 'blue', 'green', 'yellow', 'purple'];
        const target = colors[Math.floor(Math.random() * colors.length)];
        const options = [...colors].sort(() => Math.random() - 0.5);
        return { type, data: { target, options }, correctAnswer: target };
      }
      case 'missing_tile': {
        const start = Math.floor(Math.random() * 5) + 1;
        const sequence = [start, start + 1, start + 2, start + 4];
        const missing = start + 3;
        const options = [missing, missing - 1, missing + 1, missing + 2].sort(() => Math.random() - 0.5);
        return { type, data: { sequence, options }, correctAnswer: missing };
      }
      default: return generatePuzzle();
    }
  }, []);

  const addFloatingText = (text: string, x: number, y: number) => {
    const id = floatingIdRef.current++;
    setFloatingTexts(prev => [...prev, { id, text, x, y }]);
    setTimeout(() => setFloatingTexts(prev => prev.filter(ft => ft.id !== id)), 1000);
  };

  const handleAnswer = (answer: number | string, e?: React.MouseEvent | React.TouchEvent) => {
    if (!currentPuzzle || gameState !== 'playing') return;
    const isCorrect = answer === currentPuzzle.correctAnswer;
    const x = window.innerWidth / 2;
    const y = 200;

    if (isCorrect) {
      const basePoints = currentPuzzle.type === 'number_tap' ? 10 : currentPuzzle.type === 'color_match' ? 15 : 20;
      const comboBonus = combo >= 5 ? 25 : combo >= 3 ? 10 : 0;
      const speedBonus = timeLeft > 25 ? 5 : 0;
      const totalPoints = basePoints + comboBonus + speedBonus;
      setPlayerScore(prev => prev + totalPoints);
      setCorrectCount(prev => prev + 1);
      setCombo(prev => prev + 1);
      playSound('correct');
      addFloatingText(`+${totalPoints}`, x, y);
      if (combo >= 3) addFloatingText(combo >= 5 ? 'SUPER COMBO!' : 'COMBO!', x, y - 30);
    } else {
      setPlayerScore(prev => Math.max(0, prev - 5));
      setCombo(0);
      playSound('wrong');
      addFloatingText('-5', x, y);
    }
    setCurrentPuzzle(generatePuzzle());
  };

  // Opponent AI
  useEffect(() => {
    if (gameState !== 'playing') return;
    opponentTimerRef.current = setInterval(() => {
      setOpponentScore(prev => {
        if (Math.random() > 0.85) return Math.max(0, prev - 5);
        if (Math.random() > 0.3) { setOpponentCorrectCount(c => c + 1); return prev + Math.floor(Math.random() * 15) + 10; }
        return prev;
      });
    }, 2000);
    return () => { if (opponentTimerRef.current) clearInterval(opponentTimerRef.current); };
  }, [gameState]);

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { endGame(); return 0; } return prev - 1; });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState]);

  const endGame = () => { if (timerRef.current) clearInterval(timerRef.current); if (opponentTimerRef.current) clearInterval(opponentTimerRef.current); setGameState('result'); };

  const startMatchmaking = () => {
    setGameState('matchmaking');
    setTimeout(() => {
      setOpponent({ userId: 'opp-' + Math.random().toString(36).substr(2, 9), displayName: ['Alex', 'Jordan', 'Taylor', 'Morgan'][Math.floor(Math.random() * 4)], pictureUrl: undefined });
      setGameState('countdown'); playSound('countdown');
      let count = 3;
      const cd = setInterval(() => { count--; if (count <= 0) { clearInterval(cd); setGameState('playing'); setCurrentPuzzle(generatePuzzle()); setTimeLeft(30); setPlayerScore(0); setOpponentScore(0); setCombo(0); setCorrectCount(0); setOpponentCorrectCount(0); } }, 1000);
    }, 1500);
  };

  const calculateReward = () => playerScore > opponentScore ? 95 : 0;
  const handleResultContinue = () => {
    const r = calculateReward();
    if (r > 0) { addVirtualCoins(r); incrementWinStreak(); addRankPoints(10); } else if (playerScore < opponentScore) resetWinStreak();
    setGameState('lobby'); setOpponent(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-cyan-900">
      {gameState === 'lobby' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="text-6xl mb-4">🧩</div>
          <h1 className="text-3xl font-bold text-white mb-2">Puzzle Rush Duel</h1>
          <p className="text-gray-300 text-center mb-6">Solve puzzles fast! 30 seconds!</p>
          <button onClick={startMatchmaking} className="bg-gradient-to-r from-green-400 to-cyan-500 text-white font-bold py-4 px-8 rounded-full text-xl shadow-lg active:scale-95">Find Match</button>
        </div>
      )}

      {gameState === 'matchmaking' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-white">Finding opponent...</h2>
        </div>
      )}

      {gameState === 'countdown' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="text-8xl font-bold text-white animate-bounce">3</div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="min-h-screen p-4 pt-8">
          <div className="flex justify-between items-center mb-4">
            <div className="bg-white/10 rounded-lg px-4 py-2">
              <p className="text-white text-sm">{playerProfile?.displayName || 'You'}</p>
              <p className="text-yellow-400 font-bold text-2xl">{playerScore}</p>
            </div>
            <div className="text-white font-bold text-xl">⏱️ {timeLeft}s</div>
            <div className="bg-white/10 rounded-lg px-4 py-2 text-right">
              <p className="text-white text-sm">{opponent?.displayName || 'Opp'}</p>
              <p className="text-red-400 font-bold text-2xl">{opponentScore}</p>
            </div>
          </div>

          {combo >= 2 && <div className="text-center mb-4"><span className={`text-lg font-bold ${combo >= 5 ? 'text-yellow-400' : 'text-green-400'}`}>🔥 {combo}x COMBO!</span></div>}

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-4 min-h-[300px] flex flex-col items-center justify-center">
            {currentPuzzle?.type === 'number_tap' && (
              <>
                <h3 className="text-white text-xl font-bold mb-4">Tap the smallest number!</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(currentPuzzle.data.numbers as number[]).map((num, idx) => (
                    <button key={idx} onClick={() => handleAnswer(num)}
                      className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl text-white font-bold text-2xl shadow-lg active:scale-95 touch-manipulation">{num}</button>
                  ))}
                </div>
              </>
            )}

            {currentPuzzle?.type === 'color_match' && (
              <>
                <h3 className="text-white text-xl font-bold mb-4">Find: <span style={{ color: COLOR_MAP[currentPuzzle.data.target] || '#fff' }}>{currentPuzzle.data.target}</span></h3>
                <div className="grid grid-cols-3 gap-3">
                  {(currentPuzzle.data.options as string[]).map((color, idx) => (
                    <button key={idx} onClick={() => handleAnswer(color)}
                      className="w-16 h-16 rounded-xl shadow-lg active:scale-95 touch-manipulation border-2 border-white/20"
                      style={{ backgroundColor: COLOR_MAP[color] || '#888' }} />
                  ))}
                </div>
              </>
            )}

            {currentPuzzle?.type === 'missing_tile' && (
              <>
                <h3 className="text-white text-xl font-bold mb-4">What's missing?</h3>
                <div className="flex gap-2 mb-6">
                  {(currentPuzzle.data.sequence as number[]).map((num, idx) => (
                    <div key={idx} className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-white font-bold">{num}</div>
                  ))}
                  <div className="w-12 h-12 bg-red-500/50 rounded-lg flex items-center justify-center text-white font-bold">?</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(currentPuzzle.data.options as number[]).map((opt, idx) => (
                    <button key={idx} onClick={() => handleAnswer(opt)}
                      className="w-16 h-16 bg-gradient-to-br from-green-400 to-cyan-500 rounded-xl text-white font-bold text-2xl shadow-lg active:scale-95 touch-manipulation">{opt}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          {floatingTexts.map(ft => (
            <div key={ft.id} className="fixed pointer-events-none text-white font-bold text-2xl animate-bounce z-50" style={{ left: ft.x, top: ft.y }}>{ft.text}</div>
          ))}
        </div>
      )}

      {gameState === 'result' && (() => {
        const won = playerScore > opponentScore; const isDraw = playerScore === opponentScore; const reward = calculateReward();
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="text-6xl mb-4">{won ? '🏆' : isDraw ? '🤝' : '😢'}</div>
            <h2 className="text-3xl font-bold text-white mb-2">{won ? 'VICTORY!' : isDraw ? 'DRAW!' : 'DEFEAT'}</h2>
            <div className="bg-white/10 rounded-2xl p-6 w-full max-w-sm mb-6">
              <div className="flex justify-between mb-3"><span className="text-white">You</span><span className="text-yellow-400 font-bold text-2xl">{playerScore}</span></div>
              <div className="flex justify-between mb-3"><span className="text-white">Opponent</span><span className="text-red-400 font-bold text-2xl">{opponentScore}</span></div>
              <div className="flex justify-between mb-3"><span className="text-white">Correct</span><span className="text-green-400 font-bold">{correctCount}</span></div>
              <hr className="border-white/20 my-3" />
              <div className="flex justify-between mt-2 text-lg"><span className="text-white">You Win</span><span className="text-yellow-400 font-bold text-2xl">{reward} 🪙</span></div>
            </div>
            <button onClick={handleResultContinue} className="w-full max-w-sm bg-gradient-to-r from-green-400 to-cyan-500 text-white font-bold py-3 rounded-xl">Rematch</button>
          </div>
        );
      })()}
    </div>
  );
}
