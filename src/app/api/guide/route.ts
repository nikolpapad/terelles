import Anthropic from "@anthropic-ai/sdk";
import { DISTRICT_BY_ID } from "@/lib/marseille";
import { ISLAND_BY_ID, JOB_BY_ID, JOBS, QUESTS, fallbackText } from "@/lib/content";

const TIMEOUT_MS = 5_000;

const SYSTEM = `Tu es Terra, une mouette guide bienveillante qui fait découvrir des métiers de l'environnement à des filles de 8 à 11 ans, à Marseille.
Réponds en français très simple, en tutoyant, en 2 phrases courtes maximum (30 mots max). Pas de mots compliqués. Pas d'emoji.
Si isCorrect est vrai : explique pourquoi ce métier résout la quête et cite un autre métier complémentaire, choisi uniquement dans la liste gameJobs.
Si isCorrect est faux : dis ce que ce métier pourrait apporter au problème (toujours positif), puis oriente vers le lieu de Marseille cible (targetPlace) SANS nommer le métier attendu.
N'invente aucun lieu ni métier : utilise seulement ceux fournis. N'écris que les 2 phrases, en texte simple sans mise en forme, sans titre ni guillemets. Ne mentionne jamais que tu es une IA.`;

type GuideRequest = {
  quest?: { id?: string };
  landedJob?: { id?: string };
  attempt?: number;
};

type Provider = "anthropic" | "mistral" | "none";

function provider(): Provider {
  const p = process.env.GUIDE_PROVIDER?.toLowerCase();
  if (p === "anthropic" || p === "mistral") return p;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.MISTRAL_API_KEY) return "mistral";
  return "none";
}

async function askAnthropic(user: string): Promise<string | null> {
  const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
    max_tokens: 150,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") return null;
  return response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join(" ")
    .trim();
}

async function askMistral(user: string): Promise<string | null> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL ?? "ministral-8b-latest",
      max_tokens: 150,
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Mistral HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

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
  const fallback = { text: fallbackText(quest, isCorrect, attempt), source: "fallback" as const };

  const place = (id: string) => `${DISTRICT_BY_ID[id].place} (${ISLAND_BY_ID[id].name})`;
  const user = JSON.stringify({
    quest: { id: quest.id, text: quest.text },
    landedJob: { id: job.id, title: job.title, pitch: job.pitch, place: place(job.islandId) },
    isCorrect,
    targetPlace: place(quest.targetIsland),
    attempt,
    gameJobs: JOBS.filter((j) => j.id !== job.id).map((j) => j.title),
  });

  const p = provider();
  if (p === "none") return Response.json(fallback);

  try {
    const raw = p === "mistral" ? await askMistral(user) : await askAnthropic(user);
    const text = raw?.replace(/[*_#`]+/g, "").replace(/\s{2,}/g, " ").trim();
    return Response.json(text ? { text, source: "ai", provider: p } : fallback);
  } catch (error) {
    console.error(`[guide] ${p} unavailable, using fallback:`, error);
    return Response.json(fallback);
  }
}
