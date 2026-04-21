import { useGameStore, GameMode } from '../lib/store';
import { findMatch } from '../lib/socket';

const MODES = [
  {
    id: 'target_tap' as GameMode,
    name: 'Target Tap',
    icon: '🎯',
    desc: 'กดเป้าที่สุ่มขึ้นให้ตรงจุด!',
    detail: 'เป้ายิ่งเล็ก = ยิ่งได้คะแนนเยอะ (1-3 แต้ม)',
    how: '👆 กดเป้าที่ปรากฏบนจอให้เร็วที่สุด',
    color: '#FF6B6B',
    gradient: 'from-red-500/20 to-orange-500/20',
  },
  {
    id: 'combo_tap' as GameMode,
    name: 'Combo Tap',
    icon: '🔥',
    desc: 'สีขึ้นมา กดปุ่มสีให้ตรง!',
    detail: 'Combo ยิ่งยาว = คะแนน x5 · กดผิด = combo หัก',
    how: '🎨 ดูสีที่ขึ้น แล้วกดปุ่มสีข้างล่างให้ตรง',
    color: '#FFD93D',
    gradient: 'from-yellow-500/20 to-amber-500/20',
  },
  {
    id: 'endurance' as GameMode,
    name: 'Endurance',
    icon: '💎',
    desc: 'กดจังหวะให้ตรงวง!',
    detail: 'Perfect = 3 แต้ม · Good = 1 · Miss = -1',
    how: '⭕ รอวงเล็กขยายมาชิดวงใหญ่ แล้วกด!',
    color: '#6BCB77',
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
];

export default function ModeSelect() {
  const setScreen = useGameStore((s) => s.setScreen);
  const setGameMode = useGameStore((s) => s.setGameMode);

  const select = (mode: GameMode) => {
    setGameMode(mode);
    findMatch(mode);
  };

  return (
    <div className="animate-[fadeIn_0.3s_ease]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setScreen('lobby')} className="text-stake-gray hover:text-white text-xl">←</button>
        <div>
          <div className="text-lg font-bold">⚡ Tap Speed Battle</div>
          <div className="text-stake-gray text-xs">เลือก Mode</div>
        </div>
      </div>

      {/* Mode Cards */}
      <div className="flex flex-col gap-3">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => select(mode.id)}
            className="w-full text-left bg-stake-card rounded-2xl p-5 border-[1.5px] border-transparent hover:border-neon transition-all active:scale-[0.98] group relative overflow-hidden"
          >
            {/* Glow effect on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />

            <div className="relative flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: mode.color + '20' }}
              >
                {mode.icon}
              </div>
              <div className="flex-1">
                <div className="font-bold text-base mb-1">{mode.name}</div>
                <div className="text-white/80 text-sm mb-1">{mode.desc}</div>
                <div className="text-stake-gray text-xs mb-1">{mode.detail}</div>
                <div className="text-neon/80 text-[11px] font-medium">{mode.how}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-neon font-bold text-sm">฿5</div>
                <div className="text-stake-gray2 text-[9px] uppercase">Entry</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Timer info */}
      <div className="text-center text-stake-gray text-xs mt-6">
        ⏱ ทุก mode เล่น 10 วินาที · ใครคะแนนสูงกว่าชนะ
      </div>
    </div>
  );
}
