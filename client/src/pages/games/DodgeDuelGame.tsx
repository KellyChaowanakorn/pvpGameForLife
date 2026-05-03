import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../lib/store';

type GameState = 'lobby' | 'matchmaking' | 'countdown' | 'playing' | 'result';
interface Obstacle { id: number; lane: number; y: number; type: 'normal' | 'fast'; }
interface Coin { id: number; lane: number; y: number; }

export default function DodgeDuelGame() {
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
  const [playerLane, setPlayerLane] = useState(1);
  const [playerHits, setPlayerHits] = useState(0);
  const [opponentHits, setOpponentHits] = useState(0);
  const [isStunned, setIsStunned] = useState(false);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [coins, setCoins] = useState<Coin[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const obstacleIdRef = useRef(0);
  const coinIdRef = useRef(0);
  const playerLaneRef = useRef(1);
  const stunnedRef = useRef(false);
  const scoreRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { playerLaneRef.current = playerLane; }, [playerLane]);
  useEffect(() => { stunnedRef.current = isStunned; }, [isStunned]);
  useEffect(() => { scoreRef.current = playerScore; }, [playerScore]);

  const playSound = (type: string) => { console.log(`🔊 ${type}`); };

  const moveLeft = useCallback(() => { if (!stunnedRef.current) setPlayerLane(prev => Math.max(0, prev - 1)); }, []);
  const moveRight = useCallback(() => { if (!stunnedRef.current) setPlayerLane(prev => Math.min(2, prev + 1)); }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') moveLeft(); if (e.key === 'ArrowRight') moveRight(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [moveLeft, moveRight]);

  // Game loop using setInterval (simpler than canvas for mobile)
  useEffect(() => {
    if (gameState !== 'playing') return;

    let spawnCounter = 0;
    gameLoopRef.current = setInterval(() => {
      spawnCounter++;

      // Spawn obstacles every ~1.5s
      if (spawnCounter % 30 === 0) {
        const lane = Math.floor(Math.random() * 3);
        const type = Math.random() > 0.8 ? 'fast' as const : 'normal' as const;
        setObstacles(prev => [...prev, { id: obstacleIdRef.current++, lane, y: -50, type }]);
      }

      // Spawn coins every ~2s
      if (spawnCounter % 40 === 0) {
        const lane = Math.floor(Math.random() * 3);
        setCoins(prev => [...prev, { id: coinIdRef.current++, lane, y: -40 }]);
      }

      // Move obstacles + collision
      setObstacles(prev => {
        const updated = prev.map(o => ({ ...o, y: o.y + (o.type === 'fast' ? 8 : 5) })).filter(o => o.y < 600);
        updated.forEach(o => {
          if (o.lane === playerLaneRef.current && o.y > 380 && o.y < 440 && !stunnedRef.current) {
            setPlayerScore(s => Math.max(0, s - 15));
            setPlayerHits(h => h + 1);
            setIsStunned(true); playSound('wrong');
            setTimeout(() => setIsStunned(false), 500);
          }
        });
        return updated;
      });

      // Move coins + collect
      setCoins(prev => {
        return prev.map(c => ({ ...c, y: c.y + 5 })).filter(c => {
          if (c.lane === playerLaneRef.current && c.y > 380 && c.y < 440) {
            setPlayerScore(s => s + 10); playSound('correct'); return false;
          }
          return c.y < 600;
        });
      });

      // Survival points
      if (spawnCounter % 20 === 0) setPlayerScore(s => s + 5);
    }, 50);

    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, [gameState]);

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { endGame(); return 0; } return prev - 1; });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState]);

  // Opponent AI
  useEffect(() => {
    if (gameState !== 'playing') return;
    const iv = setInterval(() => {
      setOpponentScore(prev => {
        if (Math.random() > 0.8) { setOpponentHits(h => h + 1); return Math.max(0, prev - 15); }
        if (Math.random() > 0.4) return prev + 10;
        return prev + 5;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [gameState]);

  const endGame = () => { if (timerRef.current) clearInterval(timerRef.current); if (gameLoopRef.current) clearInterval(gameLoopRef.current); setGameState('result'); };

  const startMatchmaking = () => {
    setGameState('matchmaking');
    setTimeout(() => {
      setOpponent({ userId: 'opp-' + Math.random().toString(36).substr(2, 9), displayName: ['Alex', 'Jordan', 'Taylor', 'Morgan'][Math.floor(Math.random() * 4)], pictureUrl: undefined });
      setGameState('countdown'); playSound('countdown');
      let count = 3;
      const cd = setInterval(() => { count--; if (count <= 0) { clearInterval(cd); setGameState('playing'); setTimeLeft(30); setPlayerScore(0); setOpponentScore(0); setPlayerLane(1); setObstacles([]); setCoins([]); setPlayerHits(0); setOpponentHits(0); setIsStunned(false); } }, 1000);
    }, 1500);
  };

  const calculateReward = () => playerScore > opponentScore ? 95 : (playerScore === opponentScore && playerHits < opponentHits ? 95 : 0);
  const handleResultContinue = () => {
    const r = calculateReward();
    if (r > 0) { addVirtualCoins(r); incrementWinStreak(); addRankPoints(10); } else if (playerScore < opponentScore) resetWinStreak();
    setGameState('lobby'); setOpponent(null);
  };

  const LANE_W = 33.33;
  const getLaneX = (lane: number) => lane * LANE_W + LANE_W / 2;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-900">
      {gameState === 'lobby' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="text-6xl mb-4">🏃</div>
          <h1 className="text-3xl font-bold text-white mb-2">Dodge Duel 30</h1>
          <p className="text-gray-300 text-center mb-6">Dodge obstacles, collect coins! 30 seconds!</p>
          <button onClick={startMatchmaking} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-4 px-8 rounded-full text-xl shadow-lg active:scale-95">Find Match</button>
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
        <div className="min-h-screen flex flex-col items-center p-4 pt-4">
          <div className="flex justify-between w-full max-w-md mb-2">
            <div className="bg-white/10 rounded-lg px-3 py-1">
              <p className="text-white text-xs">{playerProfile?.displayName || 'You'}</p>
              <p className="text-yellow-400 font-bold text-xl">{playerScore}</p>
            </div>
            <div className="text-white font-bold text-lg flex items-center">⏱️ {timeLeft}s</div>
            <div className="bg-white/10 rounded-lg px-3 py-1 text-right">
              <p className="text-white text-xs">{opponent?.displayName || 'Opp'}</p>
              <p className="text-red-400 font-bold text-xl">{opponentScore}</p>
            </div>
          </div>

          {/* Game board (HTML-based, not canvas) */}
          <div className="relative w-full max-w-[360px] h-[420px] bg-gray-900 rounded-xl border-2 border-purple-500 overflow-hidden">
            {/* Lane lines */}
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-gray-700" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-gray-700" />

            {/* Player */}
            <div className={`absolute w-10 h-10 rounded-full transition-all duration-100 ${isStunned ? 'bg-red-500 animate-pulse' : 'bg-green-400'}`}
              style={{ left: `calc(${getLaneX(playerLane)}% - 20px)`, bottom: '20px' }} />

            {/* Obstacles */}
            {obstacles.map(o => (
              <div key={o.id} className={`absolute w-10 h-10 rounded ${o.type === 'fast' ? 'bg-red-500' : 'bg-orange-500'}`}
                style={{ left: `calc(${getLaneX(o.lane)}% - 20px)`, top: `${o.y}px` }} />
            ))}

            {/* Coins */}
            {coins.map(c => (
              <div key={c.id} className="absolute w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center text-xs"
                style={{ left: `calc(${getLaneX(c.lane)}% - 14px)`, top: `${c.y}px` }}>🪙</div>
            ))}

            {isStunned && <div className="absolute inset-0 flex items-center justify-center"><span className="text-red-400 font-bold text-2xl animate-pulse">STUNNED!</span></div>}
          </div>

          {/* Controls */}
          <div className="flex gap-4 mt-3 w-full max-w-[360px]">
            <button onClick={moveLeft} disabled={isStunned}
              className="flex-1 bg-blue-500 text-white font-bold py-5 rounded-xl text-xl disabled:opacity-50 active:scale-95 touch-manipulation">⬅️ Left</button>
            <button onClick={moveRight} disabled={isStunned}
              className="flex-1 bg-blue-500 text-white font-bold py-5 rounded-xl text-xl disabled:opacity-50 active:scale-95 touch-manipulation">Right ➡️</button>
          </div>
        </div>
      )}

      {gameState === 'result' && (() => {
        const won = playerScore > opponentScore || (playerScore === opponentScore && playerHits < opponentHits);
        const isDraw = playerScore === opponentScore && playerHits === opponentHits;
        const reward = calculateReward();
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="text-6xl mb-4">{won ? '🏆' : isDraw ? '🤝' : '😢'}</div>
            <h2 className="text-3xl font-bold text-white mb-2">{won ? 'VICTORY!' : isDraw ? 'DRAW!' : 'DEFEAT'}</h2>
            <div className="bg-white/10 rounded-2xl p-6 w-full max-w-sm mb-6">
              <div className="flex justify-between mb-3"><span className="text-white">You</span><span className="text-yellow-400 font-bold text-2xl">{playerScore}</span></div>
              <div className="flex justify-between mb-3"><span className="text-white">Opponent</span><span className="text-red-400 font-bold text-2xl">{opponentScore}</span></div>
              <div className="flex justify-between mb-3"><span className="text-white">Hits</span><span className="text-red-400 font-bold">{playerHits} vs {opponentHits}</span></div>
              <hr className="border-white/20 my-3" />
              <div className="flex justify-between mt-2 text-lg"><span className="text-white">You Win</span><span className="text-yellow-400 font-bold text-2xl">{reward} 🪙</span></div>
            </div>
            <button onClick={handleResultContinue} className="w-full max-w-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 rounded-xl">Rematch</button>
          </div>
        );
      })()}
    </div>
  );
}
