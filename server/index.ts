import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const content = JSON.parse(await readFile(path.join(root, "data/content.json"), "utf8")) as {
  quests: { id: string; text: string; answers: string[]; targetIsland: string; hints: string[]; successText: string }[];
  islands: { id: string; name: string; zones: { jobs: { id: string; title: string; pitch: string }[] }[] }[];
};
const app = express();
app.use(express.json({ limit: "16kb" }));

const systemPrompt = `Tu es Terra, une guide bienveillante qui fait découvrir des métiers de l'environnement à des filles de 8 à 11 ans.
Réponds en français très simple, en tutoyant, en 2 phrases courtes maximum (30 mots max). Pas de mots compliqués. Un emoji maximum.
Si isCorrect est vrai : explique pourquoi ce métier résout la quête et cite un autre métier complémentaire.
Si isCorrect est faux : dis ce que ce métier pourrait apporter au problème (toujours positif), puis oriente vers l'île cible SANS nommer le métier attendu.
Ne mentionne jamais que tu es une IA.`;

app.post("/api/guide", async (req, res) => {
  const body = req.body as {
    quest?: { id?: string; text?: string };
    landedJob?: { id?: string; title?: string; pitch?: string; island?: string };
    isCorrect?: boolean;
    targetIsland?: string;
    attempt?: number;
  };
  const quest = content.quests.find((q) => q.id === body?.quest?.id);
  const island = content.islands.find((i) => i.name === body?.landedJob?.island);
  const job = island?.zones.flatMap((z) => z.jobs).find((j) => j.id === body?.landedJob?.id);
  if (!quest || !job || body.quest?.text !== quest.text ||
      body.landedJob?.title !== job.title || body.landedJob?.pitch !== job.pitch ||
      body.targetIsland !== content.islands.find((i) => i.id === quest.targetIsland)?.name ||
      body.isCorrect !== quest.answers.includes(job.id) ||
      !Number.isInteger(body.attempt) || (body.attempt ?? 0) < 0) {
    res.status(400).json({ error: "Requête invalide" });
    return;
  }
  const fallback = {
    text: body.isCorrect ? quest.successText : quest.hints[Math.min(body.attempt!, quest.hints.length - 1)] ?? quest.hints[0],
    source: "fallback",
  };
  const key = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (process.env.GUIDE_DISABLED === "true" || !key) {
    res.json(fallback);
    return;
  }
  try {
    const client = new Anthropic({
      apiKey: key,
      ...(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
        ? { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL }
        : {}),
      timeout: 5000,
      maxRetries: 0,
    });
    const answer = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: "user", content: JSON.stringify({
        quest: { id: quest.id, text: quest.text },
        landedJob: { id: job.id, title: job.title, pitch: job.pitch, island: island!.name },
        isCorrect: body.isCorrect,
        targetIsland: body.targetIsland,
        attempt: body.attempt,
      }) }],
    });
    const text = answer.content.filter((block) => block.type === "text").map((block) => block.text).join(" ").trim();
    res.json(text ? { text, source: "ai" } : fallback);
  } catch (error) {
    console.error("Guide unavailable:", error instanceof Error ? error.message : "unknown error");
    res.json(fallback);
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(path.join(root, "dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ server: { middlewareMode: true, allowedHosts: true }, appType: "spa" });
  app.use(vite.middlewares);
}
app.listen(Number(process.env.PORT) || 5000, "0.0.0.0", () => console.log("Terr'Îles ready on port " + (process.env.PORT || 5000)));