import { useEffect, useState } from 'react';
import { cancelQueue } from '../lib/socket';

export default function Queue() {
  const [dots, setDots] = useState('🔍');
  useEffect(() => {
    let i = 0;
    const emojis = ['🔍', '🔎', '👀', '✨'];
    const iv = setInterval(() => { i = (i + 1) % emojis.length; setDots(emojis[i]); }, 500);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center animate-[fadeIn_0.3s_ease]">
      <div className="text-5xl mb-4 animate-[bounce-cute_1s_ease_infinite]">{dots}</div>
      <div className="text-lg font-bold text-cute-dark mb-1">กำลังหาคู่แข่ง...</div>
      <div className="text-cute-gray text-sm mb-6">รอแป๊บนะ กำลังจับคู่ให้!</div>
      <button onClick={cancelQueue}
        className="cute-btn bg-white text-cute-gray border-2 border-cute-border px-8 py-2.5 text-sm">
        ยกเลิก
      </button>
    </div>
  );
}
