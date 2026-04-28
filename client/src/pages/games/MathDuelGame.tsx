import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../lib/store';
import { sendGameInput } from '../../lib/socket';
import { playCorrect, playWrong, playPerfect, playCombo } from '../../lib/sounds';

interface Problem { id: number; a: number; b: number; op: string; answer: number; showAt: number; points: number; difficulty: number; }
interface FloatScore { id: number; text: string; color: string; }

const DIFF_LABEL = ['', '🟢 Easy', '🟡 Medium', '🔴 Hard'];
const DIFF_COLOR = ['', '#4ADE80', '#FFD93D', '#F87171'];

export default function MathDuelGame() {
  const { matchId, myScore, oppScore, timeLeft, gameConfig } = useGameStore();
  const pictureUrl = useGameStore((s) => s.pictureUrl);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [streak, setStreak] = useState(0);
  const [localScore, setLocalScore] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [problemIdx, setProblemIdx] = useState(0);
  const [solved, setSolved] = useState(0);
  const problemsRef = useRef<Problem[]>([]);
  const startRef = useRef(Date.now());
  const floatId = useRef(0);

  useEffect(() => {
    if (gameConfig?.data?.problems) problemsRef.current = gameConfig.data.problems;
    else {
      const probs: Problem[] = []; let t = 500, id = 0;
      while (t < 30000 - 1000) {
        const p = t / 30000;
        const diff = p < 0.3 ? 1 : p < 0.6 ? 2 : 3;
        let a = Math.floor(Math.random() * 20) + 1, b = Math.floor(Math.random() * 15) + 1;
        const ops = ['+', '-', '×'];
        const op = ops[Math.floor(Math.random() * (diff === 1 ? 2 : 3))];
        let answer: number;
        if (op === '+') answer = a + b;
        else if (op === '-') { if (a < b) [a, b] = [b, a]; answer = a - b; }
        else { a = Math.floor(Math.random() * 12) + 2; b = Math.floor(Math.random() * 12) + 2; answer = a * b; }
        probs.push({ id: id++, a, b, op, answer: answer!, showAt: t, points: diff, difficulty: diff });
        t += 2500 + diff * 500;
      }
      problemsRef.current = probs;
    }
    startRef.current = Date.now();
  }, [gameConfig]);

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const probs = problemsRef.current;
      if (problemIdx < probs.length && elapsed >= probs[problemIdx].showAt) {
        setCurrentProblem(probs[problemIdx]);
        setInputVal('');
      }
    }, 50);
    return () => clearInterval(iv);
  }, [problemIdx]);

  const addFloat = (text: string, color: string) => {
    const fid = floatId.current++;
    setFloats(prev => [...prev, { id: fid, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 700);
  };

  const submitAnswer = useCallback(() => {
    if (!currentProblem || timeLeft <= 0 || inputVal === '') return;
    const answer = parseInt(inputVal);
    if (isNaN(answer)) return;
    const correct = answer === currentProblem.answer;

    if (correct) {
      const ns = streak + 1;
      setStreak(ns);
      const bonus = ns >= 5 ? currentProblem.points + 3 : ns >= 3 ? currentProblem.points + 1 : currentProblem.points;
      setLocalScore(s => s + bonus);
      setSolved(s => s + 1);
      setFlash('correct');
      if (ns >= 5) { playPerfect(); addFloat(`+${bonus} 🔥`, '#FF8C42'); }
      else if (ns >= 3) { playCombo(ns); addFloat(`+${bonus} ✨`, '#A855F7'); }
      else { playCorrect(); addFloat(`+${bonus}`, '#4ADE80'); }
    } else {
      setStreak(0);
      setFlash('wrong');
      playWrong();
      addFloat('-1 ❌', '#F87171');
    }

    if (matchId) sendGameInput(matchId, 'math_answer', { problemId: currentProblem.id, answer });
    setTimeout(() => setFlash(null), 200);
    setProblemIdx(i => i + 1);
    setCurrentProblem(null);
    setInputVal('');
  }, [currentProblem, inputVal, streak, matchId, timeLeft]);

  const numPad = (n: string) => {
    if (n === 'DEL') setInputVal(v => v.slice(0, -1));
    else if (n === 'GO') submitAnswer();
    else if (n === '-') setInputVal(v => v.startsWith('-') ? v.slice(1) : '-' + v);
    else setInputVal(v => v.length < 6 ? v + n : v);
  };

  const isUrgent = timeLeft <= 5;
  const displayScore = myScore > 0 ? myScore : localScore;

  return (
    <div className="flex flex-col h-[85vh] animate-[fadeIn_0.3s_ease] select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1 mb-2">
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
      <div className="text-center h-6 mb-1">
        {streak >= 3 && <span className="text-cute-orange font-black text-sm animate-[bounce-cute_0.5s_ease_infinite]">🔥 Streak x{streak}!</span>}
      </div>

      {/* Problem Display */}
      <div className={`cute-card p-6 mb-3 text-center relative overflow-hidden ${flash === 'correct' ? 'bg-cute-mint/10' : flash === 'wrong' ? 'bg-cute-red/10' : ''}`}>
        {currentProblem ? (
          <div className="animate-[pop_0.3s_ease]">
            <div className="text-[10px] font-bold mb-1" style={{ color: DIFF_COLOR[currentProblem.difficulty] }}>
              {DIFF_LABEL[currentProblem.difficulty]} · +{currentProblem.points} pts
            </div>
            <div className="text-4xl font-black text-cute-dark mb-3">
              {currentProblem.a} {currentProblem.op} {currentProblem.b} = ?
            </div>
            {/* Answer display */}
            <div className="inline-block bg-cute-bg rounded-2xl px-8 py-3 border-2 border-cute-pink/30 min-w-[120px]">
              <div className="text-3xl font-black text-cute-pink tabular-nums">{inputVal || '_'}</div>
            </div>
          </div>
        ) : (
          <div className="text-cute-gray text-sm py-6 animate-pulse">
            {problemIdx === 0 ? '🧠 เตรียมตัว! โจทย์กำลังมา...' : '⏳ โจทย์ถัดไป...'}
          </div>
        )}

        {/* Float scores */}
        {floats.map(f => <div key={f.id} className="score-float" style={{ left: '50%', top: '20%', color: f.color, transform: 'translateX(-50%)' }}>{f.text}</div>)}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-4 mb-2 text-xs">
        <span className="text-cute-gray">✅ แก้ได้: <b className="text-cute-dark">{solved}</b></span>
        <span className="text-cute-gray">📊 คะแนน: <b className="text-cute-pink">{displayScore}</b></span>
      </div>

      {/* Number Pad */}
      <div className="grid grid-cols-4 gap-2">
        {['1','2','3','DEL','4','5','6','-','7','8','9','0'].map(n => (
          <button key={n} onClick={() => numPad(n)}
            className={`cute-btn h-14 text-xl font-bold ${
              n === 'DEL' ? 'bg-cute-red/10 text-cute-red' :
              n === '-' ? 'bg-cute-blue/10 text-cute-blue' :
              'bg-white text-cute-dark border-2 border-cute-border'
            }`}>
            {n === 'DEL' ? '⌫' : n}
          </button>
        ))}
        <button onClick={submitAnswer}
          className="cute-btn col-span-4 h-14 bg-cute-pink text-white text-lg font-black shadow-lg shadow-cute-pink/20">
          ✅ ส่งคำตอบ
        </button>
      </div>

      {pictureUrl && <img src={pictureUrl} alt="" className="fixed bottom-2 right-2 w-10 h-10 rounded-full opacity-40 border-2 border-cute-pink/30" />}
    </div>
  );
}
