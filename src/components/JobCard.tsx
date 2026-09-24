import { motion } from "framer-motion";
import type { Landing } from "../types";
import type { GuideAnswer } from "../lib/guideClient";
import { speak } from "../lib/speech";

function Avatar({ id }: { id: string }) {
  const hash = [...id].reduce((n, char) => n + char.charCodeAt(0), 0);
  const skins = ["#8d5336", "#c78354", "#eab08b", "#f3c8a7"];
  const hair = ["#322437", "#493029", "#6c3d24", "#251d28"];
  return <svg className="avatar" viewBox="0 0 180 170" role="img" aria-label="Illustration d'une femme">
    <ellipse cx="90" cy="166" rx="69" ry="48" fill="#ffffff" opacity=".85" />
    <path d="M53 81 Q45 17 93 17 Q142 17 129 86 L135 124 Q90 151 46 124Z" fill={hair[hash % 4]} />
    <ellipse cx="90" cy="81" rx="39" ry="49" fill={skins[hash % 4]} />
    <path d="M51 72 Q40 19 85 23 Q143 19 130 68 Q119 58 117 47 Q84 70 51 72" fill={hair[hash % 4]} />
    <circle cx="76" cy="83" r="2.5" fill="#3b3355" /><circle cx="106" cy="83" r="2.5" fill="#3b3355" />
    <path d="M82 104 Q91 112 101 103" fill="none" stroke="#8d4f50" strokeWidth="3" strokeLinecap="round" />
    <path d="M56 138 Q90 111 124 138 L142 170 H38Z" fill="#655886" />
  </svg>;
}

export function JobCard({ landing, answer, loading, correct, onClose, onNext }: {
  landing: Landing; answer: GuideAnswer | null; loading: boolean; correct: boolean;
  onClose: () => void; onNext: () => void;
}) {
  const { island, zone, job } = landing;
  return <motion.aside className="card" initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }} transition={{ type: "spring", damping: 28, stiffness: 250 }} aria-label={`Fiche métier : ${job.title}`}>
    <button className="card-close" onClick={onClose} aria-label="Fermer la fiche">✕</button>
    <div className="breadcrumb">{island.name} › {zone.name}</div>
    <h2>{job.title}</h2>
    <div className="illustration" style={{ background: `linear-gradient(145deg, ${island.color}, #fff8ee)` }}>
      {job.image ? <img src={job.image} alt={`Illustration de ${job.title}`} /> : <><Avatar id={job.id} /><span className="job-emoji">{job.emoji}</span><span className="island-emoji">{island.icon}</span></>}
    </div>
    <div className="card-section pitch"><div><span className="eyebrow">SON MÉTIER</span><p>{job.pitch}</p></div><button className="listen" onClick={() => speak(job.pitch)} aria-label="Écouter la description">🔊 <span>Écouter</span></button></div>
    <div className="card-section"><span className="eyebrow">CE QU'ELLE FAIT</span><ul>{job.missions.map((mission) => <li key={mission}>{mission}</li>)}</ul></div>
    <div className="card-section"><span className="eyebrow">🌍 POUR LA PLANÈTE</span><p>{job.impact}</p></div>
    <div className="card-section"><span className="eyebrow">POUR FAIRE CE MÉTIER</span><p>{job.howTo}</p></div>
    <div className="guide"><span className="guide-face">🌱</span><div className="guide-text"><strong>Terra te dit…</strong><p aria-live="polite">{loading ? "Terra réfléchit…" : answer?.text}</p>{!loading && answer && <button className="listen" onClick={() => speak(answer.text)} aria-label="Écouter Terra">🔊 Écouter</button>}</div></div>
    <div className="card-actions"><button className="pill" onClick={onClose}>Explorer l'île</button>{correct && <button className="primary" onClick={onNext}>Quête suivante →</button>}</div>
  </motion.aside>;
}