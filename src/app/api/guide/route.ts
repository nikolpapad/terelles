import Anthropic from "@anthropic-ai/sdk";
import { DISTRICT_BY_ID } from "@/lib/marseille";
import {
  ISLAND_BY_ID,
  JOB_BY_ID,
  QUESTS,
  fallbackText,
} from "@/lib/content";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

const SYSTEM = `Tu es Terra, une guide bienveillante qui fait découvrir des métiers de l'environnement à des filles de 8 à 11 ans, à Marseille.
Réponds en français très simple, en tutoyant, en 2 phrases courtes maximum (30 mots max). Pas de mots compliqués. Pas d’emoji.
Si isCorrect est vrai : explique pourquoi ce métier résout la quête et cite un autre métier complémentaire.
Si isCorrect est faux : dis ce que ce métier pourrait apporter au problème (toujours positif), puis oriente vers le lieu de Marseille cible (targetPlace) SANS nommer le métier attendu.
N'écris que les 2 phrases, sans titre ni guillemets. Ne mentionne jamais que tu es une IA.`;

type GuideRequest = {
  quest?: { id?: string };
  landedJob?: { id?: string };
  attempt?: number;
};

export async function POST(request: Request) {
  let body: GuideRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }

  // Trust our own content, not the client, for everything that matters.
  const quest = QUESTS.find((q) => q.id === body.quest?.id);
  const job = body.landedJob?.id ? JOB_BY_ID[body.landedJob.id] : undefined;
  if (!quest || !job) {
    return Response.json({ error: "Quête ou métier inconnu" }, { status: 400 });
  }

  const isCorrect = quest.answers.includes(job.id);
  const attempt = Math.max(1, Math.min(10, Number(body.attempt) || 1));
  const fallback = {
    text: fallbackText(quest, isCorrect, attempt),
    source: "fallback" as const,
  };

  try {
    const client = new Anthropic({ timeout: 5_000, maxRetries: 0 });
    const payload = {
      quest: { id: quest.id, text: quest.text },
      landedJob: {
        id: job.id,
        title: job.title,
        pitch: job.pitch,
        place: `${DISTRICT_BY_ID[job.islandId].place} (${ISLAND_BY_ID[job.islandId].name})`,
      },
      isCorrect,
      targetPlace: `${DISTRICT_BY_ID[quest.targetIsland].place} (${ISLAND_BY_ID[quest.targetIsland].name})`,
      attempt,
    };

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 150,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });

    if (response.stop_reason === "refusal") return Response.json(fallback);

    const text = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join(" ")
      .trim();

    return Response.json(text ? { text, source: "ai" } : fallback);
  } catch (error) {
    console.error("[guide] AI unavailable, using fallback:", error);
    return Response.json(fallback);
  }
}
