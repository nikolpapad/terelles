import type { JobRef } from "./content";
import { noEmoji } from "./pixel";

/** Ready-made questions: big buttons for kids who read slowly. */
export const QUESTIONS = [
  { id: "day", text: "Tu fais quoi dans une journée ?" },
  { id: "why", text: "Pourquoi c'est important pour la planète ?" },
  { id: "school", text: "Comment on devient comme toi ?" },
  { id: "secret", text: "Tu me dis un secret sur ton métier ?" },
  { id: "tools", text: "C'est quoi tes outils ?" },
  { id: "team", text: "Tu travailles avec qui ?" },
  { id: "best", text: "Qu'est-ce que tu préfères dans ton métier ?" },
  { id: "me", text: "Moi aussi je pourrais le faire ?" },
] as const;

export type QuestionId = (typeof QUESTIONS)[number]["id"];

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** "Elle aime… et a appris…" → "J'aime… et j'ai appris…" */
const unElle = (s: string) =>
  noEmoji(s)
    .replace(/^Elle a /, "J'ai ")
    .replace(/^Elle aime/, "J'aime")
    .replace(/^Elle /, "Je ")
    .replace(/ et a /, " et j'ai ");

/** Answers built from content.json, used when the AI is unavailable. */
export function fallbackAnswer(q: QuestionId | null, job: JobRef): string {
  const missions = job.missions.map((m) => lower(noEmoji(m)));
  switch (q) {
    case "day":
      return `Dans ma journée, je dois ${missions[0]}, ${missions[1]} et ${missions[2]}. Je ne m'ennuie jamais !`;
    case "why":
      return `${noEmoji(job.impact)} C'est pour ça que j'aime mon métier.`;
    case "school":
      return `${unElle(job.howTo)} Toi aussi, tu peux apprendre !`;
    case "secret":
      return `Le savais-tu ? ${noEmoji(job.funFact)}`;
    case "tools":
      return `Pour ${missions[0]}, j'ai besoin de bons outils et de beaucoup de curiosité !`;
    case "team":
      return "Je travaille en équipe, avec d'autres métiers. Ensemble, on protège mieux Marseille !";
    case "best":
      return `Ce que je préfère ? ${noEmoji(job.impact)} Et chaque jour est différent !`;
    case "me":
      return "Bien sûr ! Si tu es curieuse et que tu aimes apprendre, tu peux faire ce métier plus tard.";
    default:
      return "Hmm, je n'ai pas bien compris. Choisis une question en dessous !";
  }
}
