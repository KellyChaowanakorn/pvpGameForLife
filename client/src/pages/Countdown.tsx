import { useGameStore } from '../lib/store';

export default function Countdown() {
  const num = useGameStore((s) => s.countdownNum);

  return (
    <div className="flex items-center justify-center min-h-[75vh]">
      <div
        key={num}
        className="text-8xl font-black text-neon animate-[pop_0.4s_ease]"
        style={{ animationName: 'pop' }}
      >
        {num}
      </div>
    </div>
  );
}
