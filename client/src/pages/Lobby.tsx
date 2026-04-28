import { useGameStore } from '../lib/store';

const GAMES = [
  { id: 'tap_battle', name: '⚡ Tap Speed', desc: '3 โหมด: Target, Combo, Endurance', color: '#FF6B9D', emoji: '⚡', ready: true },
  { id: 'memory_flip', name: '🧠 Memory Flip', desc: 'เปิดการ์ดจับคู่แข่งกัน', color: '#A855F7', emoji: '🧠', ready: true },
  { id: 'math_duel', name: '🔢 Math Duel', desc: 'โจทย์คณิตศาสตร์ ใครตอบก่อนชนะ', color: '#4FC3F7', emoji: '🔢', ready: true },
  { id: 'aim_click', name: '🎯 Aim Click', desc: 'คลิกเป้าให้แม่นที่สุด', color: '#FF8C42', emoji: '🎯', ready: true },
  { id: 'puzzle_rush', name: '🧩 Puzzle Rush', desc: 'แก้ puzzle แข่งเวลา', color: '#4ADE80', emoji: '🧩', ready: false },
  { id: 'strategy_card', name: '⚔️ Strategy Card', desc: 'เลือกการ์ดสู้กัน', color: '#F87171', emoji: '⚔️', ready: false },
  { id: 'reaction_dodge', name: '🏃 Reaction Dodge', desc: 'หลบ obstacle ใครอยู่นานกว่าชนะ', color: '#FFD93D', emoji: '🏃', ready: false },
];

export default function Lobby() {
  const wallet = useGameStore((s) => s.wallet);
  const online = useGameStore((s) => s.onlineCount);
  const setScreen = useGameStore((s) => s.setScreen);
  const setGameMode = useGameStore((s) => s.setGameMode);

  return (
    <div className="animate-[fadeIn_0.3s_ease]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-2xl font-black">
            <span className="text-cute-pink">Skill</span> Arena ✨
          </div>
          <div className="text-cute-gray text-xs">No luck. Just skill!</div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-cute-gray bg-white px-3 py-1.5 rounded-full border border-cute-border">
          <div className="w-2 h-2 rounded-full bg-cute-mint animate-pulse" />
          {online} online
        </div>
      </div>

      {/* Wallet Card */}
      <div className="cute-card p-4 mb-5 flex items-center justify-between" style={{ animation: 'glow-cute 3s ease infinite' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cute-gold/20 flex items-center justify-center text-lg">💰</div>
          <div>
            <div className="text-[11px] text-cute-gray font-semibold">กระเป๋าเงิน</div>
            <div className="text-2xl font-black text-cute-pink tabular-nums">฿{wallet.toFixed(2)}</div>
          </div>
        </div>
        <button onClick={() => setScreen('wallet')}
          className="cute-btn bg-cute-pink text-white px-5 py-2.5 text-sm shadow-lg shadow-cute-pink/20">
          💰 Wallet
        </button>
      </div>

      {/* Games */}
      <div className="text-sm font-bold text-cute-dark mb-3 flex items-center gap-2">🎮 เลือกเกม</div>
      <div className="flex flex-col gap-2.5">
        {GAMES.map((g) => (
          <button key={g.id} disabled={!g.ready}
            onClick={() => {
              if (g.id === 'tap_battle') setScreen('modeSelect');
              else if (g.ready) { setGameMode(g.id as any); setScreen('modeSelect'); }
            }}
            className={`cute-card p-4 flex items-center gap-3 text-left transition-all
              ${g.ready ? 'hover:border-cute-pink active:scale-[0.98]' : 'opacity-40 cursor-not-allowed'}`}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: g.color + '18' }}>
              {g.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm flex items-center gap-1.5 text-cute-dark">
                {g.name}
                {g.ready
                  ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cute-mint/20 text-cute-mint">LIVE</span>
                  : <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-cute-gray">SOON</span>}
              </div>
              <div className="text-cute-gray text-[11px] mt-0.5">{g.desc}</div>
            </div>
            <div className="text-right">
              <div className="text-cute-pink font-bold text-sm">฿5</div>
              <div className="text-cute-gray text-[9px]">entry</div>
            </div>
          </button>
        ))}
      </div>

      <div className="text-center text-cute-gray/50 text-[10px] mt-6 pb-4">Skill Arena v3.0 ✨ Cute Edition</div>
    </div>
  );
}
