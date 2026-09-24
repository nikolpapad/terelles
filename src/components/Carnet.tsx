"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ISLANDS, JOBS } from "@/lib/content";
import { DISTRICT_BY_ID } from "@/lib/marseille";
import { useGame } from "@/state/gameStore";
import { Character, PixelIcon } from "./Pixel";

export function CarnetButton() {
  const count = useGame((s) => s.carnet.length);
  const setCarnetOpen = useGame((s) => s.setCarnetOpen);
  return (
    <button
      type="button"
      onClick={() => setCarnetOpen(true)}
      className="px-btn px-btn-wood pointer-events-auto"
      aria-label={`Mon carnet, ${count} métiers`}
    >
      <PixelIcon name="book" scale={3} />
      <span className="hidden sm:inline">Carnet</span>
      <span key={count} className="anim-pop bg-sun px-2 text-ink">
        {count}
      </span>
    </button>
  );
}

/** The player's inventory of discovered jobs, grouped by district. */
export default function Carnet() {
  const open = useGame((s) => s.carnetOpen);
  const carnet = useGame((s) => s.carnet);
  const setCarnetOpen = useGame((s) => s.setCarnetOpen);
  const openFromCarnet = useGame((s) => s.openFromCarnet);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center bg-navy-deep/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setCarnetOpen(false)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "tween", duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="px-window flex max-h-[88vh] w-full max-w-4xl flex-col p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-3 text-3xl font-bold">
                <PixelIcon name="book" scale={4} />
                Mon carnet
                <span className="text-sun">
                  {carnet.length}/{JOBS.length}
                </span>
              </h2>
              <button type="button" className="px-btn px-btn-light" onClick={() => setCarnetOpen(false)}>
                Fermer
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
              {ISLANDS.map((island) => {
                const jobs = JOBS.filter((j) => j.islandId === island.id);
                return (
                  <section key={island.id}>
                    <h3 className="mb-2 flex items-center gap-2 text-xl font-bold">
                      <span className="inline-block h-4 w-4" style={{ background: island.color }} />
                      {DISTRICT_BY_ID[island.id].place}
                      <span className="text-base font-semibold text-white/60">· {island.name}</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {jobs.map((job) =>
                        carnet.includes(job.id) ? (
                          <button
                            key={job.id}
                            type="button"
                            onClick={() => openFromCarnet(job.id)}
                            className="px-box flex min-h-36 flex-col items-center justify-center gap-1 p-2 text-center text-ink transition-transform hover:-translate-y-1"
                          >
                            <Character jobId={job.id} scale={4} />
                            <span className="text-sm leading-tight font-bold">{job.title}</span>
                          </button>
                        ) : (
                          <div
                            key={job.id}
                            className="flex min-h-36 items-center justify-center border-4 border-dashed border-white/25"
                          >
                            <PixelIcon name="question" scale={4} tint="rgba(255,255,255,0.35)" />
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
