/**
 * Procedural 16-bit people: 20×32 sprites (22×34 once outlined) with real
 * proportions, job outfits, varied hairstyles and skin tones, 4 directions.
 */
import { hash } from "./content";
import { cached, hexToRgb as hexRgb, makeCanvas, outline, shade } from "./pixel";

export type Dir = "down" | "up" | "left" | "right";
export type HairStyle = "short" | "long" | "bun" | "afro" | "braids" | "ponytail" | "hijab";
export type Hat =
  | "none"
  | "hardhat"
  | "ranger"
  | "straw"
  | "cap"
  | "beret"
  | "toque"
  | "beekeeper"
  | "headset"
  | "mask"
  | "hero";
export type Top = "shirt" | "hivis" | "labcoat" | "overalls" | "wetsuit" | "apron" | "jacket" | "dress" | "hoodie" | "tunic";
export type Bottom = "pants" | "shorts" | "skirt";

export type Look = {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  /** Scarf colour when hairStyle is "hijab". */
  scarf: string;
  hat: Hat;
  hatColor: string;
  top: Top;
  topColor: string;
  /** Shirt under a vest/overalls/apron, belt for the hero, stripes... */
  top2: string;
  stripes?: boolean;
  bottom: Bottom;
  bottomColor: string;
  shoes: string;
  glasses?: boolean;
  backpack?: boolean;
};

/** Sprite size once outlined. Feet are at the bottom centre. */
export const CHAR_W = 22;
export const CHAR_H = 34;

const SKINS = ["#F6D5BC", "#E8B892", "#C98D63", "#9C6441", "#6B4028"];
const HAIRS = ["#2A1B14", "#4A2B1A", "#7A4A2A", "#B8692F", "#D9A55A", "#1E1B2E", "#8A3B3B"];
const STYLES: HairStyle[] = ["short", "long", "bun", "afro", "braids", "ponytail"];

const BASE: Omit<Look, "skin" | "hair" | "hairStyle"> = {
  scarf: "#3E8A7A",
  hat: "none",
  hatColor: "#FFFFFF",
  top: "shirt",
  topColor: "#F4EFE3",
  top2: "#F4EFE3",
  bottom: "pants",
  bottomColor: "#2B2D42",
  shoes: "#3B2A20",
};

