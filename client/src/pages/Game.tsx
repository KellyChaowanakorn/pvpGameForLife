import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../lib/store';
import ArcherBattleGame from './games/ArcherBattleGame';
import PuzzleRushGame from './games/PuzzleRushGame';
import CardClashGame from './games/CardClashGame';
import DodgeDuelGame from './games/DodgeDuelGame';

function ComingSoon({ name }: { name: string }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-blue-900 flex flex-col items-center justify-center p-4">
      <div className="text-6xl mb-4">🚧</div>
      <h2 className="text-2xl font-bold text-white mb-2">{name}</h2>
      <p className="text-gray-300 mb-6">Coming Soon!</p>
      <button onClick={() => navigate('/lobby')} className="bg-purple-600 text-white font-bold py-3 px-8 rounded-xl active:scale-95">Back to Lobby</button>
    </div>
  );
}

export default function Game() {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const setInGame = useGameStore((s) => s.setInGame);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mode) { navigate('/lobby'); return; }
    const validModes = ['archer_battle', 'memory_match', 'speed_quiz', 'puzzle_rush', 'card_clash', 'dodge_duel', 'slot_machine'];
    if (!validModes.includes(mode)) { navigate('/lobby'); return; }
    setInGame(true);
    setLoading(false);
    return () => { setInGame(false); };
  }, [mode, navigate, setInGame]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading game...</div>
      </div>
    );
  }

  switch (mode) {
    case 'archer_battle': return <ArcherBattleGame />;
    case 'puzzle_rush': return <PuzzleRushGame />;
    case 'card_clash': return <CardClashGame />;
    case 'dodge_duel': return <DodgeDuelGame />;
    case 'memory_match': return <ComingSoon name="Memory Match" />;
    case 'speed_quiz': return <ComingSoon name="Speed Quiz" />;
    case 'slot_machine': return <ComingSoon name="Slot Machine" />;
    default: return <ComingSoon name="Unknown Game" />;
  }
}
