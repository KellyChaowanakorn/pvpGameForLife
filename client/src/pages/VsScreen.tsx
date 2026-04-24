import { useGameStore } from '../lib/store';

export default function VsScreen() {
  const { playerName, opponentName, prize } = useGameStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center animate-[fadeIn_0.3s_ease] relative -mx-4 -mt-4 px-4 pt-4"
      style={{ backgroundImage: 'url(/bg-main.png)', backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '85vh' }}>

      {/* Overlay */}
      <div className="absolute inset-0" style={{ background: 'rgba(10,10,26,0.8)' }} />

      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-6">
          {/* You */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-arcane-purple mx-auto mb-2" style={{ boxShadow: '0 0 20px #7c3aed40' }}>
              <img src="/char1.png" alt="You" className="w-full h-full object-cover" />
            </div>
            <div className="text-sm font-bold max-w-[90px] truncate text-arcane-purple">{playerName}</div>
          </div>

          {/* VS */}
          <div className="text-4xl font-black text-gold" style={{ textShadow: '0 0 20px #fbbf2440' }}>VS</div>

          {/* Opponent */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-danger mx-auto mb-2" style={{ boxShadow: '0 0 20px #ef444440' }}>
              <img src="/char5.png" alt="Opponent" className="w-full h-full object-cover" />
            </div>
            <div className="text-sm font-bold max-w-[90px] truncate text-danger">{opponentName}</div>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur-sm rounded-xl px-6 py-3 border border-arcane-purple/20">
          <div className="text-stake-gray text-xs uppercase tracking-wider mb-1">Prize Pool</div>
          <div className="text-arcane-purple font-black text-xl">฿{prize}</div>
        </div>
      </div>
    </div>
  );
}
