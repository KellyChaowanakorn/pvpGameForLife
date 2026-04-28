import { useGameStore } from '../lib/store';
import TargetTapGame from './games/TargetTapGame';
import ComboTapGame from './games/ComboTapGame';
import EnduranceGame from './games/EnduranceGame';
import MemoryFlipGame from './games/MemoryFlipGame';
import MathDuelGame from './games/MathDuelGame';
import AimClickGame from './games/AimClickGame';

export default function Game() {
  const mode = useGameStore((s) => s.gameMode);
  switch (mode) {
    case 'target_tap': return <TargetTapGame />;
    case 'combo_tap': return <ComboTapGame />;
    case 'endurance': return <EnduranceGame />;
    case 'memory_flip': return <MemoryFlipGame />;
    case 'math_duel': return <MathDuelGame />;
    case 'aim_click': return <AimClickGame />;
    default: return <TargetTapGame />;
  }
}
