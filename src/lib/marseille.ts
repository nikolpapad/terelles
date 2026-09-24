import { ISLAND_BY_ID, ISLANDS, JOB_BY_ID, type JobRef } from "./content";

/** The map is 600×300 "art pixels", north up, sea to the west and south. */
export const MAP_W = 600;
export const MAP_H = 300;

export type Rect = { x: number; y: number; w: number; h: number };

export type District = {
  /** Same id as the sector ("island") in content.json. */
  id: string;
  /** The Marseille landmark that hosts this sector. */
  place: string;
  box: Rect;
  /** Extra clickable area for a landmark drawn outside the job box. */
  landmark?: Rect;
};

/** Each job sector lives around a famous Marseille landmark. */
export const DISTRICTS: District[] = [
  { id: "energie", place: "Le Grand Port", box: { x: 110, y: 4, w: 80, h: 62 } },
  {
    id: "tech",
    place: "La Joliette",
    box: { x: 210, y: 34, w: 80, h: 64 },
    landmark: { x: 290, y: 32, w: 14, h: 38 },
  },
  {
    id: "design",
    place: "Le MuCEM",
    box: { x: 134, y: 68, w: 74, h: 56 },
    landmark: { x: 100, y: 94, w: 34, h: 32 },
  },
  { id: "agri", place: "Noailles", box: { x: 250, y: 118, w: 80, h: 64 } },
  {
    id: "culture",
    place: "Le Vélodrome",
    box: { x: 286, y: 184, w: 70, h: 64 },
    landmark: { x: 356, y: 193, w: 40, h: 27 },
  },
  { id: "ecologie", place: "Les Calanques", box: { x: 392, y: 222, w: 80, h: 58 } },
];

export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));

/** Where the hero starts: the Vieux-Port quay. */
export const START = { x: 160, y: 146 };

/** Non-interactive landmarks, labelled on the overview map. */
export const LANDMARKS = [
  { name: "Vieux-Port", x: 146, y: 133 },
  { name: "Notre-Dame de la Garde", x: 190, y: 198 },
  { name: "Château d'If", x: 80, y: 124 },
  { name: "Plages du Prado", x: 175, y: 244 },
];

/**
 * Where a job's NPC stands (feet). NPCs of a district stand in one staggered
 * row, zone by zone, so their item bubbles never overlap at any zoom.
 */
export function jobPos(job: JobRef) {
  const b = DISTRICT_BY_ID[job.islandId].box;
  const ids = ISLAND_BY_ID[job.islandId].zones.flatMap((z) => z.jobs.map((j) => j.id));
  const i = ids.indexOf(job.id);
  return { x: b.x + (b.w * (i + 0.5)) / ids.length, y: b.y + b.h * 0.62 + (i % 2 ? 4 : 0) };
}

export type ZoneArea = { id: string; name: string; districtId: string; box: Rect };

/** Zone areas: bounding box of their jobs, padded. */
export const ZONES: ZoneArea[] = ISLANDS.flatMap((island) =>
  island.zones.map((zone) => {
    const pts = zone.jobs.map((j) => jobPos(JOB_BY_ID[j.id]));
    const minX = Math.min(...pts.map((p) => p.x)) - 14;
    const maxX = Math.max(...pts.map((p) => p.x)) + 14;
    const minY = Math.min(...pts.map((p) => p.y)) - 38;
    const maxY = Math.max(...pts.map((p) => p.y)) + 8;
    return {
      id: zone.id,
      name: zone.name,
      districtId: island.id,
      box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    };
  }),
);

export const inDistrict = (d: District, x: number, y: number) =>
  inRect(d.box, x, y) || (!!d.landmark && inRect(d.landmark, x, y));

export const inRect = (r: Rect, x: number, y: number) =>
  x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
