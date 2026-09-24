import raw from "../../data/content.json";

export type Point = { x: number; y: number };

export type Job = {
  id: string;
  title: string;
  emoji: string;
  pitch: string;
  missions: string[];
  impact: string;
  howTo: string;
  /** First-person greeting when you talk to her. */
  hello: string;
  /** "Le savais-tu ?" */
  funFact: string;
  image: string | null;
  position: Point;
};

export type Zone = { id: string; name: string; jobs: Job[] };

export type Island = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  position: Point;
  zones: Zone[];
};

export type Quest = {
  id: string;
  emoji: string;
  text: string;
  answers: string[];
  targetIsland: string;
  successText: string;
  hints: string[];
};

export type Content = {
  meta: {
    title: string;
    version: string;
    language: string;
    worldSize: { width: number; height: number };
    sea: string;
  };
  islands: Island[];
  quests: Quest[];
};

/** A job with a pointer back to where it lives on the map. */
export type JobRef = Job & { islandId: string; zoneId: string; zoneName: string };

export const content = raw as Content;
export const { islands: ISLANDS, quests: QUESTS } = content;

export const ISLAND_BY_ID: Record<string, Island> = Object.fromEntries(
  ISLANDS.map((i) => [i.id, i]),
);

export const JOBS: JobRef[] = ISLANDS.flatMap((island) =>
  island.zones.flatMap((zone) =>
    zone.jobs.map((job) => ({
      ...job,
      islandId: island.id,
      zoneId: zone.id,
      zoneName: zone.name,
    })),
  ),
);

export const JOB_BY_ID: Record<string, JobRef> = Object.fromEntries(
  JOBS.map((j) => [j.id, j]),
);

/** Static fallback text used when the AI is unavailable. */
export function fallbackText(quest: Quest, isCorrect: boolean, attempt: number) {
  if (isCorrect) return quest.successText;
  const i = Math.min(Math.max(attempt - 1, 0), quest.hints.length - 1);
  return quest.hints[i];
}

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
