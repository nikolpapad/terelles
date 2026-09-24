import { content, type Landing, type Quest } from "../types";

export type GuideAnswer = { text: string; source: "ai" | "fallback" };

export async function askGuide(quest: Quest, landing: Landing, correct: boolean, attempt: number): Promise<GuideAnswer> {
  const fallback = { text: correct ? quest.successText : quest.hints[Math.min(attempt, quest.hints.length - 1)] ?? quest.hints[0], source: "fallback" as const };
  const targetIsland = content.islands.find((island) => island.id === quest.targetIsland)?.name ?? "";
  try {
    const response = await fetch("/api/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quest: { id: quest.id, text: quest.text },
        landedJob: { id: landing.job.id, title: landing.job.title, pitch: landing.job.pitch, island: landing.island.name },
        isCorrect: correct, targetIsland, attempt,
      }),
      signal: AbortSignal.timeout(5500),
    });
    if (!response.ok) throw new Error("Guide unavailable");
    const answer = await response.json() as GuideAnswer;
    return typeof answer.text === "string" && (answer.source === "ai" || answer.source === "fallback") ? answer : fallback;
  } catch {
    return fallback;
  }
}