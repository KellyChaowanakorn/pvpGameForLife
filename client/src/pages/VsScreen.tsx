import { useGameStore } from '../lib/store';

export default function VsScreen() {
  const { playerName, opponentName, prize } = useGameStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center animate-[fadeIn_0.3s_ease]">
      <div className="flex items-center gap-4 mb-5">
        {/* You */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-neon/10 border-2 border-neon flex items-center justify-center text-2xl font-black text-neon mx-auto mb-2">
            {playerName.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm font-semibold max-w-[90px] truncate">{playerName}</div>
        </div>

        {/* VS */}
        <div className="text-3xl font-black text-gold">VS</div>

        {/* Opponent */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-danger/10 border-2 border-danger flex items-center justify-center text-2xl font-black text-danger mx-auto mb-2">
            {opponentName.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm font-semibold max-w-[90px] truncate">{opponentName}</div>
        </div>
      </div>

      <div className="text-stake-gray text-sm">
        Prize: <span className="text-neon font-bold">฿{prize}</span>
      </div>
    </div>
  );
}
