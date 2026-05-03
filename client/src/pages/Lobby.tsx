import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../lib/store';
import { useEffect, useState } from 'react';

interface GameCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: 'LIVE' | 'SOON';
}

export default function Lobby() {
  const navigate = useNavigate();
  const playerProfile = useGameStore((s) => s.playerProfile);
  const setPlayerProfile = useGameStore((s) => s.setPlayerProfile);
  const virtualCoins = useGameStore((s) => s.virtualCoins);
  const rankPoints = useGameStore((s) => s.rankPoints);
  const [liffAvailable, setLiffAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).liff) {
      setLiffAvailable(true);
      if (!playerProfile) {
        (window as any).liff.getProfile()
          .then((profile: any) => {
            setPlayerProfile({ userId: profile.userId, displayName: profile.displayName, pictureUrl: profile.pictureUrl });
          })
          .catch(() => {
            setPlayerProfile({ userId: 'mock-user-' + Math.random().toString(36).substr(2, 9), displayName: 'Player', pictureUrl: undefined });
          });
      }
    } else {
      if (!playerProfile) {
        setPlayerProfile({ userId: 'mock-user-' + Math.random().toString(36).substr(2, 9), displayName: 'Player', pictureUrl: undefined });
      }
    }
  }, [playerProfile, setPlayerProfile]);

  const games: GameCard[] = [
    { id: 'archer_battle', name: 'Archer Battle', description: 'Aim & shoot! Defeat enemies in this action archery duel', icon: '🏹', color: 'from-red-500 to-orange-500', status: 'LIVE' },
    { id: 'memory_match', name: 'Memory Match', description: 'Test your memory! Find matching pairs faster than your opponent', icon: '🧠', color: 'from-blue-500 to-purple-500', status: 'LIVE' },
    { id: 'speed_quiz', name: 'Speed Quiz', description: 'Quick thinking wins! Answer trivia questions before time runs out', icon: '⚡', color: 'from-yellow-500 to-red-500', status: 'LIVE' },
    { id: 'puzzle_rush', name: 'Puzzle Rush', description: 'Fast puzzle race! Solve number, color & sequence puzzles in 30s', icon: '🧩', color: 'from-green-400 to-cyan-500', status: 'LIVE' },
    { id: 'card_clash', name: 'Card Clash', description: 'Strategy duel! Attack, Block, Trick - outsmart your opponent', icon: '⚔️', color: 'from-purple-600 to-pink-600', status: 'LIVE' },
    { id: 'dodge_duel', name: 'Dodge Duel', description: 'Reaction test! Dodge obstacles & collect coins in 3 lanes', icon: '🏃', color: 'from-indigo-500 to-purple-600', status: 'LIVE' },
    { id: 'slot_machine', name: 'Slot Machine', description: 'Luck & fun! Spin the reels and match symbols for big rewards', icon: '🎰', status: 'LIVE', color: 'from-yellow-400 to-orange-500' },
  ];

  const handleGameSelect = (gameId: string, status: string) => {
    if (status === 'LIVE') navigate(`/game/${gameId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 p-4 pb-20">
      <div className="flex items-center justify-between mb-6 pt-4">
        <div className="flex items-center gap-3">
          {playerProfile?.pictureUrl ? (
            <img src={playerProfile.pictureUrl} alt={playerProfile.displayName} className="w-12 h-12 rounded-full border-2 border-yellow-400" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
              {playerProfile?.displayName?.charAt(0) || 'P'}
            </div>
          )}
          <div>
            <h1 className="text-white font-bold text-lg">{playerProfile?.displayName || 'Player'}</h1>
            <p className="text-yellow-400 text-sm font-semibold">🪙 {virtualCoins} coins</p>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
          <span className="text-white text-sm">🏆 Rank: {rankPoints} pts</span>
        </div>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Choose Your Game</h2>
        <p className="text-gray-300 text-sm">7 LIVE games • 30-second matches • Win virtual coins!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((game) => (
          <button key={game.id} onClick={() => handleGameSelect(game.id, game.status)} disabled={game.status !== 'LIVE'}
            className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 transform hover:scale-105 active:scale-95 ${
              game.status === 'LIVE' ? 'bg-gradient-to-br ' + game.color + ' shadow-lg cursor-pointer' : 'bg-gray-700 opacity-60 cursor-not-allowed'
            }`}>
            <div className="absolute top-2 right-2">
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${game.status === 'LIVE' ? 'bg-green-400 text-green-900' : 'bg-gray-500 text-gray-300'}`}>{game.status}</span>
            </div>
            <div className="text-4xl mb-3">{game.icon}</div>
            <h3 className="text-white font-bold text-xl mb-1">{game.name}</h3>
            <p className="text-white/90 text-sm line-clamp-2">{game.description}</p>
            {game.status === 'LIVE' && (
              <div className="mt-3 flex items-center text-white/80 text-xs">
                <span>👥 1v1 PvP</span><span className="mx-2">•</span><span>⏱️ 30s</span><span className="mx-2">•</span><span>🪙 Win coins</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-gray-400 text-xs">🎮 All games are free to play • Virtual coins only</p>
      </div>
    </div>
  );
}
