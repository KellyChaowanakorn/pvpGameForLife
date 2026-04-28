import { useGameStore, GameMode } from '../lib/store';
import { findMatch } from '../lib/socket';

const TAP_MODES = [
  { id: 'target_tap' as GameMode, name: 'Target Tap', emoji: '🎯', desc: 'เป้าสุ่มขึ้น กดให้ตรง!', detail: '⭐ทอง +5 · 💀บอส +10 (กด 3 ครั้ง)', color: '#FF6B9D' },
  { id: 'combo_tap' as GameMode, name: 'Combo Tap', emoji: '🔥', desc: 'กดสีให้ตรง สร้าง combo!', detail: 'Combo 10+ = 🔥 Fire Mode! · 🌈 Rainbow = +10', color: '#FFD93D' },
  { id: 'endurance' as GameMode, name: 'Endurance', emoji: '💎', desc: 'กดจังหวะให้ตรงวง!', detail: 'Perfect +3 · ☠️ Danger +8 · BPM เร็วขึ้น', color: '#4FC3F7' },
];

const OTHER_GAMES: Record<string, { name: string; emoji: string; desc: string; color: string }> = {
  memory_flip: { name: 'Memory Flip', emoji: '🧠', desc: 'เปิดการ์ดจับคู่ ใครจับคู่ได้เร็วกว่าชนะ!', color: '#A855F7' },
};

export default function ModeSelect() {
  const { setScreen, setGameMode, gameMode } = useGameStore();

  const select = (mode: GameMode) => { setGameMode(mode); findMatch(mode); };

  // Check if coming from a non-tap game
  const otherGame = OTHER_GAMES[gameMode];
  if (otherGame) {
    return (
      <div className="animate-[fadeIn_0.3s_ease]">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setScreen('lobby')} className="text-cute-gray hover:text-cute-dark text-xl">←</button>
          <div className="text-lg font-bold text-cute-dark">{otherGame.emoji} {otherGame.name}</div>
        </div>
        <div className="cute-card p-6 text-center mb-4">
          <div className="text-6xl mb-3">{otherGame.emoji}</div>
          <div className="text-xl font-black text-cute-dark mb-2">{otherGame.name}</div>
          <div className="text-cute-gray text-sm mb-4">{otherGame.desc}</div>
          <div className="cute-card p-3 mb-4 bg-cute-soft">
            <div className="text-xs text-cute-dark font-semibold">📌 วิธีเล่น</div>
            <div className="text-[11px] text-cute-gray mt-1">จำตำแหน่งการ์ด → เปิดจับคู่ให้เร็วที่สุด → ใครจับคู่ครบก่อนชนะ!</div>
          </div>
          <button onClick={() => select(gameMode)}
            className="cute-btn w-full py-4 text-white font-bold text-base shadow-lg" style={{ background: otherGame.color, boxShadow: `0 8px 20px ${otherGame.color}40` }}>
            🎮 เริ่มเล่น! (฿5)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease]">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setScreen('lobby')} className="text-cute-gray hover:text-cute-dark text-xl">←</button>
        <div>
          <div className="text-lg font-bold text-cute-dark">⚡ Tap Speed Battle</div>
          <div className="text-cute-gray text-xs">เลือก Mode</div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {TAP_MODES.map((mode) => (
          <button key={mode.id} onClick={() => select(mode.id)}
            className="cute-card p-5 text-left transition-all hover:border-cute-pink active:scale-[0.98] relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: mode.color + '18' }}>
                {mode.emoji}
              </div>
              <div className="flex-1">
                <div className="font-bold text-base text-cute-dark mb-1">{mode.name}</div>
                <div className="text-cute-dark/70 text-sm mb-1">{mode.desc}</div>
                <div className="text-cute-gray text-xs">{mode.detail}</div>
              </div>
              <div className="text-right">
                <div className="text-cute-pink font-bold text-sm">฿5</div>
                <div className="text-cute-gray text-[9px]">entry</div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="text-center text-cute-gray text-xs mt-6">⏱ ทุก mode เล่น 30 วินาที · ใครคะแนนสูงกว่าชนะ</div>
    </div>
  );
}
