import { useGameStore } from '../lib/store';

export default function VsScreen() {
  const { playerName, opponentName, prize } = useGameStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center animate-[fadeIn_0.3s_ease]">
      <div className="flex items-center gap-4 mb-6">
        {/* You */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-arcane-purple/10 border-2 border-arcane-purple flex items-center justify-center text-3xl font-black text-arcane-purple mx-auto mb-2" style={{ boxShadow: '0 0 20px #7c3aed40' }}>
            {playerName.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm font-bold max-w-[90px] truncate text-arcane-purple">{playerName}</div>
        </div>

        {/* VS */}
        <div className="text-4xl font-black text-gold" style={{ textShadow: '0 0 20px #fbbf2440' }}>VS</div>

        {/* Opponent */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-danger/10 border-2 border-danger flex items-center justify-center text-3xl font-black text-danger mx-auto mb-2" style={{ boxShadow: '0 0 20px #ef444440' }}>
            {opponentName.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm font-bold max-w-[90px] truncate text-danger">{opponentName}</div>
        </div>
      </div>

      <div className="bg-stake-card rounded-xl px-6 py-3 border border-arcane-purple/20">
        <div className="text-stake-gray text-xs uppercase tracking-wider mb-1">Prize Pool</div>
        <div className="text-arcane-purple font-black text-xl">฿{prize}</div>
      </div>
    </div>
  );
}