/** Each job wears her work outfit. */
const OUTFITS: Record<string, Partial<Look>> = {
  "data-scientist-climat": { top: "jacket", topColor: "#3D5A80", glasses: true },
  "developpeuse-appli-sobre": { top: "hoodie", topColor: "#8E6CD1", bottomColor: "#3A3F58", hairStyle: "hijab", scarf: "#8A3B5C" },
  "ingenieure-capteurs": { top: "hivis", topColor: "#F29A38", top2: "#6B7A8F", bottomColor: "#3A4A5C", hat: "hardhat", hatColor: "#F4F4F4" },
  "roboticienne-marine": { top: "overalls", top2: "#E9E4D8", bottomColor: "#2F6FA8", glasses: true },
  "biologiste-marine": { top: "wetsuit", topColor: "#1F2A38", top2: "#3CC7C9", bottomColor: "#1F2A38", shoes: "#1F2A38", hat: "mask" },
  "garde-parc-national": { topColor: "#5E7D4A", bottomColor: "#8A7A56", hat: "ranger", hatColor: "#8A5A3B", backpack: true },
  "responsable-tri-recyclage": { top: "hivis", topColor: "#F7D148", top2: "#3E7C4A", bottomColor: "#2F4F3A", hat: "cap", hatColor: "#3E8A4F" },
  "animatrice-nature": { topColor: "#E58F65", bottom: "shorts", bottomColor: "#8A7A56", backpack: true },
  "ecoconceptrice-objets": { top: "apron", topColor: "#C9A26B", top2: "#F4EFE3", glasses: true },
  "styliste-mode-durable": { top: "dress", topColor: "#D96C8A", top2: "#F7C548", bottom: "skirt", bottomColor: "#D96C8A" },
  "architecte-bioclimatique": { topColor: "#F4F4F4", bottomColor: "#3D5A80", glasses: true },
  "paysagiste-urbaine": { top: "overalls", top2: "#F4EFE3", bottomColor: "#4F8A4B", hat: "straw", hatColor: "#E8C170" },
  "ingenieure-eolien-mer": { top: "hivis", topColor: "#F29A38", top2: "#1B3B6F", bottomColor: "#1B3B6F", hat: "hardhat", hatColor: "#FFFFFF" },
  "installatrice-solaire": { topColor: "#2F6FA8", bottomColor: "#23466E", hat: "hardhat", hatColor: "#F7C548" },
  "ingenieure-bateaux-propres": { top: "jacket", topColor: "#1B3B6F", top2: "#FFFFFF", bottomColor: "#1B3B6F", hat: "cap", hatColor: "#FFFFFF" },
  "urbaniste-mobilite": { top: "jacket", topColor: "#2EA7A9", bottomColor: "#3A3F58", backpack: true },
  "maraichere-bio": { top: "overalls", top2: "#D9643A", bottomColor: "#3E6FA8", hat: "straw", hatColor: "#E8C170", shoes: "#4F8A4B" },
  hydrologue: { top: "labcoat", topColor: "#FFFFFF", top2: "#3CC7C9", glasses: true, hairStyle: "hijab", scarf: "#1B3B6F", shoes: "#F7C548" },
  "cheffe-anti-gaspi": { top: "apron", topColor: "#FFFFFF", top2: "#FFFFFF", hat: "toque" },
  apicultrice: { topColor: "#F4F1E6", bottomColor: "#E9E4D8", hat: "beekeeper", hatColor: "#F4F1E6" },
  "organisatrice-evenements-verts": { topColor: "#2B2140", bottomColor: "#3A3F58", hat: "headset" },
  "decoratrice-spectacles-recup": { top: "overalls", top2: "#F7C548", bottomColor: "#8E6CD1" },
  "journaliste-environnement": { top: "jacket", topColor: "#C9A26B", hairStyle: "hijab", scarf: "#3E8A7A" },
  "illustratrice-planete": { topColor: "#F4EFE3", top2: "#1B3B6F", stripes: true, bottomColor: "#1B3B6F", hat: "beret", hatColor: "#D9643A" },
};

export const HERO_LOOK: Look = {
  ...BASE,
  skin: "#E8B892",
  hair: "#4A2B1A",
  hairStyle: "ponytail",
  hat: "hero",
  hatColor: "#2EC4C6",
  top: "tunic",
  topColor: "#2EC4C6",
  top2: "#8A5A3B",
  bottomColor: "#F4EFE3",
  shoes: "#6B4028",
};

export function jobLook(jobId: string): Look {
  const h = hash(jobId);
  return {
    ...BASE,
    skin: SKINS[h % SKINS.length],
    hair: HAIRS[(h >>> 3) % HAIRS.length],
    hairStyle: STYLES[(h >>> 6) % STYLES.length],
    ...OUTFITS[jobId],
  };
}

/** Anonymous passer-by, for the streets. */
export function passerbyLook(seed: number): Look {
  const h = hash(`walker${seed}`);
  const tops = ["#D9643A", "#3E7DD6", "#F7C548", "#58B368", "#8E6CD1", "#F4EFE3", "#F28BA8", "#2EA7A9"];
  return {
    ...BASE,
    skin: SKINS[h % SKINS.length],
    hair: HAIRS[(h >>> 3) % HAIRS.length],
    hairStyle: [...STYLES, "hijab" as const][(h >>> 6) % 7],
    scarf: tops[(h >>> 12) % tops.length],
    topColor: tops[(h >>> 9) % tops.length],
    bottom: (["pants", "shorts", "skirt"] as const)[(h >>> 14) % 3],
    bottomColor: ["#2B2D42", "#3E6FA8", "#8A7A56", "#F4EFE3"][(h >>> 16) % 4],
  };
}

function key(l: Look) {
  return Object.values(l).join(",");
}

