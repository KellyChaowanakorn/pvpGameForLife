import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../lib/store';

export default function ModeSelect() {
  const navigate = useNavigate();
  const setCurrentMode = useGameStore((s) => s.setCurrentMode);

  const modes = [
    { id: 'archer_battle', name: 'Archer Battle', description: 'Aim and shoot arrows to defeat your opponent!', icon: '🏹', color: 'from-red-500 to-orange-500', instructions: 'Swipe to aim, release to shoot. Hit the enemy before they hit you!' },
    { id: 'memory_match', name: 'Memory Match', description: 'Find matching pairs faster than your opponent!', icon: '🧠', color: 'from-blue-500 to-purple-500', instructions: 'Tap cards to flip them. Match pairs to score points. Most matches wins!' },
    { id: 'speed_quiz', name: 'Speed Quiz', description: 'Answer questions quickly to beat your opponent!', icon: '⚡', color: 'from-yellow-500 to-red-500', instructions: 'Read the question and tap the correct answer. Speed matters!' },
    { id: 'puzzle_rush', name: 'Puzzle Rush', description: 'Solve quick puzzles in a 30-second race!', icon: '🧩', color: 'from-green-400 to-cyan-500', instructions: 'Tap numbers in order, match colors, find missing tiles. Fastest solver wins!' },
    { id: 'card_clash', name: 'Card Clash', description: 'Strategic card duels with Attack, Block, and Trick!', icon: '⚔️', color: 'from-purple-600 to-pink-600', instructions: 'Attack beats Trick, Trick beats Block, Block beats Attack. Win 6 rounds!' },
    { id: 'dodge_duel', name: 'Dodge Duel', description: 'Dodge obstacles and collect coins in 3 lanes!', icon: '🏃', color: 'from-indigo-500 to-purple-600', instructions: 'Tap left/right buttons to switch lanes. Avoid obstacles, collect coins!' },
    { id: 'slot_machine', name: 'Slot Machine', description: 'Spin the reels and match symbols for rewards!', icon: '🎰', color: 'from-yellow-400 to-orange-500', instructions: 'Tap to spin. Match 3 symbols to win big! Pure luck and fun!' },
  ];

  const handleSelect = (modeId: string) => {
    setCurrentMode(modeId as any);
    navigate(`/game/${modeId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-blue-900 p-4">
      <h2 className="text-2xl font-bold text-white text-center mb-6">Select Game Mode</h2>
      <div className="space-y-4">
        {modes.map((mode) => (
          <button key={mode.id} onClick={() => handleSelect(mode.id)}
            className={`w-full bg-gradient-to-r ${mode.color} rounded-xl p-4 text-left text-white shadow-lg transform transition-all hover:scale-105 active:scale-95`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{mode.icon}</span>
              <div className="flex-1">
                <h3 className="font-bold text-lg">{mode.name}</h3>
                <p className="text-sm opacity-90">{mode.description}</p>
                <p className="text-xs opacity-75 mt-1">{mode.instructions}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={() => navigate('/lobby')} className="mt-6 w-full bg-gray-700 text-white py-3 rounded-xl font-semibold">Back to Lobby</button>
    </div>
  );
}
