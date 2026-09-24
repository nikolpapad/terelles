import { ISLAND_BY_ID, fallbackText, type JobRef, type Quest } from "./content";

export type GuideReply = { text: string; source: "ai" | "fallback" };

/** Calls /api/guide; never throws and never waits more than ~6 s. */
export async function askGuide(
  quest: Quest,
  job: JobRef,
  isCorrect: boolean,
  attempt: number,
): Promise<GuideReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const res = await fetch("/api/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        quest: { id: quest.id, text: quest.text },
        landedJob: {
          id: job.id,
          title: job.title,
          pitch: job.pitch,
          island: ISLAND_BY_ID[job.islandId].name,
        },
        isCorrect,
        targetIsland: ISLAND_BY_ID[quest.targetIsland].name,
        attempt,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as GuideReply;
    if (!data.text) throw new Error("empty");
    return data;
  } catch {
    return { text: fallbackText(quest, isCorrect, attempt), source: "fallback" };
  } finally {
    clearTimeout(timer);
  }
}
