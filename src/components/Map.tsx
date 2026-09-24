import { motion } from "framer-motion";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { content, type Island, type Job } from "../types";

const islandPath = "M -110 -12 C -116 -48 -82 -74 -42 -68 C -13 -89 17 -67 40 -72 C 82 -76 115 -48 107 -13 C 133 18 94 57 63 58 C 34 77 6 62 -21 67 C -62 77 -105 49 -110 -12 Z";

type Props = {
  selected: Island | null;
  visited: string[];
  highlight: string | null;
  onIsland: (id: string) => void;
  onBack: () => void;
  onJob: (job: Job) => void;
  traveling: string | null;
};

export function Map({ selected, visited, highlight, onIsland, onBack, onJob, traveling }: Props) {
  return <div className="map-shell">
    {!selected ? <TransformWrapper initialScale={1} minScale={0.8} maxScale={2} centerOnInit wheel={{ disabled: true }} panning={{ disabled: true }}>
      <TransformComponent wrapperClass="world-wrapper" contentClass="world-content">
        <svg className="world-svg" viewBox="0 0 1000 600" role="img" aria-label="Carte des îles de métiers">
          <defs><pattern id="waves" width="110" height="85" patternUnits="userSpaceOnUse"><path d="M8 20 Q25 8 42 20 M65 65 Q82 53 99 65" fill="none" stroke="#b5dde9" strokeWidth="3" strokeLinecap="round" opacity=".65" /></pattern></defs>
          <rect width="1000" height="600" fill={content.meta.sea} />
          <rect width="1000" height="600" fill="url(#waves)" />
          {content.islands.map((island) => <g key={island.id} className={"island-group" + (highlight === island.id ? " highlighted" : "")} onClick={() => onIsland(island.id)} role="button" tabIndex={0} aria-label={`Explorer ${island.name}. ${island.description}`} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onIsland(island.id); } }} transform={`translate(${island.position.x} ${island.position.y})`}>
            <title>{island.description}</title>
            <path className="island-shape" d={islandPath} fill={island.color} />
            <text y="-5" textAnchor="middle" fontSize="37">{island.icon}</text>
            <text y="27" textAnchor="middle" className="island-label">{island.name}</text>
          </g>)}
          <text x="500" y="300" textAnchor="middle" className="sea-label">LA MER DES POSSIBLES</text>
        </svg>
      </TransformComponent>
    </TransformWrapper> : <motion.div className="island-detail" key={selected.id} initial={{ opacity: 0, scale: .88 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .4 }}>
      <div className="detail-heading">
        <button className="pill back" onClick={onBack}>← Vers le monde</button>
        <div className="detail-title"><span>{selected.icon}</span><div><h2>{selected.name}</h2><p>{selected.description}</p></div></div>
      </div>
      <div className="island-stage" style={{ backgroundColor: selected.color }}>
        {selected.zones.map((zone, z) => <div className={`zone zone-${z}`} key={zone.id}>
          <div className="zone-name">{zone.name}</div>
          {zone.jobs.map((job) => <button
            key={job.id}
            className={"job-pin" + (visited.includes(job.id) ? " visited" : "") + (traveling === job.id ? " landing" : "")}
            style={{ left: `${job.position.x}%`, top: `${job.position.y}%` }}
            onClick={() => onJob(job)}
            title={job.title}
            aria-label={`${job.title}${visited.includes(job.id) ? ", découvert" : ""}`}
          ><span>{job.emoji}</span><small>{visited.includes(job.id) ? "✓" : "＋"}</small><span className="pin-tooltip">{job.title}</span></button>)}
        </div>)}
        {traveling && <motion.span className="traveler" initial={{ x: -160, y: 100, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} transition={{ duration: .8 }}>⛵</motion.span>}
      </div>
      <div className="neighbors"><span>Explorer une autre île</span>{content.islands.filter((i) => i.id !== selected.id).map((i) => <button key={i.id} style={{ background: i.color }} title={i.name} aria-label={`Aller à ${i.name}`} onClick={() => onIsland(i.id)}>{i.icon}</button>)}</div>
    </motion.div>}
  </div>;
}