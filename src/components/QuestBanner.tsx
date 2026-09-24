"use client";

import { QUESTS } from "@/lib/content";
import { noEmoji } from "@/lib/pixel";
import { currentQuest, useGame } from "@/state/gameStore";
import { PixelIcon } from "./Pixel";
import SpeakButton from "./SpeakButton";

export default function QuestBanner() {
  const quest = useGame(currentQuest);
  const index = useGame((s) => s.questIndex);
  const solved = useGame((s) => (quest ? s.solved.includes(quest.id) : false));
  const setQuestOpen = useGame((s) => s.setQuestOpen);
  const nextQuest = useGame((s) => s.nextQuest);
  if (!quest) return null;
  const text = noEmoji(quest.text);

  return (
    <div className="px-scroll pointer-events-auto flex max-w-[660px] items-center gap-3 px-4 py-2">
      <PixelIcon name={solved ? "check" : "scroll"} scale={4} tint={solved ? "#2F6B3E" : undefined} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-terracotta-dark">
          QUÊTE {index + 1}/{QUESTS.length}
        </div>
        <p className="line-clamp-2 text-base leading-tight font-semibold md:text-lg">{text}</p>
      </div>
      <SpeakButton text={text} />
      {solved ? (
        <button type="button" onClick={nextQuest} className="px-btn px-btn-sun min-h-12 px-3 text-base">
          {index + 1 >= QUESTS.length ? "Fin" : "Suivante"}
          <PixelIcon name="arrow" flip scale={2} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setQuestOpen(true)}
          className="px-btn px-btn-light hidden min-h-12 px-3 text-base md:inline-flex"
        >
          Revoir
        </button>
      )}
    </div>
  );
}
