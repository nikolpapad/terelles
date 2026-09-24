import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { content, type Island, type Job, type Landing } from "./types";
import { useGame } from "./state/gameStore";
import { Map } from "./components/Map";
import { JobCard } from "./components/JobCard";
import { askGuide, type GuideAnswer } from "./lib/guideClient";
import { speak } from "./lib/speech";

function findLanding(jobId: string): Landing | null {
  for (const island of content.islands) for (const zone of island.zones) {
    const job = zone.jobs.find((j) => j.id === jobId);
    if (job) return { island, zone, job };
  }
  return null;
}

export default function App() {
  const game = useGame();
  const quest = content.quests[game.questIndex];
  const selected = content.islands.find((i) => i.id === game.islandId) ?? null;
  const landing = game.jobId ? findLanding(game.jobId) : null;
  const [answer, setAnswer] = useState<GuideAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [traveling, setTraveling] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const requestId = useRef(0);
  const travelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (game.jobId) game.chooseJob(null); else if (game.carnetOpen) game.setCarnet(false); else game.setIntro(false); }
      if (event.key === "Backspace" && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); game.chooseIsland(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game]);

  useEffect(() => {
    if (game.screen !== "play") return;
    let warning: ReturnType<typeof setTimeout>, reset: ReturnType<typeof setTimeout>;
    const restart = () => {
      clearTimeout(warning); clearTimeout(reset);
      setIdle(false);
      warning = setTimeout(() => { setIdle(true); reset = setTimeout(() => { useGame.getState().reset(); setIdle(false); }, 15000); }, 90000);
    };
    const events = ["pointerdown", "pointermove", "keydown", "scroll"];
    events.forEach((event) => window.addEventListener(event, restart));
    restart();
    return () => { clearTimeout(warning); clearTimeout(reset); events.forEach((event) => window.removeEventListener(event, restart)); };
  }, [game.screen]);

  useEffect(() => () => { if (travelTimer.current) clearTimeout(travelTimer.current); }, []);

  const openJob = (job: Job) => {
    if (!selected || traveling) return;
    const target = { island: selected, zone: selected.zones.find((z) => z.jobs.some((j) => j.id === job.id))!, job };
    requestId.current++;
    game.chooseJob(null);
    setAnswer(null);
    setTraveling(job.id);
    travelTimer.current = setTimeout(async () => {
      setTraveling(null);
      const correct = quest.answers.includes(job.id);
      const wasSolved = useGame.getState().solved;
      const attempt = game.land(job.id, selected.id, correct);
      if (correct && !wasSolved) confetti({ particleCount: 90, spread: 75, origin: { y: .65 } });
      const current = ++requestId.current;
      setLoading(true);
      const response = await askGuide(quest, target, correct, attempt);
      if (requestId.current === current) { setAnswer(response); setLoading(false); }
    }, 800);
  };

  const closeCard = () => { requestId.current++; game.chooseJob(null); setAnswer(null); };
  const changeIsland = (id: string | null) => { if (travelTimer.current) clearTimeout(travelTimer.current); setTraveling(null); closeCard(); game.chooseIsland(id); };
  const nextQuest = () => { closeCard(); game.next(); };
  const correct = !!landing && quest.answers.includes(landing.job.id);
  const targetHighlight = (game.attempts[quest?.id] ?? 0) >= 3 ? quest.targetIsland : null;

  if (game.screen === "start") return <main className="start-screen">
    <div className="start-decoration">🌊 <span>🏝️</span> 🐚</div>
    <div className="start-card"><div className="brand">TERR'ELLES <span>présente</span></div><div className="start-icon">🧭</div><h1>Terr'<em>Îles</em></h1><p>Explore les îles. Découvre des métiers qui aident la planète !</p><button className="primary big" onClick={game.start}>Commencer l'aventure →</button><button className="text-button" onClick={() => game.setHow(true)}>Comment jouer ?</button></div>
    {game.howOpen && <div className="overlay"><div className="modal"><button className="modal-close" onClick={() => game.setHow(false)} aria-label="Fermer">✕</button><h2>Comment jouer ?</h2><p>1. Choisis une île 🏝️</p><p>2. Découvre un métier 🔎</p><p>3. Aide à résoudre la quête 🌍</p><button className="primary" onClick={() => game.setHow(false)}>J'ai compris !</button></div></div>}
  </main>;

  if (game.screen === "end") {
    const top = [...content.islands].sort((a, b) => (game.visits[b.id] ?? 0) - (game.visits[a.id] ?? 0)).filter((i) => game.visits[i.id]).slice(0, 2);
    return <main className="end-screen"><div className="end-card"><div className="end-stars">⭐ 🎉 ⭐</div><h1>Bravo !</h1><p>Tu as aidé la planète, île après île.</p><div className="stats"><div><strong>{content.quests.length}</strong><span>quêtes résolues</span></div><div><strong>{game.visited.length}</strong><span>métiers découverts</span></div></div>{top.length > 0 && <><h2>Tes îles préférées</h2><div className="top-islands">{top.map((i) => <span key={i.id} style={{ background: i.color }}>{i.icon} {i.name}</span>)}</div></>}<button className="primary big" onClick={() => { game.reset(); game.start(); }}>Rejouer ↺</button><a href="https://www.terrelles.com/" target="_blank" rel="noreferrer">Découvrir TERR'ELLES ↗</a></div></main>;
  }

  return <main className="game-screen">
    <header className="topbar"><div className="logo">🌊 Terr'<em>Îles</em></div><div className="top-actions"><button className="pill" onClick={() => game.setCarnet(true)}>📒 Mon carnet <span className="count">{game.visited.length}</span></button></div></header>
    <div className="quest-banner"><div className="quest-number">QUÊTE {game.questIndex + 1} / {content.quests.length}</div><div className="quest-copy"><span>{quest.emoji}</span><strong>{quest.text}</strong></div><div className="quest-tools"><button className="listen" onClick={() => speak(quest.text)}>🔊 <span>Écouter</span></button><button className="text-button" onClick={() => game.setIntro(true)}>Revoir la quête</button></div></div>
    <div className="map-area"><Map selected={selected} visited={game.visited} highlight={targetHighlight} onIsland={changeIsland} onBack={() => changeIsland(null)} onJob={openJob} traveling={traveling} /></div>
    <div className="map-hint">{selected ? "Choisis un métier pour voir ce qu'elle fait !" : "Clique sur une île pour commencer à explorer !"}</div>
    <AnimatePresence>{landing && !game.carnetOpen && <JobCard key={landing.job.id} landing={landing} answer={answer} loading={loading} correct={correct} onClose={closeCard} onNext={nextQuest} />}</AnimatePresence>
    {game.introOpen && <div className="overlay"><motion.div className="modal" initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><span className="modal-emoji">{quest.emoji}</span><span className="eyebrow">QUÊTE {game.questIndex + 1} / {content.quests.length}</span><h2>{quest.text}</h2><button className="listen" onClick={() => speak(quest.text)}>🔊 Écouter</button><button className="primary" onClick={() => game.setIntro(false)}>C'est parti ! →</button></motion.div></div>}
    {game.carnetOpen && <div className="overlay" onClick={() => game.setCarnet(false)}><div className="carnet" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => game.setCarnet(false)} aria-label="Fermer le carnet">✕</button><h2>📒 Mon carnet</h2><p>Les métiers que tu as découverts</p>{content.islands.map((island: Island) => { const jobs = island.zones.flatMap((z) => z.jobs).filter((j) => game.visited.includes(j.id)); return jobs.length ? <section key={island.id}><h3>{island.icon} {island.name}</h3><div className="carnet-grid">{jobs.map((job) => <button key={job.id} onClick={() => { game.chooseIsland(island.id); game.setCarnet(false); game.chooseJob(job.id); setAnswer(null); setLoading(false); }}><span>{job.emoji}</span>{job.title}</button>)}</div></section> : null; })}{game.visited.length === 0 && <p>Ton carnet attend tes découvertes !</p>}</div></div>}
    {idle && <div className="overlay"><div className="modal"><span className="modal-emoji">👋</span><h2>Tu es toujours là ?</h2><p>Appuie pour continuer l'aventure !</p><button className="primary" onClick={() => setIdle(false)}>Oui, je suis là !</button></div></div>}
  </main>;
}