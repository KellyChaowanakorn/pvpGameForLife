import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GameMode =
  | 'archer_battle'
  | 'memory_match'
  | 'speed_quiz'
  | 'puzzle_rush'
  | 'card_clash'
  | 'dodge_duel'
  | 'slot_machine';

export interface PlayerProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export interface GameResult {
  won: boolean;
  playerScore: number;
  opponentScore: number;
  rewardCoins: number;
  isDraw: boolean;
}

interface GameStore {
  // State (flat — no nested object)
  currentMode: GameMode | null;
  isMatchmaking: boolean;
  opponent: PlayerProfile | null;
  playerProfile: PlayerProfile | null;
  isInGame: boolean;
  gameResult: GameResult | null;
  virtualCoins: number;
  winStreak: number;
  rankPoints: number;

  // Actions
  setCurrentMode: (mode: GameMode | null) => void;
  setMatchmaking: (isMatchmaking: boolean) => void;
  setOpponent: (opponent: PlayerProfile | null) => void;
  setPlayerProfile: (profile: PlayerProfile | null) => void;
  setInGame: (inGame: boolean) => void;
  setGameResult: (result: GameResult | null) => void;
  addVirtualCoins: (amount: number) => void;
  incrementWinStreak: () => void;
  resetWinStreak: () => void;
  addRankPoints: (points: number) => void;
  resetState: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      // Initial state
      currentMode: null,
      isMatchmaking: false,
      opponent: null,
      playerProfile: null,
      isInGame: false,
      gameResult: null,
      virtualCoins: 1000,
      winStreak: 0,
      rankPoints: 0,

      // Actions
      setCurrentMode: (mode) => set({ currentMode: mode }),
      setMatchmaking: (isMatchmaking) => set({ isMatchmaking }),
      setOpponent: (opponent) => set({ opponent }),
      setPlayerProfile: (profile) => set({ playerProfile: profile }),
      setInGame: (inGame) => set({ isInGame: inGame }),
      setGameResult: (result) => set({ gameResult: result }),
      addVirtualCoins: (amount) => set((s) => ({ virtualCoins: s.virtualCoins + amount })),
      incrementWinStreak: () => set((s) => ({ winStreak: s.winStreak + 1 })),
      resetWinStreak: () => set({ winStreak: 0 }),
      addRankPoints: (points) => set((s) => ({ rankPoints: s.rankPoints + points })),
      resetState: () => set({
        currentMode: null, isMatchmaking: false, opponent: null,
        isInGame: false, gameResult: null,
      }),
    }),
    {
      name: 'game-storage',
      partialize: (state) => ({
        virtualCoins: state.virtualCoins,
        winStreak: state.winStreak,
        rankPoints: state.rankPoints,
      }),
    }
  )
);
