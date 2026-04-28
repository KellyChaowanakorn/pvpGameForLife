import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playHit, playCorrect, playWrong, playPerfect, playCombo } from '../../lib/sounds';

const CARD_EMOJIS = ['🐱', '🐶', '🐰', '🦊', '🐼', '🐸', '🦁', '🐧', '🦋', '🌸', '⭐', '🍰'];
const CARD_BACKS = ['#FF6B9D', '#A855F7', '#4FC3F7', '#FFD93D', '#4ADE80', '#FF8C42'];

interface Card { id: number; emoji: string; flipped: boolean; matched: boolean; }
interface FloatScore { id: number; x: number; y: number; text: string; color: string; }

export default function MemoryFlipGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const pictureUrl = useGameStore((s) => s.pictureUrl);
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [localScore, setLocalScore] = useState(0);
  const [pairs, setPairs] = useState(0);
  const [combo, setCombo] = useState(0);
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [canFlip, setCanFlip] = useState(true);
  const floatId = useRef(0);
  const totalPairs = 8;

  // Initialize board
  useEffect(() => {
    const seed = gameConfig?.seed || Date.now();
    const rng = seededRandom(seed);

    // Pick 8 random emojis, duplicate, shuffle
    const picked = [...CARD_EMOJIS].sort(() => rng() - 0.5).slice(0, totalPairs);
    const deck = [...picked, ...picked];
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    setCards(deck.map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false })));
  }, [gameConfig]);

  const addFloat = (x: number, y: number, text: string, color: string) => {
    const fid = floatId.current++;
    setFloats(prev => [...prev, { id: fid, x, y, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 600);
  };

  const handleCardClick = useCallback((cardId: number) => {
    if (!canFlip || timeLeft <= 0) return;
    const card = cards[cardId];
    if (!card || card.flipped || card.matched) return;
    if (flipped.length >= 2) return;

    playHit();
    if (navigator.vibrate) navigator.vibrate(10);

    const newFlipped = [...flipped, cardId];
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, flipped: true } : c));
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setCanFlip(false);
      const [first, second] = newFlipped;
      const c1 = cards[first], c2 = cards[second];

      if (c1.emoji === c2.emoji) {
        // MATCH!
        const newCombo = combo + 1;
        setCombo(newCombo);
        const points = newCombo >= 3 ? 5 : newCombo >= 2 ? 3 : 2;

        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === first || c.id === second ? { ...c, matched: true } : c
          ));
          setFlipped([]);
          setCanFlip(true);
          setLocalScore(s => s + points);
          setPairs(p => p + 1);

          if (newCombo >= 3) { playPerfect(); addFloat(50, 50, `+${points} 🔥`, '#FF8C42'); }
          else { playCorrect(); addFloat(50, 50, `+${points} ✨`, '#4ADE80'); }

          if (matchId) sendGameInput(matchId, 'memory_match', { card1: first, card2: second, combo: newCombo });
        }, 300);
      } else {
        // NO MATCH
        setCombo(0);
        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === first || c.id === second ? { ...c, flipped: false } : c
          ));
          setFlipped([]);
          setCanFlip(true);
          playWrong();
        }, 600);
      }
    }
  }, [cards, flipped, canFlip, combo, matchId, timeLeft]);

  const isUrgent = timeLeft <= 5;
  const displayScore = myScore > 0 ? myScore : localScore;
  const allMatched = pairs >= totalPairs;

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คุณ</div>
          <div className="text-2xl font-black text-cute-pink tabular-nums">{displayScore}</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-black tabular-nums ${isUrgent ? 'text-cute-red animate-pulse' : 'text-cute-pink'}`}>
            {timeLeft.toFixed(1)}s
          </div>
          <div className="text-[10px] text-cute-gray font-semibold">🧠 Memory Flip</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คู่แข่ง</div>
          <div className="text-2xl font-black text-cute-blue tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Combo */}
      <div className="text-center mb-1 h-6">
        {combo >= 2 && <span className="text-cute-orange font-black text-sm animate-[bounce-cute_0.5s_ease_infinite]">🔥 Combo x{combo}!</span>}
      </div>

      {/* Pairs progress */}
      <div className="flex items-center gap-2 px-2 mb-2">
        <div className="flex-1 h-2 bg-cute-border rounded-full overflow-hidden">
          <div className="h-full bg-cute-pink rounded-full transition-all" style={{ width: `${(pairs / totalPairs) * 100}%` }} />
        </div>
        <span className="text-xs font-bold text-cute-dark">{pairs}/{totalPairs}</span>
      </div>

      {/* Game Board */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-4 gap-2 w-full max-w-[320px]">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              disabled={card.flipped || card.matched || !canFlip || timeLeft <= 0}
              className="aspect-square rounded-2xl text-2xl font-black transition-all relative overflow-hidden"
              style={{
                background: card.flipped || card.matched
                  ? 'white'
                  : `linear-gradient(135deg, ${CARD_BACKS[card.id % CARD_BACKS.length]}, ${CARD_BACKS[(card.id + 3) % CARD_BACKS.length]})`,
                border: card.matched ? '3px solid #4ADE80' : card.flipped ? '3px solid #FF6B9D' : '3px solid transparent',
                boxShadow: card.matched
                  ? '0 4px 15px rgba(74,222,128,0.3)'
                  : card.flipped
                    ? '0 4px 15px rgba(255,107,157,0.3)'
                    : '0 4px 12px rgba(61,41,20,0.08)',
                transform: card.flipped || card.matched ? 'rotateY(0deg)' : 'rotateY(0deg)',
                opacity: card.matched ? 0.6 : 1,
              }}
            >
              {/* Card face */}
              {(card.flipped || card.matched) ? (
                <span className="animate-[pop_0.3s_ease]">{card.emoji}</span>
              ) : (
                <span className="text-white/60 text-lg">?</span>
              )}

              {/* Matched sparkle */}
              {card.matched && (
                <div className="absolute top-0 right-0 text-xs animate-[sparkle_1s_ease_infinite]">✨</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Float scores */}
      {floats.map(f => (
        <div key={f.id} className="score-float" style={{ left: `${f.x}%`, top: `${f.y}%`, color: f.color }}>{f.text}</div>
      ))}

      {/* All matched celebration */}
      {allMatched && <div className="text-center text-cute-pink font-black text-lg animate-[bounce-cute_0.5s_ease_infinite] mb-2">🎉 ครบทุกคู่แล้ว!</div>}

      {/* Profile */}
      {pictureUrl && <img src={pictureUrl} alt="" className="absolute bottom-2 right-2 w-10 h-10 rounded-full opacity-40 border-2 border-cute-pink/30" />}

      {/* Instruction */}
      {pairs === 0 && timeLeft > 28 && (
        <div className="text-center mt-2">
          <div className="inline-block cute-card px-4 py-2 text-[11px] text-cute-gray">
            🧠 กดการ์ดเปิดดู จำแล้วจับคู่ให้ไว! Combo = คะแนน x5!
          </div>
        </div>
      )}
    </div>
  );
}

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
