import { create } from 'zustand';

export type Screen = 'loading' | 'lobby' | 'queue' | 'vs' | 'countdown' | 'game' | 'result';

interface GameStore {
  // Auth
  token: string | null;
  isLoggedIn: boolean;
  pictureUrl: string | null;
  setAuth: (token: string, name: string, pic: string | null) => void;

  // UI
  screen: Screen;
  setScreen: (s: Screen) => void;

  // Player
  playerName: string;
  wallet: number;
  setPlayerName: (n: string) => void;
  setWallet: (w: number) => void;

  // Online
  onlineCount: number;
  setOnlineCount: (n: number) => void;

  // Match
  matchId: string | null;
  opponentName: string;
  prize: string;
  setMatch: (id: string, opp: string, prize: string) => void;

  // Countdown
  countdownNum: number;
  setCountdown: (n: number) => void;

  // Game
  myScore: number;
  oppScore: number;
  timeLeft: number;
  setMyScore: (s: number) => void;
  setOppScore: (s: number) => void;
  setTimeLeft: (t: number) => void;

  // Result
  result: 'win' | 'lose' | 'draw' | null;
  resultData: any;
  setResult: (r: 'win' | 'lose' | 'draw', data: any) => void;

  // Reset
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  token: null,
  isLoggedIn: false,
  pictureUrl: null,
  setAuth: (token, playerName, pictureUrl) => set({ token, isLoggedIn: true, playerName, pictureUrl }),

  screen: 'loading',
  setScreen: (screen) => set({ screen }),

  playerName: `Player_${Math.floor(Math.random() * 9999)}`,
  wallet: 0,
  setPlayerName: (playerName) => set({ playerName }),
  setWallet: (wallet) => set({ wallet }),

  onlineCount: 0,
  setOnlineCount: (onlineCount) => set({ onlineCount }),

  matchId: null,
  opponentName: '',
  prize: '0',
  setMatch: (matchId, opponentName, prize) => set({ matchId, opponentName, prize }),

  countdownNum: 3,
  setCountdown: (countdownNum) => set({ countdownNum }),

  myScore: 0,
  oppScore: 0,
  timeLeft: 5,
  setMyScore: (myScore) => set({ myScore }),
  setOppScore: (oppScore) => set({ oppScore }),
  setTimeLeft: (timeLeft) => set({ timeLeft }),

  result: null,
  resultData: null,
  setResult: (result, resultData) => set({ result, resultData }),

  resetGame: () => set({ myScore: 0, oppScore: 0, timeLeft: 5, result: null, resultData: null }),
}));
