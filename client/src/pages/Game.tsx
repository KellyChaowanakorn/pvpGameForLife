import { useGameStore } from '../lib/store';
import TargetTapGame from './games/TargetTapGame';
import ComboTapGame from './games/ComboTapGame';
import EnduranceGame from './games/EnduranceGame';

export default function Game() {
  const gameMode = useGameStore((s) => s.gameMode);

  switch (gameMode) {
    case 'target_tap': return <TargetTapGame />;
    case 'combo_tap': return <ComboTapGame />;
    case 'endurance': return <EnduranceGame />;
    default: return <TargetTapGame />;
  }
}
