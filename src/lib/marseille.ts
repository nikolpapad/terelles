import { ISLAND_BY_ID, ISLANDS, JOB_BY_ID, type JobRef } from "./content";

/** The map is 1600×1000 world pixels, north up, sea to the west and south. */
export const MAP_W = 1600;
export const MAP_H = 1000;

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

export type District = {
  /** Same id as the sector ("island") in content.json. */
  id: string;
  /** The Marseille landmark that hosts this sector. */
  place: string;
  box: Rect;
  /** Where each zone's people stand, in content order. */
  zones: Pt[];
};

/** Each job sector lives around a famous Marseille landmark, with room to breathe. */
export const DISTRICTS: District[] = [
  {
    id: "energie",
    place: "Le Grand Port",
    box: { x: 320, y: 30, w: 420, h: 270 },
    zones: [{ x: 440, y: 240 }, { x: 630, y: 240 }],
  },
  {
    id: "tech",
    place: "La Joliette",
    box: { x: 770, y: 100, w: 360, h: 240 },
    zones: [{ x: 890, y: 300 }, { x: 1050, y: 300 }],
  },
  {
    id: "design",
    place: "Le MuCEM",
    box: { x: 310, y: 330, w: 410, h: 180 },
    zones: [{ x: 520, y: 478 }, { x: 660, y: 470 }],
  },
  {
    id: "agri",
    place: "Noailles",
    box: { x: 770, y: 440, w: 330, h: 230 },
    zones: [{ x: 860, y: 640 }, { x: 1020, y: 640 }],
  },
  {
    id: "culture",
    place: "Le Vélodrome",
    box: { x: 870, y: 700, w: 360, h: 190 },
    zones: [{ x: 940, y: 870 }, { x: 1100, y: 876 }],
  },
  {
    id: "ecologie",
    place: "Les Calanques",
    box: { x: 1235, y: 760, w: 345, h: 200 },
    zones: [{ x: 1310, y: 880 }, { x: 1480, y: 870 }],
  },
];

export const DISTRICT_BY_ID: Record<string, District> = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));

/** Where the hero starts: the Vieux-Port south quay. */
export const START: Pt = { x: 540, y: 628 };

/** Named places shown on the overview map (not interactive). */
export const LANDMARKS = [
  { name: "Vieux-Port", x: 500, y: 560 },
  { name: "Notre-Dame de la Garde", x: 580, y: 800 },
  { name: "Château d'If", x: 300, y: 505 },
  { name: "Îles du Frioul", x: 160, y: 600 },
  { name: "Plages du Prado", x: 700, y: 930 },
  { name: "Palais Longchamp", x: 1240, y: 455 },
  { name: "Massif de l'Étoile", x: 1400, y: 150 },
];

/** Spacing between the two people of a zone. */
const PAIR = 36;

/** Feet position of a job's person. */
export function jobPos(job: JobRef): Pt {
  const island = ISLAND_BY_ID[job.islandId];
  const d = DISTRICT_BY_ID[job.islandId];
  const zi = island.zones.findIndex((z) => z.id === job.zoneId);
  const zone = island.zones[zi];
  const ji = zone.jobs.findIndex((j) => j.id === job.id);
  const n = zone.jobs.length;
  const c = d.zones[zi];
  return { x: c.x + (ji - (n - 1) / 2) * PAIR * 2, y: c.y + (ji % 2 ? 6 : 0) };
}

export type ZoneArea = { id: string; name: string; districtId: string; box: Rect; center: Pt };

/** Zone areas: around their people, with room for the item bubbles. */
export const ZONES: ZoneArea[] = ISLANDS.flatMap((island) =>
  island.zones.map((zone, zi) => {
    const pts = zone.jobs.map((j) => jobPos(JOB_BY_ID[j.id]));
    const minX = Math.min(...pts.map((p) => p.x)) - 34;
    const maxX = Math.max(...pts.map((p) => p.x)) + 34;
    const minY = Math.min(...pts.map((p) => p.y)) - 66;
    const maxY = Math.max(...pts.map((p) => p.y)) + 14;
    return {
      id: zone.id,
      name: zone.name,
      districtId: island.id,
      box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      center: DISTRICT_BY_ID[island.id].zones[zi],
    };
  }),
);

export const inRect = (r: Rect, x: number, y: number) =>
  x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
