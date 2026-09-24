import { hash, ISLAND_BY_ID, JOB_BY_ID } from "./content";
import { C, cached, makeCanvas, outline, shade } from "./pixel";

export type Dir = "down" | "up" | "left" | "right";

export type Look = {
  skin: string;
  hair: string;
  style: 0 | 1 | 2 | 3 | "hero";
  outfit: string;
  accent: string;
  pants: string;
};

const SKINS = ["#F3D2B3", "#E0AC84", "#B97A55", "#7A4B32"];
const HAIRS = ["#2B1D14", "#5A3620", "#B8692F", "#1E1B2E", "#7A2E2E"];

/** Character sprite size after outlining (12×16 body + 1px outline). */
export const CHAR_W = 14;
export const CHAR_H = 18;

export const HERO_LOOK: Look = {
  skin: "#E0AC84",
  hair: "#4A2A18",
  style: "hero",
  outfit: "#2EC4C6",
  accent: C.brown,
  pants: C.limestone,
};

export function jobLook(jobId: string): Look {
  const h = hash(jobId);
  const island = ISLAND_BY_ID[JOB_BY_ID[jobId]?.islandId];
  const base = island?.color ?? "#A8C8F0";
  return {
    skin: SKINS[h % SKINS.length],
    hair: HAIRS[(h >> 3) % HAIRS.length],
    style: ((h >> 6) % 4) as 0 | 1 | 2 | 3,
    outfit: shade(base, -0.28),
    accent: (h >> 9) % 2 ? C.limestone : C.sun,
    pants: (h >> 10) % 2 ? C.navy : "#4B5563",
  };
}

function lookKey(l: Look) {
  return `${l.skin}${l.hair}${l.style}${l.outfit}${l.accent}${l.pants}`;
}

/**
 * 16-bit style chibi character, drawn procedurally then outlined.
 * frame 0 = standing, 1/2 = walking steps.
 */
export function characterSprite(look: Look, dir: Dir, frame: 0 | 1 | 2 = 0) {
  return cached(`char|${lookKey(look)}|${dir}|${frame}`, CHAR_W, CHAR_H, (out) => {
    const c = makeCanvas(12, 16);
    const ctx = c.getContext("2d")!;
    const p = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
    };
    const side = dir === "left" || dir === "right";

    // --- legs & shoes
    const lLeg = frame === 1 ? 2 : 3;
    const rLeg = frame === 2 ? 2 : 3;
    p(4, 13, 2, lLeg, look.pants);
    p(6, 13, 2, rLeg, look.pants);
    p(4, 12 + lLeg, 2, 1, "#4A3020");
    p(6, 12 + rLeg, 2, 1, "#4A3020");

    // --- body
    p(3, 8, 6, 5, look.outfit);
    p(3, 11, 6, 1, look.accent);
    if (look.style === "hero") p(5, 11, 2, 1, C.sun);
    p(3, 12, 6, 1, shade(look.outfit, -0.15));
    // arms swing
    const swing = frame === 0 ? 0 : frame === 1 ? -1 : 1;
    if (side) {
      p(dir === "left" ? 7 : 4, 9 + swing, 1, 3, shade(look.outfit, -0.1));
      p(dir === "left" ? 7 : 4, 12 + swing, 1, 1, look.skin);
    } else {
      p(2, 8 + Math.max(0, swing), 1, 3, look.outfit);
      p(9, 8 + Math.max(0, -swing), 1, 3, look.outfit);
      p(2, 11 + Math.max(0, swing), 1, 1, look.skin);
      p(9, 11 + Math.max(0, -swing), 1, 1, look.skin);
    }

    // --- head
    p(2, 1, 8, 7, look.hair);
    if (dir !== "up") {
      if (dir === "down") p(3, 3, 6, 5, look.skin);
      if (dir === "left") p(2, 3, 5, 5, look.skin);
      if (dir === "right") p(5, 3, 5, 5, look.skin);
      p(2, 1, 8, 2, look.hair); // fringe
      const eye = "#1D1A2B";
      if (dir === "down") {
        p(4, 4, 1, 2, eye);
        p(7, 4, 1, 2, eye);
        p(3, 6, 1, 1, "#F09A9A");
        p(8, 6, 1, 1, "#F09A9A");
      } else {
        p(dir === "left" ? 3 : 8, 4, 1, 2, eye);
        p(dir === "left" ? 2 : 9, 6, 1, 1, "#F09A9A");
      }
      p(5, 7, 2, 1, look.skin); // chin
    }

    // --- hairstyles
    switch (look.style) {
      case 0: // bun
        p(4, 0, 4, 1, look.hair);
        break;
      case 1: // long
        if (dir === "down") {
          p(2, 3, 1, 7, look.hair);
          p(9, 3, 1, 7, look.hair);
        } else if (dir === "up") {
          p(2, 7, 8, 3, look.hair);
        } else {
          p(dir === "left" ? 7 : 2, 3, 3, 7, look.hair);
        }
        break;
      case 2: // curly, big volume
        p(1, 0, 10, 3, look.hair);
        if (dir === "down") {
          p(1, 3, 2, 4, look.hair);
          p(9, 3, 2, 4, look.hair);
        } else if (dir === "up") {
          p(1, 3, 10, 5, look.hair);
        } else {
          p(dir === "left" ? 7 : 1, 3, 4, 5, look.hair);
        }
        break;
      case 3: // bob
        if (dir === "down") {
          p(2, 3, 1, 4, look.hair);
          p(9, 3, 1, 4, look.hair);
        } else if (dir !== "up") {
          p(dir === "left" ? 7 : 2, 3, 3, 4, look.hair);
        }
        break;
      case "hero": {
        // pointy adventurer cap, a nod to 16-bit heroes
        const cap = look.outfit;
        p(2, 0, 8, 2, cap);
        p(3, -1 + 1, 6, 1, cap);
        if (dir === "down") {
          p(9, 2, 2, 2, cap);
          p(10, 4, 1, 2, cap);
        } else if (dir === "up") {
          p(2, 1, 8, 4, cap);
          p(5, 5, 2, 3, cap);
        } else {
          const tx = dir === "left" ? 9 : 0;
          p(dir === "left" ? 7 : 2, 1, 3, 3, cap);
          p(tx, 3, 2, 2, cap);
          p(dir === "left" ? 10 : 0, 5, 1, 2, cap);
        }
        p(2, 2, 8, 1, shade(cap, -0.2));
        break;
      }
    }

    out.drawImage(outline(c), 0, 0);
  });
}

/** Tiny ambient city walker (no outline, 3×5). */
export function walkerSprite(col: string, frame: 0 | 1) {
  return cached(`walker|${col}|${frame}`, 3, 5, (ctx) => {
    ctx.fillStyle = "#2B2140";
    ctx.fillRect(1, 0, 1, 1);
    ctx.fillStyle = col;
    ctx.fillRect(0, 1, 3, 2);
    ctx.fillStyle = "#2B2140";
    ctx.fillRect(frame ? 0 : 1, 3, 1, 2);
    ctx.fillRect(frame ? 2 : 1, 3, 1, 2);
  });
}
