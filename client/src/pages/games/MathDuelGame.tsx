import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playCorrect, playWrong, playPerfect, playCombo, playHit } from '../../lib/sounds';

interface Problem { id: number; a: number; b: number; op: string; answer: number; showAt: number; points: number; difficulty: number; }
interface FloatScore { id: number; text: string; color: string; }

const DIFF_LABEL = ['', '🟢 ง่าย', '🟡 กลาง', '🔴 ยาก'];
const DIFF_COLOR = ['', '#4ADE80', '#FFD93D', '#F87171'];

export default function MathDuelGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const pictureUrl = useGameStore((s) => s.pictureUrl);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [inputStr, setInputStr] = useState('');
  const [streak, setStreak] = useState(0);
  const [localScore, setLocalScore] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [problemIdx, setProblemIdx] = useState(0);
  const [solved, setSolved] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const problemsRef = useRef<Problem[]>([]);
  const startRef = useRef(Date.now());
  const floatId = useRef(0);

  useEffect(() => {
    if (gameConfig?.data?.problems) {
      problemsRef.current = gameConfig.data.problems;
    } else {
      const probs: Problem[] = []; let t = 500, id = 0;
      while (t < 30000 - 1000) {
        const p = t / 30000;
        const diff = p < 0.3 ? 1 : p < 0.6 ? 2 : 3;
        let a: number, b: number, op: string, answer: number;
        if (diff === 1) {
          a = 1 + Math.floor(Math.random() * 20); b = 1 + Math.floor(Math.random() * 15);
          if (Math.random() > 0.5) { op = '+'; answer = a + b; } else { op = '-'; if (a < b) [a, b] = [b, a]; answer = a - b; }
        } else if (diff === 2) {
          if (Math.random() > 0.5) { a = 2 + Math.floor(Math.random() * 12); b = 2 + Math.floor(Math.random() * 12); op = '×'; answer = a * b; }
          else { a = 10 + Math.floor(Math.random() * 50); b = 5 + Math.floor(Math.random() * 30); op = '+'; answer = a + b; }
        } else {
          a = 3 + Math.floor(Math.random() * 15); b = 3 + Math.floor(Math.random() * 12); op = '×'; answer = a * b;
        }
        probs.push({ id: id++, a, b, op, answer: answer!, showAt: t, points: diff, difficulty: diff });
        t += 2200 + diff * 300;
      }
      problemsRef.current = probs;
    }
    startRef.current = Date.now();
  }, [gameConfig]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (waiting) return;
      const elapsed = Date.now() - startRef.current;
      const probs = problemsRef.current;
      if (problemIdx < probs.length && elapsed >= probs[problemIdx].showAt && !currentProblem) {
        setCurrentProblem(probs[problemIdx]);
        setInputStr('');
      }
    }, 50);
    return () => clearInterval(iv);
  }, [problemIdx, waiting, currentProblem]);

  const addFloat = (text: string, color: string) => {
    const fid = floatId.current++;
    setFloats(prev => [...prev, { id: fid, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 700);
  };

  // Simple tap handler - works on both mobile and desktop
  const tapKey = useCallback((key: string) => {
    playHit(); // feedback sound
    if (navigator.vibrate) navigator.vibrate(5);

    if (key === 'DEL') {
      setInputStr(prev => prev.slice(0, -1));
      return;
    }
    if (key === 'NEG') {
      setInputStr(prev => prev.startsWith('-') ? prev.slice(1) : '-' + prev);
      return;
    }
    if (key === 'GO') {
      if (!currentProblem || timeLeft <= 0 || inputStr === '' || inputStr === '-') return;
      const numAnswer = parseInt(inputStr);
      if (isNaN(numAnswer)) return;

      const correct = numAnswer === currentProblem.answer;
      if (correct) {
        const ns = streak + 1;
        setStreak(ns);
        const bonus = ns >= 5 ? currentProblem.points + 3 : ns >= 3 ? currentProblem.points + 1 : currentProblem.points;
        setLocalScore(s => s + bonus);
        setSolved(s => s + 1);
        setFlash('correct');
        if (ns >= 5) { playPerfect(); addFloat(`+${bonus} 🔥`, '#FF8C42'); }
        else if (ns >= 3) { playCombo(ns); addFloat(`+${bonus} ✨`, '#A855F7'); }
        else { playCorrect(); addFloat(`+${bonus} ✅`, '#4ADE80'); }
      } else {
        setStreak(0);
        setFlash('wrong');
        playWrong();
        addFloat(`❌ เฉลย: ${currentProblem.answer}`, '#F87171');
      }

      if (matchId) sendGameInput(matchId, 'math_answer', { problemId: currentProblem.id, answer: numAnswer });
      setTimeout(() => setFlash(null), 300);

      setWaiting(true);
      setCurrentProblem(null);
      setInputStr('');
      setTimeout(() => { setProblemIdx(i => i + 1); setWaiting(false); }, 800);
      if (navigator.vibrate) navigator.vibrate(correct ? [10, 5, 10] : [30, 20, 30]);
      return;
    }

    // Add digit
    if (inputStr.replace('-', '').length < 6) {
      setInputStr(prev => prev + key);
    }
  }, [currentProblem, inputStr, streak, matchId, timeLeft]);

  const isUrgent = timeLeft <= 5;
  const displayScore = myScore > 0 ? myScore : localScore;

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คุณ</div>
          <div className="text-2xl font-black text-cute-pink tabular-nums">{displayScore}</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-black tabular-nums ${isUrgent ? 'text-cute-red animate-pulse' : 'text-cute-pink'}`}>{timeLeft.toFixed(1)}s</div>
          <div className="text-[10px] text-cute-gray font-semibold">🔢 Math Duel</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-cute-gray font-semibold">คู่แข่ง</div>
          <div className="text-2xl font-black text-cute-blue tabular-nums">{oppScore}</div>
        </div>
      </div>

      {/* Streak */}
      <div className="text-center h-5 mb-1">
        {streak >= 3 && <span className="text-cute-orange font-black text-xs animate-[bounce-cute_0.5s_ease_infinite]">🔥 Streak x{streak}!</span>}
      </div>

      {/* Problem Display - with Einstein bg */}
      <div className={`rounded-2xl p-4 mb-2 text-center relative overflow-hidden transition-colors ${flash === 'correct' ? 'bg-green-50' : flash === 'wrong' ? 'bg-red-50' : ''}`}
        style={{ backgroundImage: 'url(/bg-math.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60 rounded-2xl" />

        <div className="relative z-10">
          {currentProblem ? (
            <div className="animate-[pop_0.3s_ease]">
              <div className="text-[10px] font-bold mb-1" style={{ color: DIFF_COLOR[currentProblem.difficulty] }}>
                {DIFF_LABEL[currentProblem.difficulty]} · +{currentProblem.points} pts
              </div>
              <div className="text-3xl font-black text-white mb-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                {currentProblem.a} {currentProblem.op} {currentProblem.b} = ?
              </div>
              <div className="inline-block bg-white/90 rounded-2xl px-6 py-2 border-2 border-cute-pink/30 min-w-[100px]">
                <div className="text-2xl font-black text-cute-pink tabular-nums min-h-[36px]">
                  {inputStr || <span className="text-cute-gray/40">_</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-white text-sm py-4 animate-pulse" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {problemIdx === 0 ? '🧠 เตรียมตัว! โจทย์กำลังมา...' : waiting ? '✨ โจทย์ถัดไป...' : '⏳ รอโจทย์...'}
            </div>
          )}
        </div>

        {/* Float scores */}
        {floats.map(f => <div key={f.id} className="score-float z-20" style={{ left: '50%', top: '15%', color: f.color, transform: 'translateX(-50%)' }}>{f.text}</div>)}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-4 mb-1 text-[10px]">
        <span className="text-cute-gray">✅ แก้ได้: <b className="text-cute-dark">{solved}</b></span>
        <span className="text-cute-gray">🔥 Streak: <b className="text-cute-orange">{streak}</b></span>
      </div>

      {/* Number Pad — TOUCH FRIENDLY */}
      <div className="grid grid-cols-3 gap-1.5 flex-1">
        {['1','2','3','4','5','6','7','8','9','NEG','0','DEL'].map(n => (
          <button key={n}
            onClick={() => tapKey(n)}
            className={`cute-btn text-xl font-bold rounded-2xl flex items-center justify-center touch-manipulation ${
              n === 'DEL' ? 'bg-cute-red/10 text-cute-red active:bg-cute-red/20' :
              n === 'NEG' ? 'bg-cute-blue/10 text-cute-blue text-base active:bg-cute-blue/20' :
              'bg-white text-cute-dark border-2 border-cute-border active:bg-cute-pink/10 active:border-cute-pink'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
            {n === 'DEL' ? '⌫' : n === 'NEG' ? '+/-' : n}
          </button>
        ))}
      </div>

      {/* Submit button */}
      <button
        onClick={() => tapKey('GO')}
        className="cute-btn w-full h-14 mt-1.5 bg-cute-pink text-white text-lg font-black shadow-lg shadow-cute-pink/20 active:bg-cute-pink/80 touch-manipulation"
        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
        ✅ ส่งคำตอบ
      </button>

      {pictureUrl && <img src={pictureUrl} alt="" className="fixed bottom-2 right-2 w-10 h-10 rounded-full opacity-30 border-2 border-cute-pink/30 pointer-events-none" />}
    </div>
  );
}
