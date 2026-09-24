import { create } from "zustand";
import { persist } from "zustand/middleware";
import { JOB_BY_ID, QUESTS } from "@/lib/content";
import { askGuide } from "@/lib/guideClient";
import { stopSpeaking } from "@/lib/speech";

export type Screen = "start" | "intro" | "map" | "end";

export type GuideState =
  | { status: "idle" }
  | { status: "loading"; isCorrect: boolean }
  | { status: "done"; isCorrect: boolean; text: string; source: "ai" | "fallback" | "static" };

type Progress = {
  screen: Screen;
  questIndex: number;
  /** Wrong landings per quest id. */
  attempts: Record<string, number>;
  solved: string[];
  /** Discovered job ids, in discovery order. */
  carnet: string[];
  /** Landings per island id (for the end screen). */
  islandVisits: Record<string, number>;
};

export type Focus = { level: 1 | 2 | 3; districtId: string | null; zoneId: string | null };

type Ui = {
  /** What the map camera is looking at (for the HUD breadcrumb). */
  focus: Focus;
  selectedJobId: string | null;
  cardFrom: "landing" | "carnet";
  guide: GuideState;
  carnetOpen: boolean;
  questOpen: boolean;
  /** Bumps on every successful landing so the UI can celebrate. */
  celebrate: number;
};

type Actions = {
  startAdventure: () => void;
  beginQuest: () => void;
  setFocus: (focus: Focus) => void;
  land: (jobId: string) => Promise<void>;
  openFromCarnet: (jobId: string) => void;
  closeCard: () => void;
  nextQuest: () => void;
  setCarnetOpen: (open: boolean) => void;
  setQuestOpen: (open: boolean) => void;
  reset: () => void;
};

export type GameState = Progress & Ui & Actions;

const initialProgress: Progress = {
  screen: "start",
  questIndex: 0,
  attempts: {},
  solved: [],
  carnet: [],
  islandVisits: {},
};

const initialUi: Ui = {
  focus: { level: 1, districtId: null, zoneId: null },
  selectedJobId: null,
  cardFrom: "landing",
  guide: { status: "idle" },
  carnetOpen: false,
  questOpen: false,
  celebrate: 0,
};

let guideRequest = 0;

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialProgress,
      ...initialUi,

      startAdventure: () =>
        set({ screen: get().questIndex >= QUESTS.length ? "end" : "intro" }),

      beginQuest: () => set({ screen: "map" }),

      setFocus: (focus) => {
        const f = get().focus;
        if (f.level !== focus.level || f.districtId !== focus.districtId || f.zoneId !== focus.zoneId) {
          set({ focus });
        }
      },

      land: async (jobId) => {
        const job = JOB_BY_ID[jobId];
        if (!job) return;
        const s = get();
        const quest = QUESTS[s.questIndex];

        set({
          selectedJobId: jobId,
          cardFrom: "landing",
          carnet: s.carnet.includes(jobId) ? s.carnet : [...s.carnet, jobId],
          islandVisits: {
            ...s.islandVisits,
            [job.islandId]: (s.islandVisits[job.islandId] ?? 0) + 1,
          },
        });

        const requestId = ++guideRequest;

        if (!quest || s.solved.includes(quest.id)) {
          set({
            guide: {
              status: "done",
              isCorrect: false,
              source: "static",
              text: "Tu as déjà résolu cette quête ! Clique sur « Quête suivante ».",
            },
          });
          return;
        }

        const isCorrect = quest.answers.includes(jobId);
        const wrong = s.attempts[quest.id] ?? 0;
        const attempt = isCorrect ? Math.max(wrong, 1) : wrong + 1;

        set({
          guide: { status: "loading", isCorrect },
          ...(isCorrect
            ? { solved: [...s.solved, quest.id], celebrate: s.celebrate + 1 }
            : { attempts: { ...s.attempts, [quest.id]: attempt } }),
        });

        const reply = await askGuide(quest, job, isCorrect, attempt);
        if (requestId !== guideRequest) return; // a newer landing happened
        set({ guide: { status: "done", isCorrect, ...reply } });
      },

      openFromCarnet: (jobId) => {
        guideRequest++;
        set({
          selectedJobId: jobId,
          cardFrom: "carnet",
          carnetOpen: false,
          guide: { status: "idle" },
        });
      },

      closeCard: () => {
        guideRequest++;
        stopSpeaking();
        set({ selectedJobId: null, guide: { status: "idle" } });
      },

      nextQuest: () => {
        stopSpeaking();
        const next = get().questIndex + 1;
        set({
          ...initialUi,
          questIndex: next,
          screen: next >= QUESTS.length ? "end" : "intro",
        });
      },

      setCarnetOpen: (carnetOpen) => set({ carnetOpen }),
      setQuestOpen: (questOpen) => set({ questOpen }),

      reset: () => {
        guideRequest++;
        stopSpeaking();
        set({ ...initialProgress, ...initialUi });
      },
    }),
    {
      name: "terrelles-progress-v1",
      partialize: (s): Progress => ({
        screen: s.screen,
        questIndex: s.questIndex,
        attempts: s.attempts,
        solved: s.solved,
        carnet: s.carnet,
        islandVisits: s.islandVisits,
      }),
    },
  ),
);

export const currentQuest = (s: GameState) => QUESTS[s.questIndex];

/** After 3 wrong landings, the target district is highlighted on the map. */
export const highlightedDistrict = (s: GameState) => {
  const q = QUESTS[s.questIndex];
  if (!q || s.solved.includes(q.id)) return null;
  return (s.attempts[q.id] ?? 0) >= 3 ? q.targetIsland : null;
};
