import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Server-side chat completion with whichever provider is configured. */

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Provider = "anthropic" | "mistral" | "none";

const TIMEOUT_MS = 6_000;

export function provider(): Provider {
  const p = process.env.GUIDE_PROVIDER?.toLowerCase();
  if (p === "anthropic" || p === "mistral") return p;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.MISTRAL_API_KEY) return "mistral";
  return "none";
}

async function anthropic(system: string, messages: ChatMessage[], maxTokens: number) {
  const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
    max_tokens: maxTokens,
    system,
    messages,
  });
  if (res.stop_reason === "refusal") return null;
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ");
}

async function mistral(system: string, messages: ChatMessage[], maxTokens: number) {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL ?? "ministral-8b-latest",
      max_tokens: maxTokens,
      temperature: 0.6,
      safe_prompt: true,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`Mistral HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? null;
}

/** Returns clean plain text, or null when no provider/answer is available (caller falls back). */
export async function complete(system: string, messages: ChatMessage[], maxTokens = 160) {
  const p = provider();
  if (p === "none") return null;
  try {
    const raw = p === "mistral" ? await mistral(system, messages, maxTokens) : await anthropic(system, messages, maxTokens);
    const text = raw
      ?.replace(/\p{Extended_Pictographic}|️/gu, "")
      .replace(/[*_#`]+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return text ? { text, provider: p } : null;
  } catch (error) {
    console.error(`[llm] ${p} unavailable:`, error);
    return null;
  }
}
