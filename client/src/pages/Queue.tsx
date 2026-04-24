import { useEffect, useState } from 'react';
import { cancelQueue } from '../lib/socket';

export default function Queue() {
  const [dots, setDots] = useState('●●●');

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % 4;
      setDots('●'.repeat(i + 1) + '○'.repeat(3 - i));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center animate-[fadeIn_0.3s_ease]">
      <div className="w-12 h-12 border-3 border-stake-border border-t-neon rounded-full animate-spin mb-5" style={{ borderWidth: '3px' }} />
      <div className="text-lg font-bold mb-1">Finding opponent</div>
      <div className="text-stake-gray text-sm mb-1">Matching you with a player...</div>
      <div className="text-arcane-purple text-sm font-semibold">{dots}</div>
      <button
        onClick={cancelQueue}
        className="mt-6 bg-stake-hover border border-stake-border text-stake-gray px-8 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95"
      >
        Cancel
      </button>
    </div>
  );
}
