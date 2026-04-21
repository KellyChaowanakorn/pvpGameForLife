import { useGameStore } from '../lib/store';

const MODE_TIPS: Record<string, { icon: string; name: string; tip: string }> = {
  target_tap: { icon: '🎯', name: 'Target Tap', tip: 'กดเป้าที่ปรากฏ เป้าเล็ก = คะแนนเยอะ!' },
  combo_tap: { icon: '🔥', name: 'Combo Tap', tip: 'ดูสีตรงกลาง กดปุ่มสีให้ตรง!' },
  endurance: { icon: '💎', name: 'Endurance', tip: 'วงวิ่งเข้ามา กดตอนชิดวงใหญ่!' },
};

export default function Countdown() {
  const num = useGameStore((s) => s.countdownNum);
  const gameMode = useGameStore((s) => s.gameMode);
  const tip = MODE_TIPS[gameMode] || MODE_TIPS['target_tap'];

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] gap-6">
      <div
        key={num}
        className="text-8xl font-black text-neon animate-[pop_0.4s_ease]"
      >
        {num}
      </div>

      {/* Mode tip during countdown */}
      <div className="bg-stake-card rounded-2xl px-5 py-3 text-center max-w-[300px] border border-stake-border">
        <div className="text-lg mb-1">{tip.icon}</div>
        <div className="text-white font-bold text-sm mb-1">{tip.name}</div>
        <div className="text-stake-gray text-xs">{tip.tip}</div>
      </div>
    </div>
  );
}
