import { ISLAND_BY_ID, JOB_BY_ID, JOBS, QUESTS, fallbackText } from "@/lib/content";
import { complete } from "@/lib/llm";
import { DISTRICT_BY_ID } from "@/lib/marseille";

const SYSTEM = `Tu es Terra, une mouette guide bienveillante qui fait découvrir des métiers de l'environnement à des filles de 8 à 11 ans, à Marseille.
Réponds en français très simple, en tutoyant, en 2 phrases courtes maximum (30 mots max). Pas de mots compliqués. Pas d'emoji.
Si isCorrect est vrai : explique pourquoi ce métier résout la quête et cite un autre métier complémentaire, choisi uniquement dans la liste gameJobs.
Si isCorrect est faux : dis ce que ce métier pourrait apporter au problème (toujours positif), puis oriente vers le lieu de Marseille cible (targetPlace) SANS nommer le métier attendu.
N'invente aucun lieu ni métier : utilise seulement ceux fournis. N'écris que les 2 phrases, en texte simple sans mise en forme, sans titre ni guillemets.`;

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
  const place = (id: string) => `${DISTRICT_BY_ID[id].place} (${ISLAND_BY_ID[id].name})`;
  const user = JSON.stringify({
    quest: { id: quest.id, text: quest.text },
    landedJob: { id: job.id, title: job.title, pitch: job.pitch, place: place(job.islandId) },
    isCorrect,
    targetPlace: place(quest.targetIsland),
    attempt,
    gameJobs: JOBS.filter((j) => j.id !== job.id).map((j) => j.title),
  });

  const answer = await complete(SYSTEM, [{ role: "user", content: user }], 150);
  if (answer) return Response.json({ text: answer.text, source: "ai", provider: answer.provider });
  return Response.json({ text: fallbackText(quest, isCorrect, attempt), source: "fallback" });
}
