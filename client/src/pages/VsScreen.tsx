import { useGameStore } from '../lib/store';

export default function VsScreen() {
  const { playerName, opponentName, prize } = useGameStore();
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center animate-[fadeIn_0.3s_ease]">
      <div className="flex items-center gap-3 mb-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-cute-pink/10 border-3 border-cute-pink flex items-center justify-center text-3xl font-black text-cute-pink mx-auto mb-2 shadow-lg shadow-cute-pink/20" style={{borderWidth:'3px'}}>
            {playerName.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm font-bold text-cute-dark max-w-[90px] truncate">{playerName}</div>
        </div>
        <div className="text-3xl font-black text-cute-gold animate-[bounce-cute_1s_ease_infinite]">⚔️</div>
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-cute-blue/10 border-3 border-cute-blue flex items-center justify-center text-3xl font-black text-cute-blue mx-auto mb-2 shadow-lg shadow-cute-blue/20" style={{borderWidth:'3px'}}>
            {opponentName.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm font-bold text-cute-dark max-w-[90px] truncate">{opponentName}</div>
        </div>
      </div>
      <div className="cute-card px-6 py-3">
        <div className="text-cute-gray text-xs mb-1">🏆 รางวัล</div>
        <div className="text-cute-pink font-black text-xl">฿{prize}</div>
      </div>
    </div>
  );
}