export function characterSprite(look: Look, dir: Dir, frame: 0 | 1 | 2 = 0) {
  return cached(`person|${key(look)}|${dir}|${frame}`, CHAR_W, CHAR_H, (out) => {
    const c = makeCanvas(20, 32);
    draw(c.getContext("2d")!, look, dir === "left" ? "right" : dir, frame);
    if (dir === "left") {
      const f = makeCanvas(20, 32);
      const fx = f.getContext("2d")!;
      fx.translate(20, 0);
      fx.scale(-1, 1);
      fx.drawImage(c, 0, 0);
      out.drawImage(outline(f), 0, 0);
    } else {
      out.drawImage(outline(c), 0, 0);
    }
  });
}

function draw(ctx: CanvasRenderingContext2D, L: Look, dir: "down" | "up" | "right", frame: 0 | 1 | 2) {
  const p = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  const clear = (x: number, y: number) => ctx.clearRect(x, y, 1, 1);
  const dk = (c: string, a = 0.18) => shade(c, -a);
  const lt = (c: string, a = 0.2) => shade(c, a);

  const side = dir === "right";
  const hijab = L.hairStyle === "hijab";
  const sleeve = L.top === "hivis" || L.top === "overalls" || L.top === "apron" ? L.top2 : L.topColor;
  const legCol = L.top === "overalls" || L.top === "wetsuit" ? (L.top === "wetsuit" ? L.topColor : L.bottomColor) : L.bottomColor;
  const lLift = frame === 1 ? 1 : 0;
  const rLift = frame === 2 ? 1 : 0;

  // ---------- hair behind the body
  if (!side) {
    if (L.hairStyle === "long") p(5, 5, 10, dir === "up" ? 13 : 12, L.hair);
    if (L.hairStyle === "braids") {
      p(5, 6, 2, 13, L.hair);
      p(13, 6, 2, 13, L.hair);
      p(5, 19, 2, 1, L.top2);
      p(13, 19, 2, 1, L.top2);
    }
    if (L.hairStyle === "afro") {
      p(4, 1, 12, 11, L.hair);
      p(3, 3, 14, 7, L.hair);
    }
    if (hijab) p(4, 3, 12, 13, L.scarf);
    if (L.hairStyle === "ponytail" && dir === "up") p(9, 10, 2, 7, L.hair);
  } else {
    if (L.hairStyle === "long") p(5, 5, 5, 12, L.hair);
    if (L.hairStyle === "braids") p(6, 6, 2, 13, L.hair);
    if (L.hairStyle === "afro") p(4, 1, 10, 11, L.hair);
    if (L.hairStyle === "ponytail") p(4, 5, 3, 8, L.hair);
    if (hijab) p(5, 3, 9, 13, L.scarf);
  }

  // ---------- legs & shoes
  if (side) {
    // walk cycle seen from the side: the far (darker) leg and the near leg
    // swap between frame 1 and frame 2, so the steps really alternate.
    const legs = L.bottom === "shorts" || L.bottom === "skirt" ? L.skin : legCol;
    const far = frame === 0 ? 8 : frame === 1 ? 6 : 11;
    const near = frame === 0 ? 10 : frame === 1 ? 11 : 6;
    const farLift = frame === 2 ? 1 : 0;
    const leg = (x: number, col: string, shorts: string, lift: number) => {
      p(x, 22, 3, 8 - lift, col);
      if (L.bottom === "shorts") p(x, 22, 3, 3, shorts);
      p(x, 30 - lift, 4, 2, L.shoes);
    };
    leg(far, dk(legs, 0.14), dk(L.bottomColor, 0.14), farLift);
    leg(near, legs, L.bottomColor, 0);
  } else {
    const legs = L.bottom === "shorts" || L.bottom === "skirt" ? L.skin : legCol;
    p(6, 22, 4, 8 - lLift, legs);
    p(10, 22, 4, 8 - rLift, dk(legs, 0.08));
    if (L.bottom === "shorts") {
      p(6, 22, 4, 3, L.bottomColor);
      p(10, 22, 4, 3, dk(L.bottomColor, 0.08));
    }
    p(6, 30 - lLift, 4, 2, L.shoes);
    p(10, 30 - rLift, 4, 2, L.shoes);
  }

  // ---------- torso
  const tx = side ? 7 : 5;
  const tw = side ? 7 : 10;
  const body = L.top === "labcoat" ? L.topColor : L.top === "overalls" ? L.top2 : L.topColor;
  p(tx, 13, tw, 9, body);
  if (L.stripes) for (let y = 14; y < 22; y += 2) p(tx, y, tw, 1, L.top2);
  p(tx + tw - 1, 13, 1, 9, dk(body, 0.12)); // side shading
  p(tx, 13, tw, 1, lt(body, 0.15));

  switch (L.top) {
    case "shirt":
      if (!side && dir === "down") p(8, 13, 4, 1, lt(body, 0.3));
      break;
    case "hivis":
      p(tx, 13, tw, 9, L.topColor);
      p(tx, 17, tw, 1, "#E9EEF2");
      p(tx, 19, tw, 1, "#E9EEF2");
      if (dir === "down") p(9, 13, 2, 4, L.top2);
      break;
    case "labcoat":
      p(tx, 13, tw, 13, L.topColor);
      p(tx + tw - 1, 13, 1, 13, dk(L.topColor, 0.12));
      if (dir === "down") p(9, 14, 2, 12, L.top2);
      break;
    case "overalls":
      if (dir === "down") {
        p(7, 16, 6, 6, L.bottomColor);
        p(7, 13, 1, 3, L.bottomColor);
        p(12, 13, 1, 3, L.bottomColor);
        p(9, 17, 2, 2, dk(L.bottomColor, 0.2));
      } else if (dir === "up") {
        p(5, 17, 10, 5, L.bottomColor);
        p(7, 13, 1, 4, L.bottomColor);
        p(12, 13, 1, 4, L.bottomColor);
      } else {
        p(tx, 16, tw, 6, L.bottomColor);
      }
      break;
    case "wetsuit":
      p(tx, 13, tw, 9, L.topColor);
      p(tx, 13, 1, 9, L.top2);
      p(tx + tw - 1, 13, 1, 9, L.top2);
      break;
    case "apron":
      if (dir !== "up") p(side ? 11 : 6, 15, side ? 3 : 8, 11, L.topColor);
      if (dir === "up") p(9, 18, 2, 1, L.topColor);
      break;
    case "jacket":
      if (dir === "down") {
        p(9, 13, 2, 9, L.top2);
        p(8, 13, 1, 3, lt(L.topColor, 0.25));
        p(11, 13, 1, 3, lt(L.topColor, 0.25));
      }
      break;
    case "dress":
      if (dir === "down") p(8, 13, 4, 1, L.top2);
      break;
    case "hoodie":
      if (dir === "down") p(7, 18, 6, 2, dk(L.topColor, 0.15));
      if (dir === "up") p(7, 13, 6, 3, dk(L.topColor, 0.2));
      break;
    case "tunic":
      p(tx, 22, tw, 3, L.topColor);
      p(tx, 20, tw, 1, L.top2);
      if (dir !== "up") p(side ? 11 : 9, 20, 2, 1, "#F7C548");
      break;
  }
  if (L.bottom === "skirt") {
    p(side ? 6 : 4, 21, side ? 9 : 12, 4, L.bottomColor);
    p(side ? 6 : 4, 24, side ? 9 : 12, 1, dk(L.bottomColor, 0.15));
  }
  if (L.backpack) {
    if (dir === "down") {
      p(6, 13, 1, 6, "#6B4028");
      p(13, 13, 1, 6, "#6B4028");
    } else if (dir === "up") {
      p(6, 14, 8, 8, "#8A5A3B");
      p(6, 14, 8, 1, "#A87447");
    } else {
      p(4, 14, 3, 7, "#8A5A3B");
    }
  }

  // ---------- arms (swing while walking)
  const sw = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  if (side) {
    // the near arm swings forward/back, opposite to the near leg
    const ax = frame === 0 ? 9 : frame === 1 ? 8 : 11;
    p(ax, 13, 3, 8, dk(sleeve, 0.05));
    p(ax, 21, 3, 1, L.skin);
  } else {
    p(3, 13 + sw, 2, 8, sleeve);
    p(15, 13 - sw, 2, 8, dk(sleeve, 0.1));
    p(3, 21 + sw, 2, 1, L.skin);
    p(15, 21 - sw, 2, 1, L.skin);
  }

  // ---------- neck & head
  p(9, 12, 2, 1, dk(L.skin, 0.12));
  const hx = side ? 7 : 6;
  const hw = side ? 7 : 8;
  p(hx, 3, hw, 9, L.skin);
  clear(hx, 3);
  clear(hx + hw - 1, 3);
  clear(hx, 11);
  clear(hx + hw - 1, 11);
  if (dir === "down" && !hijab) {
    p(5, 7, 1, 2, L.skin);
    p(14, 7, 1, 2, L.skin);
  }

  // face
  const eye = "#231C33";
  const [sr, sg, sb] = hexRgb(L.skin);
  const darkSkin = sr * 0.3 + sg * 0.59 + sb * 0.11 < 130;
  const glint = (x: number, y: number) => darkSkin && p(x, y, 1, 1, "#FFFFFF");
  if (dir === "down") {
    p(8, 7, 1, 2, eye);
    p(11, 7, 1, 2, eye);
    glint(8, 7);
    glint(11, 7);
    p(7, 9, 1, 1, shade(L.skin, -0.12));
    p(12, 9, 1, 1, shade(L.skin, -0.12));
    p(9, 10, 2, 1, dk(L.skin, 0.28));
    if (L.glasses) {
      p(7, 6, 3, 1, eye);
      p(10, 6, 3, 1, eye);
      p(7, 9, 3, 1, eye);
      p(10, 9, 3, 1, eye);
      p(7, 7, 1, 2, eye);
      p(12, 7, 1, 2, eye);
    }
  } else if (side) {
    p(12, 7, 1, 2, eye);
    glint(12, 7);
    p(12, 10, 1, 1, dk(L.skin, 0.28));
    p(13, 8, 1, 1, dk(L.skin, 0.1));
    if (L.glasses) {
      p(11, 6, 3, 1, eye);
      p(11, 9, 3, 1, eye);
    }
  }

  // ---------- hair in front / on top
  const H = L.hair;
  const hl = lt(H, 0.25);
  if (hijab) {
    if (dir === "down") {
      p(5, 2, 10, 3, L.scarf);
      p(5, 4, 2, 9, L.scarf);
      p(13, 4, 2, 9, L.scarf);
      p(6, 11, 8, 2, L.scarf);
      p(6, 2, 8, 1, lt(L.scarf, 0.2));
    } else if (dir === "up") {
      p(5, 2, 10, 12, L.scarf);
    } else {
      p(6, 2, 8, 3, L.scarf);
      p(6, 4, 4, 9, L.scarf);
      p(8, 11, 6, 2, L.scarf);
    }
  } else if (dir === "up") {
    p(6, 2, 8, 10, H);
    p(7, 2, 5, 1, hl);
    if (L.hairStyle === "bun") p(8, 0, 4, 3, H);
    if (L.hairStyle === "afro") p(4, 1, 12, 11, H);
  } else if (side) {
    p(7, 2, 7, 3, H);
    p(7, 4, 3, 6, H);
    p(8, 2, 4, 1, hl);
    if (L.hairStyle === "bun") p(6, 1, 3, 3, H);
    if (L.hairStyle === "afro") p(5, 1, 9, 4, H);
    if (L.hairStyle === "short") p(7, 4, 2, 4, H);
  } else {
    p(6, 2, 8, 3, H);
    p(7, 2, 5, 1, hl);
    switch (L.hairStyle) {
      case "short":
        p(5, 4, 2, 4, H);
        p(13, 4, 2, 4, H);
        p(7, 5, 3, 1, H);
        break;
      case "long":
        p(5, 4, 2, 9, H);
        p(13, 4, 2, 9, H);
        p(7, 5, 2, 1, H);
        break;
      case "bun":
        p(8, 0, 4, 2, H);
        p(5, 4, 1, 3, H);
        p(14, 4, 1, 3, H);
        break;
      case "afro":
        p(4, 1, 12, 5, H);
        p(4, 5, 2, 5, H);
        p(14, 5, 2, 5, H);
        break;
      case "braids":
        p(5, 4, 2, 3, H);
        p(13, 4, 2, 3, H);
        p(9, 2, 1, 2, dk(H, 0.3));
        break;
      case "ponytail":
        p(5, 4, 1, 4, H);
        p(14, 4, 1, 4, H);
        p(15, 5, 2, 6, H);
        break;
    }
  }

  // ---------- hats
  const hc = L.hatColor;
  const hx0 = side ? 6 : 5;
  const hw0 = side ? 9 : 10;
  switch (L.hat) {
    case "hardhat":
      p(hx0, 1, hw0, 4, hc);
      p(hx0 + 2, 1, 3, 1, lt(hc, 0.4));
      p(hx0 - 1, 4, hw0 + 2, 1, dk(hc, 0.15));
      break;
    case "ranger":
    case "straw":
      p(hx0 + 1, 0, hw0 - 2, 4, hc);
      p(hx0 + 1, 3, hw0 - 2, 1, L.hat === "ranger" ? "#5A3A22" : "#D9643A");
      p(hx0 - 2, 4, hw0 + 4, 1, dk(hc, 0.12));
      break;
    case "cap":
      p(hx0 + 1, 1, hw0 - 2, 3, hc);
      if (dir === "down") p(6, 4, 8, 1, dk(hc, 0.2));
      if (side) p(12, 4, 4, 1, dk(hc, 0.2));
      break;
    case "beret":
      p(hx0, 1, hw0 - 2, 3, hc);
      p(hx0 - 1, 2, 2, 2, hc);
      p(hx0 + 4, 0, 1, 1, dk(hc, 0.2));
      break;
    case "toque":
      p(hx0 + 1, 0, hw0 - 2, 4, hc);
      p(hx0, 0, 2, 3, hc);
      p(hx0 + hw0 - 2, 0, 2, 3, hc);
      p(hx0 + 1, 4, hw0 - 2, 1, dk(hc, 0.1));
      break;
    case "beekeeper":
      p(hx0 + 1, 0, hw0 - 2, 3, hc);
      p(hx0 - 2, 3, hw0 + 4, 1, dk(hc, 0.1));
      if (dir !== "up") {
        for (let y = 4; y < 13; y++)
          for (let x = side ? 7 : 5; x < (side ? 15 : 15); x++) if ((x + y) % 2 === 0) p(x, y, 1, 1, "rgba(60,60,70,0.55)");
      }
      break;
    case "headset":
      p(6, 2, 8, 1, "#2B2140");
      if (!side) {
        p(5, 6, 1, 3, "#2B2140");
        p(14, 6, 1, 3, "#2B2140");
        if (dir === "down") p(12, 10, 2, 1, "#2B2140");
      } else {
        p(9, 6, 2, 3, "#2B2140");
        p(11, 10, 3, 1, "#2B2140");
      }
      break;
    case "mask":
      p(hx0 + 1, 4, hw0 - 2, 2, L.top2);
      if (dir !== "up") p(side ? 11 : 7, 4, side ? 3 : 6, 2, "#BFEFF0");
      break;
    case "hero":
      p(hx0, 0, hw0, 4, hc);
      p(hx0 + 2, 0, 4, 1, lt(hc, 0.3));
      p(hx0, 4, hw0, 1, dk(hc, 0.2));
      if (dir === "down") {
        p(15, 2, 2, 3, hc);
        p(16, 5, 2, 3, dk(hc, 0.1));
      } else if (dir === "up") {
        p(8, 4, 4, 4, dk(hc, 0.1));
      } else {
        p(3, 2, 3, 3, hc);
        p(2, 5, 2, 3, dk(hc, 0.1));
      }
      break;
  }
}
