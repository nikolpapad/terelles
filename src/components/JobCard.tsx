"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { ISLAND_BY_ID, JOB_BY_ID, QUESTS } from "@/lib/content";
import { DISTRICT_BY_ID } from "@/lib/marseille";
import { noEmoji, shade } from "@/lib/pixel";
import { useGame } from "@/state/gameStore";
import GuideBubble from "./GuideBubble";
import JobScene from "./JobScene";
import { PixelIcon } from "./Pixel";
import SpeakButton from "./SpeakButton";

export const CONFETTI_COLORS = ["#F7C548", "#D9643A", "#3CC7C9", "#58B368", "#F4EFE3", "#1B3B6F"];

export function pixelConfetti(x = 0.5, y = 0.4) {
  const opts = { spread: 100, colors: CONFETTI_COLORS, shapes: ["square" as const], scalar: 1.4, flat: true };
  confetti({ ...opts, particleCount: 120, origin: { x, y } });
  setTimeout(() => confetti({ ...opts, particleCount: 70, origin: { x: x - 0.25, y } }), 200);
}

export default function JobCard() {
  const jobId = useGame((s) => s.selectedJobId);
  return <AnimatePresence>{jobId && <CardPanel key={jobId} jobId={jobId} />}</AnimatePresence>;
}

function CardPanel({ jobId }: { jobId: string }) {
  const job = JOB_BY_ID[jobId];
  const island = ISLAND_BY_ID[job.islandId];
  const place = DISTRICT_BY_ID[job.islandId].place;
  const cardFrom = useGame((s) => s.cardFrom);
  const questIndex = useGame((s) => s.questIndex);
  const solvedNow = useGame(
    (s) => s.cardFrom === "landing" && s.guide.status !== "idle" && s.guide.isCorrect,
  );
  const questSolved = useGame((s) => {
    const q = QUESTS[s.questIndex];
    return !!q && s.solved.includes(q.id);
  });
  const celebrate = useGame((s) => s.celebrate);
  const { closeCard, nextQuest } = useGame.getState();
  const lastCelebrate = useRef(celebrate);

  useEffect(() => {
    if (!solvedNow || celebrate === lastCelebrate.current) return;
    lastCelebrate.current = celebrate;
    pixelConfetti(0.72, 0.35);
  }, [solvedNow, celebrate]);

  const isLast = questIndex >= QUESTS.length - 1;
  const pitch = noEmoji(job.pitch);

  return (
    <motion.aside
      initial={{ x: "110%" }}
      animate={{ x: 0 }}
      exit={{ x: "110%" }}
      transition={{ type: "tween", ease: "easeOut", duration: 0.25 }}
      className="px-box fixed inset-x-3 bottom-3 z-30 flex h-[70vh] flex-col md:top-[96px] md:right-4 md:bottom-4 md:left-auto md:h-auto md:w-[36vw] md:max-w-[560px] md:min-w-[400px]"
      role="dialog"
      aria-label={job.title}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b-4 border-ink/15 px-4 py-3 short:py-2"
        style={{ background: `color-mix(in srgb, ${island.color} 30%, var(--color-limestone))` }}
      >
        <div className="flex min-w-0 items-center gap-1.5 bg-limestone px-3 py-1 text-base font-semibold text-ink/80 short:text-sm">
          <span className="inline-block h-3 w-3 shrink-0" style={{ background: island.color }} />
          <span className="truncate">
            {place} › {job.zoneName}
          </span>
        </div>
        <button
          type="button"
          className="px-btn px-btn-light h-11 min-h-0 w-11 shrink-0 !p-0 text-xl"
          onClick={closeCard}
          aria-label="Fermer la fiche"
        >
          X
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 short:p-3">

        <div className="px-window relative mb-5 h-44 overflow-hidden short:mb-3 short:h-28">
          <JobScene jobId={job.id} />
          <AnimatePresence>
            {solvedNow && (
              <motion.div
                initial={{ scale: 3, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: -8 }}
                transition={{ type: "tween", ease: [0.2, 1.6, 0.4, 1], duration: 0.35 }}
                className="absolute top-3 left-3 border-4 border-pine bg-limestone px-3 py-1 text-2xl font-bold text-pine"
              >
                QUÊTE ACCOMPLIE !
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <h2 className="mb-1 text-3xl leading-tight font-bold short:text-2xl">{job.title}</h2>
        <div
          className="mb-3 h-1.5 w-24"
          style={{ background: `linear-gradient(90deg, ${island.color}, ${shade(island.color, -0.3)})` }}
        />
        <div className="mb-4 flex items-start gap-3 short:mb-3">
          <p className="flex-1 pt-1 text-xl leading-snug short:text-lg">{pitch}</p>
          <SpeakButton text={`${job.title}. ${pitch}`} />
        </div>

        {cardFrom === "landing" && <GuideBubble />}

        <Section icon="hammer" title="Ce qu'elle fait">
          <ul className="space-y-2 short:space-y-1">
            {job.missions.map((m) => (
              <li
                key={m}
                className="flex items-center gap-3 border-2 border-ink/10 bg-white px-2 py-1.5 text-lg short:py-1 short:text-base"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center"
                  style={{ background: `color-mix(in srgb, ${island.color} 30%, white)` }}
                >
                  <span className="h-2.5 w-2.5" style={{ background: shade(island.color, -0.3) }} />
                </span>
                {noEmoji(m)}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon="globe" title="Pourquoi c'est bon pour la planète" tone="leaf">
          <p className="text-lg short:text-base">{noEmoji(job.impact)}</p>
        </Section>

        <Section icon="bag" title="Pour faire ce métier" tone="sun">
          <p className="text-lg short:text-base">{noEmoji(job.howTo)}</p>
        </Section>
      </div>

      <div className="flex flex-wrap gap-4 border-t-4 border-dashed border-ink/15 p-4 short:p-3">
        <button type="button" className="px-btn px-btn-light" onClick={closeCard}>
          Fermer
        </button>
        {questSolved && cardFrom === "landing" && (
          <motion.button
            type="button"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="px-btn px-btn-sun ml-auto"
            onClick={nextQuest}
          >
            {isLast ? "Fin du voyage" : "Quête suivante"}
            <PixelIcon name="arrow" flip scale={2} />
          </motion.button>
        )}
      </div>
    </motion.aside>
  );
}

const TONES = {
  plain: { box: "bg-white/60", title: "text-ink/70" },
  leaf: { box: "bg-leaf/20", title: "text-pine" },
  sun: { box: "bg-sun/25", title: "text-wood-dark" },
};

function Section({
  icon,
  title,
  tone = "plain",
  children,
}: {
  icon: "hammer" | "globe" | "bag";
  title: string;
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section className={`mb-4 p-3 short:mb-3 short:p-2 ${t.box}`}>
      <h3
        className={`mb-2 flex items-center gap-2 text-base font-bold tracking-wide uppercase short:mb-1 short:text-sm ${t.title}`}
      >
        <span className="bg-white p-1">
          <PixelIcon name={icon} scale={2} />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}
