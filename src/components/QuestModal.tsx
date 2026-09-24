"use client";

import { AnimatePresence, motion } from "framer-motion";
import { QUESTS } from "@/lib/content";
import { noEmoji } from "@/lib/pixel";
import { currentQuest, useGame } from "@/state/gameStore";
import { PixelIcon, TerraSprite } from "./Pixel";
import SpeakButton from "./SpeakButton";
import Typewriter from "./Typewriter";

/** Quest scroll: shown at the start of each quest and via "Revoir". */
export default function QuestModal() {
  const screen = useGame((s) => s.screen);
  const questOpen = useGame((s) => s.questOpen);
  const quest = useGame(currentQuest);
  const index = useGame((s) => s.questIndex);
  const beginQuest = useGame((s) => s.beginQuest);
  const setQuestOpen = useGame((s) => s.setQuestOpen);

  const open = (screen === "intro" || questOpen) && !!quest;
  const close = () => (screen === "intro" ? beginQuest() : setQuestOpen(false));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center bg-navy-deep/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            key={quest.id}
            initial={{ scaleY: 0.05 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0.05 }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.3 }}
            className="px-scroll w-full max-w-xl px-7 pt-6 pb-7"
          >
            <div className="mb-3 flex items-center justify-center gap-3">
              <PixelIcon name="scroll" scale={4} />
              <span className="text-2xl font-bold text-terracotta-dark">
                QUÊTE {index + 1}/{QUESTS.length}
              </span>
            </div>
            <div className="mb-5 flex items-start gap-3">
              <p className="min-h-24 flex-1 text-2xl leading-snug font-semibold md:text-3xl">
                <Typewriter text={noEmoji(quest.text)} speed={35} />
              </p>
              <SpeakButton text={noEmoji(quest.text)} />
            </div>
            <div className="px-window mb-6 flex items-center gap-3 p-3">
              <TerraSprite scale={3} />
              <span className="text-lg">Trouve la personne qui peut aider !</span>
            </div>
            <div className="text-center">
              <button type="button" className="px-btn px-btn-sun px-10 text-2xl" onClick={close} autoFocus>
                {screen === "intro" ? "C'est parti !" : "OK !"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
