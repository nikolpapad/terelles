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
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-base font-semibold text-ink/70">
          <span className="inline-block h-3 w-3" style={{ background: island.color }} />
          <span>{place}</span>
          <span>›</span>
          <span>{job.zoneName}</span>
        </div>

        <div className="px-window relative mb-5 h-44 overflow-hidden">
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

        <h2 className="mb-1 text-3xl leading-tight font-bold">{job.title}</h2>
        <div
          className="mb-3 h-1.5 w-24"
          style={{ background: `linear-gradient(90deg, ${island.color}, ${shade(island.color, -0.3)})` }}
        />
        <div className="mb-4 flex items-start gap-3">
          <p className="flex-1 pt-1 text-xl leading-snug">{pitch}</p>
          <SpeakButton text={`${job.title}. ${pitch}`} />
        </div>

        {cardFrom === "landing" && <GuideBubble />}

        <Section icon="hammer" title="Ce qu'elle fait">
          <ul className="space-y-2">
            {job.missions.map((m) => (
              <li key={m} className="flex items-center gap-2 text-lg">
                <span className="h-2.5 w-2.5 shrink-0" style={{ background: shade(island.color, -0.3) }} />
                {noEmoji(m)}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon="globe" title="Pourquoi c'est bon pour la planète">
          <p className="text-lg">{noEmoji(job.impact)}</p>
        </Section>

        <Section icon="bag" title="Pour faire ce métier">
          <p className="text-lg">{noEmoji(job.howTo)}</p>
        </Section>
      </div>

      <div className="flex flex-wrap gap-4 border-t-4 border-dashed border-ink/15 p-4">
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

function Section({
  icon,
  title,
  children,
}: {
  icon: "hammer" | "globe" | "bag";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 bg-white/60 p-3">
      <h3 className="mb-2 flex items-center gap-2 text-base font-bold tracking-wide text-ink/70 uppercase">
        <PixelIcon name={icon} scale={2} />
        {title}
      </h3>
      {children}
    </section>
  );
}
