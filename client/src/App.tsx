import { useEffect } from 'react';
import { useGameStore } from './lib/store';
import { initSocket } from './lib/socket';
import { fullLoginFlow } from './lib/liff';
import { unlockAudio } from './lib/sounds';
import Lobby from './pages/Lobby';
import ModeSelect from './pages/ModeSelect';
import Queue from './pages/Queue';
import VsScreen from './pages/VsScreen';
import Countdown from './pages/Countdown';
import Game from './pages/Game';
import Result from './pages/Result';
import WalletPage from './pages/WalletPage';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  useEffect(() => {
    async function boot() {
      const auth = await fullLoginFlow();
      if (auth) {
        const s = useGameStore.getState();
        s.setAuth(auth.token, auth.user.displayName, auth.user.pictureUrl);
        s.setWallet(auth.wallet.balance);
        initSocket();
        s.setScreen('lobby');
      }
    }
    boot();
  }, []);

  return (
    <div className="min-h-screen bg-cute-bg" onTouchStart={unlockAudio} onClick={unlockAudio}>
      <div className="max-w-[440px] mx-auto px-4 py-4 min-h-screen">
        {screen === 'loading' && <Loading />}
        {screen === 'lobby' && <Lobby />}
        {screen === 'modeSelect' && <ModeSelect />}
        {screen === 'queue' && <Queue />}
        {screen === 'vs' && <VsScreen />}
        {screen === 'countdown' && <Countdown />}
        {screen === 'game' && <Game />}
        {screen === 'result' && <Result />}
        {screen === 'wallet' && <WalletPage />}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="text-4xl mb-2">🎮</div>
      <div className="text-2xl font-black mb-2">
        <span className="text-cute-pink">Skill</span> <span className="text-cute-dark">Arena</span>
      </div>
      <div className="w-10 h-10 border-4 border-cute-border border-t-cute-pink rounded-full animate-spin mb-3" />
      <div className="text-cute-gray text-sm">กำลังเชื่อมต่อ...</div>
    </div>
  );
}
