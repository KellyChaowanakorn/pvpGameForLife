import { useEffect } from 'react';
import { useGameStore } from './lib/store';
import { initSocket } from './lib/socket';
import { fullLoginFlow } from './lib/liff';
import Lobby from './pages/Lobby';
import Queue from './pages/Queue';
import VsScreen from './pages/VsScreen';
import Countdown from './pages/Countdown';
import Game from './pages/Game';
import Result from './pages/Result';

export default function App() {
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    async function boot() {
      // Step 1: Login (LIFF or dev)
      const auth = await fullLoginFlow();

      if (auth) {
        // Step 2: Save auth state
        const store = useGameStore.getState();
        store.setAuth(auth.token, auth.user.displayName, auth.user.pictureUrl);
        store.setWallet(auth.wallet.balance);

        // Step 3: Connect socket with auth
        initSocket();

        // Step 4: Show lobby
        store.setScreen('lobby');
      }
    }

    boot();
  }, []);

  return (
    <div className="min-h-screen bg-stake-bg font-sans">
      <div className="max-w-[440px] mx-auto px-4 py-4 min-h-screen">
        {screen === 'loading' && <LoadingScreen />}
        {screen === 'lobby' && <Lobby />}
        {screen === 'queue' && <Queue />}
        {screen === 'vs' && <VsScreen />}
        {screen === 'countdown' && <Countdown />}
        {screen === 'game' && <Game />}
        {screen === 'result' && <Result />}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="text-3xl font-black mb-3">
        <span className="text-neon">Skill</span> Arena
      </div>
      <div className="w-10 h-10 border-3 border-stake-border border-t-neon rounded-full animate-spin mb-4" style={{ borderWidth: '3px' }} />
      <div className="text-stake-gray text-sm">Connecting...</div>
    </div>
  );
}
