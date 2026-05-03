import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../lib/store';

type CardType = 'attack' | 'block' | 'trick';
type GameState = 'lobby' | 'matchmaking' | 'countdown' | 'choosing' | 'reveal' | 'result';
type RoundWinner = 'player' | 'opponent' | 'draw';

interface RoundResult {
  round: number;
  playerCard: CardType;
  opponentCard: CardType;
  winner: RoundWinner;
  pointsEarned: number;
}

export default function CardClashGame() {
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
  const [currentRound, setCurrentRound] = useState(1);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [opponentCardState, setOpponentCardState] = useState<CardType | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundResult[]>([]);
  const [lastRoundWinner, setLastRoundWinner] = useState<RoundWinner | null>(null);
  const [showFloatingText, setShowFloatingText] = useState<{ text: string; color: string } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MAX_ROUNDS = 6;
  const ROUND_TIME = 5;

  const playSound = (type: string) => { console.log(`🔊 Sound: ${type}`); };

  const determineWinner = (player: CardType, opp: CardType): { winner: RoundWinner; playerPoints: number; oppPoints: number } => {
    if (player === opp) return { winner: 'draw', playerPoints: 3, oppPoints: 3 };
    const playerWins = (player === 'attack' && opp === 'trick') || (player === 'trick' && opp === 'block') || (player === 'block' && opp === 'attack');
    if (playerWins) {
      let points = 10;
      if (lastRoundWinner === 'opponent') { points += 5; setShowFloatingText({ text: 'COMEBACK!', color: 'text-yellow-400' }); }
      const consecutiveWins = roundHistory.filter(r => r.winner === 'player').length;
      if (consecutiveWins >= 2) { points += 5; setShowFloatingText({ text: 'STREAK!', color: 'text-orange-400' }); }
      if (currentRound === MAX_ROUNDS) { points += 5; setShowFloatingText({ text: 'HYPE!', color: 'text-red-400' }); }
      return { winner: 'player', playerPoints: points, oppPoints: 0 };
    }
    return { winner: 'opponent', playerPoints: 0, oppPoints: 10 };
  };

  const generateOpponentCard = (): CardType => {
    const rand = Math.random();
    const cards: CardType[] = ['attack', 'block', 'trick'];
    if (rand < 0.5) return cards[Math.floor(Math.random() * 3)];
    if (rand < 0.75 && roundHistory.length > 0) {
      const lastPlayerCard = roundHistory[roundHistory.length - 1].playerCard;
      if (lastPlayerCard === 'attack') return 'block';
      if (lastPlayerCard === 'block') return 'trick';
      return 'attack';
    }
    if (rand < 0.9 && roundHistory.length > 0) {
      const last = roundHistory[roundHistory.length - 1];
      if (last.winner === 'opponent') return last.opponentCard;
    }
    return 'trick';
  };

  const handleCardSelect = (card: CardType) => {
    if (gameState !== 'choosing') return;
    setSelectedCard(card);
    const oppCard = generateOpponentCard();
    setOpponentCardState(oppCard);
    const result = determineWinner(card, oppCard);

    setTimeout(() => {
      setGameState('reveal');
      const roundResult: RoundResult = { round: currentRound, playerCard: card, opponentCard: oppCard, winner: result.winner, pointsEarned: result.playerPoints };
      setRoundHistory(prev => [...prev, roundResult]);
      setPlayerScore(prev => prev + result.playerPoints);
      setOpponentScore(prev => prev + result.oppPoints);
      setLastRoundWinner(result.winner === 'draw' ? null : result.winner);
      playSound(result.winner === 'player' ? 'correct' : 'wrong');

      revealTimerRef.current = setTimeout(() => {
        if (currentRound >= MAX_ROUNDS || timeLeft <= 0) { endGame(); }
        else { setCurrentRound(prev => prev + 1); setSelectedCard(null); setOpponentCardState(null); setGameState('choosing'); setShowFloatingText(null); }
      }, 2000);
    }, 500);
  };

  useEffect(() => {
    if (gameState !== 'choosing' && gameState !== 'reveal') { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 6) playSound('warning');
        if (prev <= 1) {
          if (gameState === 'choosing' && !selectedCard) {
            const cards: CardType[] = ['attack', 'block', 'trick'];
            handleCardSelect(cards[Math.floor(Math.random() * 3)]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); if (revealTimerRef.current) clearTimeout(revealTimerRef.current); };
  }, [gameState, selectedCard, currentRound]);

  const endGame = () => { if (timerRef.current) clearInterval(timerRef.current); if (revealTimerRef.current) clearTimeout(revealTimerRef.current); setGameState('result'); playSound(playerScore > opponentScore ? 'victory' : 'defeat'); };

  const startMatchmaking = () => {
    setGameState('matchmaking');
    setTimeout(() => {
      setOpponent({ userId: 'opp-' + Math.random().toString(36).substr(2, 9), displayName: ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey'][Math.floor(Math.random() * 5)], pictureUrl: undefined });
      setGameState('countdown'); playSound('countdown');
      let count = 3;
      const cd = setInterval(() => { count--; if (count <= 0) { clearInterval(cd); setGameState('choosing'); setTimeLeft(ROUND_TIME); setCurrentRound(1); setPlayerScore(0); setOpponentScore(0); setRoundHistory([]); setSelectedCard(null); setOpponentCardState(null); setLastRoundWinner(null); } }, 1000);
    }, 1500);
  };

  const handleRematch = () => { setGameState('lobby'); setOpponent(null); };
  const calculateReward = () => playerScore > opponentScore ? 95 : 0;
  const handleResultContinue = () => {
    const r = calculateReward();
    if (r > 0) { addVirtualCoins(r); incrementWinStreak(); addRankPoints(10); }
    else if (playerScore < opponentScore) { resetWinStreak(); }
    handleRematch();
  };

  const getCardIcon = (card: CardType) => card === 'attack' ? '⚔️' : card === 'block' ? '🛡️' : '✨';
  const getCardColor = (card: CardType) => card === 'attack' ? 'from-red-500 to-orange-500' : card === 'block' ? 'from-blue-500 to-cyan-500' : 'from-purple-500 to-pink-500';

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-pink-900">
      {gameState === 'lobby' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="text-6xl mb-4">⚔️</div>
          <h1 className="text-3xl font-bold text-white mb-2">Card Clash 30</h1>
          <p className="text-gray-300 text-center mb-6">Attack beats Trick, Trick beats Block, Block beats Attack. Win 6 rounds!</p>
          <button onClick={startMatchmaking} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-full text-xl shadow-lg active:scale-95">Find Match</button>
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

      {gameState === 'choosing' && (
        <div className="min-h-screen p-4 pt-8">
          <div className="flex justify-between items-center mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <p className="text-white text-sm">{playerProfile?.displayName || 'You'}</p>
              <p className="text-yellow-400 font-bold text-2xl">{playerScore}</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold">Round {currentRound}/{MAX_ROUNDS}</p>
              <p className="text-red-400 font-bold text-xl">⏱️ {timeLeft}s</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 text-right">
              <p className="text-white text-sm">{opponent?.displayName || 'Opponent'}</p>
              <p className="text-red-400 font-bold text-2xl">{opponentScore}</p>
            </div>
          </div>
          <div className="flex justify-center gap-4 mb-6">
            {(['attack', 'block', 'trick'] as CardType[]).map((card) => (
              <button key={card} onClick={() => handleCardSelect(card)}
                className={`w-24 h-32 bg-gradient-to-br ${getCardColor(card)} rounded-xl flex flex-col items-center justify-center shadow-lg active:scale-95`}>
                <span className="text-4xl mb-2">{getCardIcon(card)}</span>
                <span className="text-white font-bold capitalize">{card}</span>
              </button>
            ))}
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-white text-sm mb-2">Round History</p>
            <div className="flex gap-2">
              {roundHistory.map((round, idx) => (
                <div key={idx} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${round.winner === 'player' ? 'bg-green-500' : round.winner === 'draw' ? 'bg-gray-500' : 'bg-red-500'}`}>
                  {getCardIcon(round.playerCard)}
                </div>
              ))}
              {Array(MAX_ROUNDS - roundHistory.length).fill(null).map((_, idx) => (
                <div key={idx} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-white">{roundHistory.length + idx + 1}</div>
              ))}
            </div>
          </div>
          {showFloatingText && <div className={`text-center mt-4 font-bold text-xl ${showFloatingText.color} animate-bounce`}>{showFloatingText.text}</div>}
        </div>
      )}

      {gameState === 'reveal' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <h2 className="text-2xl font-bold text-white mb-8">CLASH!</h2>
          <div className="flex items-center gap-8 mb-8">
            <div className="text-center">
              <p className="text-white mb-2">{playerProfile?.displayName || 'You'}</p>
              <div className={`w-32 h-40 bg-gradient-to-br ${selectedCard ? getCardColor(selectedCard) : 'from-gray-600 to-gray-700'} rounded-xl flex flex-col items-center justify-center shadow-lg`}>
                <span className="text-5xl mb-2">{selectedCard ? getCardIcon(selectedCard) : '?'}</span>
                <span className="text-white font-bold capitalize">{selectedCard || ''}</span>
              </div>
            </div>
            <div className="text-4xl font-bold text-white">VS</div>
            <div className="text-center">
              <p className="text-white mb-2">{opponent?.displayName || 'Opponent'}</p>
              <div className={`w-32 h-40 bg-gradient-to-br ${opponentCardState ? getCardColor(opponentCardState) : 'from-gray-600 to-gray-700'} rounded-xl flex flex-col items-center justify-center shadow-lg`}>
                <span className="text-5xl mb-2">{opponentCardState ? getCardIcon(opponentCardState) : '?'}</span>
                <span className="text-white font-bold capitalize">{opponentCardState || ''}</span>
              </div>
            </div>
          </div>
          {showFloatingText && <div className={`text-3xl font-bold ${showFloatingText.color} animate-bounce`}>{showFloatingText.text}</div>}
        </div>
      )}

      {gameState === 'result' && (() => {
        const won = playerScore > opponentScore; const isDraw = playerScore === opponentScore; const reward = calculateReward();
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="text-6xl mb-4">{won ? '🏆' : isDraw ? '🤝' : '😢'}</div>
            <h2 className="text-3xl font-bold text-white mb-2">{won ? 'VICTORY!' : isDraw ? 'DRAW!' : 'DEFEAT'}</h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 w-full max-w-sm mb-6">
              <div className="flex justify-between mb-4"><span className="text-white">Your Score</span><span className="text-yellow-400 font-bold text-2xl">{playerScore}</span></div>
              <div className="flex justify-between mb-4"><span className="text-white">Opponent</span><span className="text-red-400 font-bold text-2xl">{opponentScore}</span></div>
              <div className="flex justify-between mb-4"><span className="text-white">Rounds Won</span><span className="text-green-400 font-bold">{roundHistory.filter(r => r.winner === 'player').length}/{MAX_ROUNDS}</span></div>
              <hr className="border-white/20 my-4" />
              <div className="flex justify-between"><span className="text-white">Prize</span><span className="text-yellow-400 font-bold">100 🪙</span></div>
              <div className="flex justify-between text-sm text-gray-400"><span>Fee</span><span>-5 🪙</span></div>
              <div className="flex justify-between mt-2 text-lg"><span className="text-white">You Win</span><span className="text-yellow-400 font-bold text-2xl">{reward} 🪙</span></div>
            </div>
            <div className="flex gap-3 w-full max-w-sm">
              <button onClick={handleResultContinue} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl">Rematch</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
