import { create } from "zustand";
import { persist } from "zustand/middleware";
import { content } from "../types";

type Screen = "start" | "play" | "end";
type GameState = {
  screen: Screen;
  questIndex: number;
  attempts: Record<string, number>;
  visited: string[];
  visits: Record<string, number>;
  solved: boolean;
  islandId: string | null;
  jobId: string | null;
  carnetOpen: boolean;
  introOpen: boolean;
  howOpen: boolean;
  start: () => void;
  reset: () => void;
  chooseIsland: (id: string | null) => void;
  chooseJob: (id: string | null) => void;
  land: (jobId: string, islandId: string, correct: boolean) => number;
  next: () => void;
  setCarnet: (open: boolean) => void;
  setIntro: (open: boolean) => void;
  setHow: (open: boolean) => void;
};

const initial = {
  screen: "start" as Screen, questIndex: 0, attempts: {}, visited: [], visits: {},
  solved: false, islandId: null, jobId: null, carnetOpen: false, introOpen: false, howOpen: false,
};

export const useGame = create<GameState>()(persist((set, get) => ({
  ...initial,
  start: () => set({ screen: "play", introOpen: true, carnetOpen: false, howOpen: false }),
  reset: () => set({ ...initial }),
  chooseIsland: (id) => set({ islandId: id, jobId: null, carnetOpen: false }),
  chooseJob: (id) => set({ jobId: id }),
  land: (jobId, islandId, correct) => {
    const state = get();
    const questId = content.quests[state.questIndex].id;
    const attempt = state.attempts[questId] ?? 0;
    set({
      jobId, islandId,
      visited: state.visited.includes(jobId) ? state.visited : [...state.visited, jobId],
      visits: { ...state.visits, [islandId]: (state.visits[islandId] ?? 0) + 1 },
      attempts: !correct && !state.solved ? { ...state.attempts, [questId]: attempt + 1 } : state.attempts,
      solved: correct || state.solved,
    });
    return attempt;
  },
  next: () => set((state) => state.questIndex + 1 >= content.quests.length
    ? { screen: "end", jobId: null, islandId: null, solved: false }
    : { questIndex: state.questIndex + 1, solved: false, jobId: null, islandId: null, introOpen: true }),
  setCarnet: (open) => set({ carnetOpen: open, jobId: null }),
  setIntro: (open) => set({ introOpen: open }),
  setHow: (open) => set({ howOpen: open }),
}), {
  name: "terr-iles-progress",
  partialize: (state) => ({
    screen: state.screen, questIndex: state.questIndex, attempts: state.attempts,
    visited: state.visited, visits: state.visits, solved: state.solved,
  }),
}));