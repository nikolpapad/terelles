"use client";

import { useEffect, useRef, useState } from "react";
import { JOB_BY_ID } from "@/lib/content";
import { fallbackAnswer, QUESTIONS, type QuestionId } from "@/lib/jobChat";
import { noEmoji } from "@/lib/pixel";
import { Character } from "./Pixel";
import SpeakButton from "./SpeakButton";
import Typewriter from "./Typewriter";

type Msg = { role: "user" | "assistant"; content: string; questionId?: QuestionId };

/** Conversations survive closing and reopening a card during the session. */
const history = new Map<string, Msg[]>();

async function ask(jobId: string, messages: Msg[], questionId?: QuestionId): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        jobId,
        questionId,
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { text?: string };
    if (!data.text) throw new Error("empty");
    return data.text;
  } catch {
    return fallbackAnswer(questionId ?? null, JOB_BY_ID[jobId]);
  }
}

/** Chat with the professional herself, to really discover her job. */
export default function JobChat({ jobId }: { jobId: string }) {
  const job = JOB_BY_ID[jobId];
  const [messages, setMessages] = useState<Msg[]>(
    () => history.get(jobId) ?? [{ role: "assistant", content: noEmoji(job.hello ?? job.pitch) }],
  );
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    history.set(jobId, messages);
    // scroll only the card, never the whole game page
    const box = endRef.current?.closest(".overflow-y-auto");
    if (box && messages.length > 1) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [jobId, messages, loading]);

  const asked = new Set(messages.map((m) => m.questionId));
  const suggestions = QUESTIONS.filter((q) => !asked.has(q.id)).slice(0, 3);

  const send = async (content: string, questionId?: QuestionId) => {
    const text = content.trim().slice(0, 200);
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text, questionId }];
    setMessages(next);
    setDraft("");
    setLoading(true);
    const answer = await ask(jobId, next, questionId);
    setMessages((m) => [...m, { role: "assistant", content: answer }]);
    setLoading(false);
  };

  const lastAnswer = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <section className="mb-5">
      <h3 className="mb-3 text-base font-bold tracking-wide text-ink/70 uppercase">Discute avec elle</h3>

      <div className="space-y-3" aria-live="polite">
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} className="flex items-end gap-2">
              <div className="shrink-0 bg-sea-light/30 p-0.5">
                <Character jobId={jobId} scale={2} />
              </div>
              <div className="px-window flex flex-1 items-start gap-2 p-3">
                <p className="flex-1 text-lg leading-snug">
                  {i === lastAnswer && i > 0 ? <Typewriter text={m.content} speed={22} /> : m.content}
                </p>
                <SpeakButton text={m.content} dark />
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-end justify-end gap-2">
              <p className="max-w-[80%] bg-sun px-3 py-2 text-lg leading-snug shadow-[0_3px_0_#C9962A]">{m.content}</p>
              <div className="shrink-0">
                <Character hero scale={2} />
              </div>
            </div>
          ),
        )}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="shrink-0 bg-sea-light/30 p-0.5">
              <Character jobId={jobId} scale={2} />
            </div>
            <div className="px-window px-4 py-3 text-lg">
              <span className="anim-caret">. . .</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {suggestions.map((q) => (
            <button
              key={q.id}
              type="button"
              disabled={loading}
              onClick={() => send(q.text, q.id)}
              className="px-btn px-btn-light justify-start text-left text-base disabled:opacity-50"
            >
              <span className="text-terracotta">?</span> {q.text}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-4 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder="Pose ta question…"
          aria-label="Pose ta question"
          className="min-h-12 min-w-0 flex-1 border-4 border-ink bg-white px-3 text-lg outline-none focus:border-terracotta"
        />
        <button type="submit" disabled={loading || !draft.trim()} className="px-btn text-base disabled:opacity-50">
          Envoyer
        </button>
      </form>
    </section>
  );
}
