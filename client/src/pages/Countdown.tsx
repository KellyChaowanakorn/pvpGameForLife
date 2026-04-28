import { useGameStore } from '../lib/store';

const TIPS: Record<string, { emoji: string; name: string; tip: string }> = {
  target_tap: { emoji: '🎯', name: 'Target Tap', tip: 'กดเป้าให้เร็ว! เป้าเล็ก = คะแนนเยอะ!' },
  combo_tap: { emoji: '🔥', name: 'Combo Tap', tip: 'ดูสีตรงกลาง กดปุ่มสีให้ตรง!' },
  endurance: { emoji: '💎', name: 'Endurance', tip: 'กดตอนวงชิดกัน! BPM เร็วขึ้นเรื่อยๆ' },
  memory_flip: { emoji: '🧠', name: 'Memory Flip', tip: 'จำตำแหน่งการ์ด เปิดจับคู่ให้เร็ว!' },
};

export default function Countdown() {
  const num = useGameStore((s) => s.countdownNum);
  const mode = useGameStore((s) => s.gameMode);
  const tip = TIPS[mode] || TIPS['target_tap'];

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] gap-6">
      <div key={num} className="text-8xl font-black text-cute-pink animate-[pop_0.4s_ease]" style={{ textShadow: '0 4px 20px rgba(255,107,157,0.3)' }}>
        {num}
      </div>
      <div className="cute-card px-5 py-3 text-center max-w-[300px]">
        <div className="text-2xl mb-1">{tip.emoji}</div>
        <div className="font-bold text-sm text-cute-dark mb-1">{tip.name}</div>
        <div className="text-cute-gray text-xs">{tip.tip}</div>
      </div>
    </div>
  );
}
