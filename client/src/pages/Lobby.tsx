import { useGameStore } from '../lib/store';

const GAMES = [
  { id: 'tap_battle', name: 'Tap Speed', icon: '⚡', desc: '3 modes: Target, Combo, Endurance', color: '#00E701', ready: true, hasSubmodes: true },
  { id: 'memory_flip', name: 'Memory Flip', icon: '🧠', desc: 'Match cards faster than opponent', color: '#E056A0', ready: false },
  { id: 'math_duel', name: 'Math Duel', icon: '🔢', desc: 'Solve math problems first', color: '#4FC3F7', ready: false },
  { id: 'aim_click', name: 'Aim Click', icon: '🎯', desc: 'Click targets with precision', color: '#F53B57', ready: false },
  { id: 'puzzle_rush', name: 'Puzzle Rush', icon: '🧩', desc: 'Solve puzzles against the clock', color: '#26C281', ready: false },
  { id: 'strategy_card', name: 'Strategy Card', icon: '⚔️', desc: 'Rock-paper-scissors evolved', color: '#9B59B6', ready: false },
  { id: 'reaction_dodge', name: 'Reaction Dodge', icon: '🏃', desc: 'Dodge obstacles longest wins', color: '#E67E22', ready: false },
];

export default function Lobby() {
  const wallet = useGameStore((s) => s.wallet);
  const online = useGameStore((s) => s.onlineCount);
  const setWallet = useGameStore((s) => s.setWallet);
  const setScreen = useGameStore((s) => s.setScreen);

  const deposit = () => setWallet(wallet + 50);
  const play = (gameId: string) => {
    // Tap Speed has sub-modes → go to mode select
    setScreen('modeSelect');
  };

  return (
    <div className="animate-[fadeIn_0.3s_ease] -mx-4 -mt-4">
      {/* Hero Banner */}
      <div
        className="relative w-full h-52 bg-cover bg-center"
        style={{ backgroundImage: 'url(/bg-arena.png)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-stake-bg via-stake-bg/40 to-transparent" />

        {/* Nav */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-4">
          <div className="text-xl font-black tracking-tight drop-shadow-lg">
            <span className="text-neon">Skill</span> Arena
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/70 bg-black/30 px-2.5 py-1 rounded-full backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-neon animate-pulse" />
            {online} online
          </div>
        </div>

        {/* Tagline */}
        <div className="absolute bottom-4 left-0 right-0 text-center z-10">
          <div className="text-[11px] font-bold uppercase tracking-[4px] text-white/60">
            No luck. Just skill.
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {/* Wallet - floats over banner edge */}
        <div className="bg-stake-card/80 backdrop-blur-sm rounded-xl p-4 mb-4 -mt-6 relative z-20 flex items-center justify-between border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stake-border flex items-center justify-center text-sm">💰</div>
            <div>
              <div className="text-[11px] text-stake-gray uppercase tracking-wider font-semibold">Balance</div>
              <div className="text-xl font-extrabold text-neon tabular-nums">฿{wallet.toFixed(2)}</div>
            </div>
          </div>
          <button
            onClick={deposit}
            className="bg-stake-border text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all active:scale-95 hover:bg-stake-hover"
          >
            + Deposit
          </button>
        </div>

        {/* Games */}
        <div className="text-xs font-bold text-stake-gray uppercase tracking-wider mb-3">Games</div>
        <div className="flex flex-col gap-2">
          {GAMES.map((g) => (
            <button
              key={g.id}
              disabled={!g.ready}
              onClick={() => g.ready && play(g.id)}
              className={`w-full bg-stake-card rounded-xl p-3.5 flex items-center gap-3 text-left transition-all border-[1.5px]
                ${g.ready
                  ? 'border-transparent hover:border-neon hover:bg-stake-hover active:scale-[0.98] cursor-pointer'
                  : 'border-transparent opacity-30 cursor-not-allowed'
                }`}
            >
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: g.color + '18' }}
              >
                {g.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm flex items-center gap-1.5">
                  {g.name}
                  {g.ready ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-neon/15 text-neon uppercase">Live</span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-stake-border text-stake-gray uppercase">Soon</span>
                  )}
                </div>
                <div className="text-stake-gray text-[11px] mt-0.5 truncate">{g.desc}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-neon font-bold text-sm">฿5</div>
                <div className="text-stake-gray2 text-[9px] uppercase">Entry</div>
              </div>
            </button>
          ))}
        </div>

        <div className="text-center text-stake-border text-[10px] mt-6 pb-4">Skill Arena v2.0 · No luck. Just skill.</div>
      </div>
    </div>
  );
}
