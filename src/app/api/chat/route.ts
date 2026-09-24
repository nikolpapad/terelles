import { ISLAND_BY_ID, JOB_BY_ID } from "@/lib/content";
import { fallbackAnswer, QUESTIONS, type QuestionId } from "@/lib/jobChat";
import { complete, type ChatMessage } from "@/lib/llm";
import { DISTRICT_BY_ID } from "@/lib/marseille";

const MAX_MESSAGES = 10;
const PLACES =
  "le Vieux-Port, les Calanques, le MuCEM, Noailles, la Joliette, le Grand Port, le Vélodrome, Notre-Dame de la Garde, les plages du Prado, les îles du Frioul, le Château d'If, le Palais Longchamp, la Canebière ou le massif de l'Étoile";

/** Keeps answers short enough for young readers, whatever the model does. */
function shorten(text: string) {
  const sentences = text.match(/[^.!?…]+[.!?…]+["»]?|[^.!?…]+$/g) ?? [text];
  let out = "";
  for (const s of sentences.slice(0, 3)) {
    const next = (out + " " + s.trim()).trim();
    if (out && next.split(/\s+/).length > 50) break;
    out = next;
  }
  return out;
}
const MAX_CHARS = 200;

type ChatRequest = {
  jobId?: string;
  questionId?: string;
  messages?: { role?: string; content?: string }[];
};

function systemPrompt(jobId: string) {
  const job = JOB_BY_ID[jobId];
  const place = DISTRICT_BY_ID[job.islandId].place;
  return `Tu joues ${job.title}, une femme qui exerce ce métier à Marseille (${place}, secteur ${ISLAND_BY_ID[job.islandId].name}).
Tu parles avec une fille de 8 à 11 ans qui découvre ton métier dans un jeu éducatif de l'association TERR'ELLES.

Comment répondre :
- À la première personne, en tutoyant, en français très simple et chaleureux.
- 3 phrases courtes MAXIMUM, 40 mots en tout. Pas d'emoji, pas de liste, pas de mise en forme.
- Donne un exemple concret de ta journée à Marseille (la mer, le mistral, le soleil, les quartiers).
- Lieux : cite seulement ${PLACES}. N'invente aucun autre lieu.
- Nature : ne parle que d'animaux et de plantes qui vivent vraiment en Méditerranée ou en Provence. Si tu n'es pas sûre d'un fait, reste générale.
- Montre que c'est un métier pour les filles comme pour tout le monde, et donne envie d'apprendre.
- Appuie-toi sur ta fiche ci-dessous. N'invente pas de chiffres précis, de salaires, ni de noms de vraies personnes ou d'entreprises.
- Si on te demande si tu es une vraie personne : tu es un personnage du jeu, mais ton métier existe vraiment.
- Si la question n'a rien à voir avec ton métier, la nature, la ville ou les études, ramène gentiment la conversation vers ton métier.
- Ne demande jamais d'informations personnelles (nom, âge, adresse, école). Si l'enfant en donne, ne les répète pas.
- Si le sujet est triste ou inquiétant, rassure et parle de ce qu'on peut faire ensemble.

Ta fiche :
- Présentation : ${job.pitch}
- Tes missions : ${job.missions.join(" ; ")}
- Pourquoi c'est utile : ${job.impact}
- Comment tu as appris : ${job.howTo}
- Anecdote : ${job.funFact}`;
}

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }
  const job = body.jobId ? JOB_BY_ID[body.jobId] : undefined;
  if (!job) return Response.json({ error: "Métier inconnu" }, { status: 400 });

  const messages: ChatMessage[] = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role as ChatMessage["role"], content: m.content!.slice(0, MAX_CHARS) }));
  // the conversation must end with the child's question
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "Pas de question" }, { status: 400 });
  }

  const questionId = QUESTIONS.some((q) => q.id === body.questionId) ? (body.questionId as QuestionId) : null;
  const answer = await complete(systemPrompt(job.id), messages, 130);
  if (answer) return Response.json({ text: shorten(answer.text), source: "ai" });
  return Response.json({ text: fallbackAnswer(questionId, job), source: "fallback" });
}
