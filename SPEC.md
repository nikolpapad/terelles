# Terr'Îles — Functional Specification

> Hackathon project for **TERR'ELLES** (association, Marseille / PACA — https://www.terrelles.com/).
> Build time: **1 day**. AI component: **required**.
> Items marked `[DEFAULT]` are working assumptions — build them as written unless the team changes them. Items marked `[OPEN]` are listed in §13.

---

## 1. Purpose

An interactive exploration game that helps **young girls** discover **environment-related jobs** across all sectors (tech, ecology, design, energy, food, culture…).

Inspired by zig-zag.fm: instead of hopping between music genres and opening a song, the player hops between **islands of job sectors** and lands on **professions**, each opening a **profession card**.

The player is driven by **quests**: a real environmental problem that one or more professions can solve. Finding the right profession solves the quest. Wrong landings are not failures — the AI guide explains what that job *would* bring and nudges the player on.

**Core message:** every sector has green jobs, and real problems need several professions together.

---

## 2. Audience & context

- Users: girls aged **8–11**, no prior knowledge of the job market. Some are still slow readers.
- UI language: **French only** `[DEFAULT]`. Very simple vocabulary, short sentences (≤ 12 words), feminine job titles (e.g. "Écoconceptrice", "Ingénieure", "Technicienne").
- **Visual first**: icons and images carry the meaning; text is secondary.
- Devices: **desktop-first** — laptop and stand screen, **mouse + keyboard** (no touch). Phone is secondary (must not break, needn't be polished).

### 2.1 Design rules for 8–11 year olds
- Click targets ≥ 48 px; job points ≥ 56 px (kids aim poorly with a mouse). Hover effects are encouraged (lift, glow, title preview) but a click must always be enough.
- Cursor becomes a pointer on everything clickable.
- Max ~3 short lines of text per block. Every text block that matters has a 🔊 **"Écouter"** button (browser `speechSynthesis`, `fr-FR`) — no API needed.
- Friendly mascot for the Guide, big rounded buttons, celebratory feedback (confetti/stars) on success.
- Words to avoid: "filière", "master", "cursus", "enjeux". Say "école", "apprendre", "problème".

### 2.2 Setting & visual style
- All quests take place in **Marseille / PACA** (Calanques, port, mistral, canicule, écoles). Places kids recognise.
- Style: **flat pastel, rounded**. No outlines or thin 1 px lines, soft shadows, radius ≥ 16 px, rounded font (e.g. `Nunito` or `Baloo 2`).
- Palette: sea `#DDF1F7`, text `#3B3355`, white cards; island colours are in `content.json` (Tech `#A8C8F0`, Écologie `#9ED9B0`, Design `#F4B6C8`, Énergie `#FFD98A`, Agri `#F7C59F`, Culture `#C9B6F0`).
- Islands are soft blobs with a lighter sand ring; gentle idle animations (waves, a floating bob on islands).

### 2.3 Stand / kiosk mode
- After **90 s** of inactivity, show "Tu es toujours là ?" for 10 s, then reset to the start screen (clears progress) so the next girl starts fresh.
- Fullscreen button on the start screen.
- No accounts, no login, no personal data collected.

---

## 3. Glossary

| Term | Meaning |
|---|---|
| **World** | The full map showing all islands. |
| **Island** | A broad sector (e.g. Design & Création). |
| **Zone** | A subcategory inside an island (e.g. Product Design). |
| **Job point** | A single profession on an island (e.g. Écoconceptrice d'objets du quotidien). |
| **Landing** | The act of travelling to a job point; opens its card. |
| **Card** | Right-side panel describing a profession. |
| **Quest** | A problem statement with one or more correct job answers. |
| **Guide** | The AI character that reacts to landings and gives hints. |
| **Carnet** | The player's collection of discovered job cards. |

---

## 4. Core game loop

1. **Start screen** → "Commencer l'aventure".
2. **Quest intro**: modal/banner shows the quest text. Player clicks "C'est parti".
3. **World view**: all islands visible. Player clicks an island.
4. **Island view**: camera zooms into the island; zones and job points appear.
5. **Landing**: player clicks a job point → a marker/avatar travels to it (animation) → the **card** slides in from the right.
6. **Evaluation**:
   - **Correct** (job id ∈ quest.answers) → success animation, message from the Guide explaining *why* this job solves it, "Quête suivante" button.
   - **Wrong** → the Guide (AI) explains in ≤2 sentences what this job could bring and hints toward the right island, without naming the answer.
7. Every landed job is added to the **Carnet** (right or wrong).
8. After the last quest → **End screen** (§9.6).

The player can **explore freely at any time** (any island, any job). There is no penalty and no timer `[DEFAULT]`.

---

## 5. Map & navigation

### 5.1 World view
- Stylised sea background, **4–6 islands** laid out organically (not a grid).
- Each island: distinct colour + icon + name label.
- Hover (desktop) → slight lift + tooltip with island description.
- Click → zoom transition into island view.

### 5.2 Island view
- Island fills most of the map area.
- **Zones** drawn as coloured regions or labelled clusters on the island.
- **Job points** drawn as pins inside their zone, with the job title shown on hover/tap.
- Already-visited points display a "visited" state (filled/checked).
- **Back button** "← Vers le monde" returns to world view.
- Neighbouring islands are partially visible at the edges; clicking one jumps directly there (zig-zag-style hopping).

### 5.3 Controls
- Click/tap to select. Pan and pinch-zoom supported but **not required** to play (everything reachable by clicks).
- Keyboard: `Esc` closes the card; `Backspace` returns to world view.

### 5.4 Landing animation
- A small player marker (e.g. a boat or paper plane) travels from its current position to the job point (~0.8 s).
- Camera centres on the point, then the card opens.

---

## 6. Islands & jobs (content)

**Decided** — these 6 islands. Content team edits zones/jobs in `data/content.json`:

| Island | Example zones |
|---|---|
| **Tech & Numérique** | Data & IA, Numérique responsable, Capteurs & objets connectés |
| **Écologie & Biodiversité** | Milieux marins, Faune & flore, Gestion des déchets |
| **Design & Création** | Product Design, Mode durable, Architecture |
| **Énergie & Industrie** | Énergies renouvelables, Industrie circulaire, Mobilité |
| **Agriculture & Alimentation** | Agriculture durable, Alimentation, Eau |
| **Culture & Médias** | Musique & événements éco-responsables, Communication, Cinéma |

Target for the demo: **6 islands × 2–3 zones × 1–3 jobs ≈ 20–30 jobs**, minimum **12** jobs for a playable build.

---

## 7. Profession card

Slides in from the right (desktop: ~35% width; phone: bottom sheet, ~70% height).

Contents, top to bottom:
1. **Breadcrumb**: Island › Zone › Job.
2. **Job title** (feminine form) + island colour accent.
3. **Illustration header** (no photos): see §7.1.
4. **Pitch**: one sentence, "Elle…" + 🔊 button.
5. **"Ce qu'elle fait"**: 3 missions, each an emoji + ≤ 6 words.
6. **"Pourquoi c'est bon pour la planète"**: one short sentence with a 🌍 icon.
7. **"Pour faire ce métier"**: one kid-friendly sentence (e.g. "Elle aime dessiner et a appris dans une école de design."). No diploma names.
9. **Guide bubble**: the AI message relating this job to the current quest (§8), with 🔊 button.
10. Buttons: "Fermer", "Explorer l'île" (if landed from world), and on success "Quête suivante".

### 7.1 Illustrations (no real photos)
No role-model photos are available. Every card uses the same **generated illustration component** so it costs zero asset work:
- Rounded header in the **island colour** (soft gradient).
- A simple **SVG avatar of a woman** (one reusable component; vary skin tone and hair via 3–4 presets picked from the job id hash, for diversity).
- The job's **emoji** (`job.emoji`, e.g. 🪴, 🔬, ⚡) large next to the avatar, plus the island icon small in a corner.
- Optional: `job.image` path overrides this if the team finds a free illustration later.

---

## 8. AI component — the Guide

### 8.1 Behaviour
The Guide is a friendly character (name `[DEFAULT: "Terra"]`) displayed as a speech bubble in the card.

On every landing **during an active quest**, the frontend calls the AI endpoint:

- **Correct job** → 2 sentences: why this profession solves the quest, and one other profession that would work with her.
- **Wrong job** → 2 sentences: what this profession *could* bring to the problem (always positive), then a nudge toward the target island **without naming the answer**.
- After **3 wrong landings** on the same quest, the target island is also highlighted on the map (no AI needed).

Tone: tutoiement, warm, very simple French for 8–11 year olds, max ~30 words, short sentences, no jargon, one emoji allowed.

### 8.2 Endpoint contract

`POST /api/guide`

Request:
```json
{
  "quest": { "id": "q1", "text": "…" },
  "landedJob": { "id": "…", "title": "…", "pitch": "…", "island": "…" },
  "isCorrect": false,
  "targetIsland": "Écologie & Biodiversité",
  "attempt": 2
}
```

Response:
```json
{ "text": "…", "source": "ai" }
```

- Model call is server-side only; **API key in an environment variable**, never in the frontend.
- Timeout **5 s**. On error/timeout, return the static fallback from the quest (`hints[attempt]` or `successText`) with `"source": "fallback"`. The game must never block on the AI.
- Provider: **Anthropic** API, model `claude-haiku-4-5-20251001`, `max_tokens: 150`. Env var `ANTHROPIC_API_KEY`.

### 8.3 System prompt (starting point)
```
Tu es Terra, une guide bienveillante qui fait découvrir des métiers de l'environnement à des filles de 8 à 11 ans.
Réponds en français très simple, en tutoyant, en 2 phrases courtes maximum (30 mots max). Pas de mots compliqués. Un emoji maximum.
Si isCorrect est vrai : explique pourquoi ce métier résout la quête et cite un autre métier complémentaire.
Si isCorrect est faux : dis ce que ce métier pourrait apporter au problème (toujours positif), puis oriente vers l'île cible SANS nommer le métier attendu.
Ne mentionne jamais que tu es une IA.
```

### 8.4 Stretch: AI quest generator
`POST /api/quest` → generates a new quest from the job list; the model must return JSON with `answers` restricted to **existing job ids** (validate server-side, discard otherwise). Only after the core loop works.

---

## 9. Screens

### 9.1 Start screen
Logo TERR'ELLES + game title + one-line pitch + "Commencer l'aventure". Small "Comment jouer ?" link (3-step explanation).

### 9.2 Quest banner (persistent, top of map)
Quest number (e.g. "Quête 2/4"), short quest text, "Revoir la quête" to reopen the full text, wrong-attempt counter hidden from player.

### 9.3 Map (§5)

### 9.4 Card panel (§7)

### 9.5 Carnet
Button top-right "Mon carnet (n)". Opens a grid of discovered jobs grouped by island; clicking one reopens its card. Stored in `localStorage` `[DEFAULT]`.

### 9.6 End screen
- "Bravo !" + number of quests solved and jobs discovered.
- "Les îles que tu as le plus explorées" (top 2 islands by visits).
- Button "Rejouer" (resets progress) and link to terrelles.com.

---

## 10. Data model — `data/content.json`

Single source of truth. No database. **A full first draft exists** (`content.json`: 6 islands × 2 zones × 2 jobs = 24 jobs, 4 Marseille quests). Copy it to `data/content.json`; the example below shows the shape.

Top-level also contains `meta` (`title`, `language`, `worldSize` 1000×600 for island positions, `sea` colour). Each quest has an `emoji`.

```json
{
  "islands": [
    {
      "id": "design",
      "name": "Design & Création",
      "description": "Imaginer des objets et des lieux qui respectent la planète.",
      "color": "#E89AB0",
      "icon": "🎨",
      "position": { "x": 300, "y": 200 },
      "zones": [
        {
          "id": "product-design",
          "name": "Product Design",
          "jobs": [
            {
              "id": "ecoconceptrice-objets",
              "title": "Écoconceptrice d'objets du quotidien",
              "pitch": "Elle invente des objets qui durent longtemps et se réparent.",
              "missions": ["✏️ Dessiner de nouveaux objets", "♻️ Choisir des matières recyclées", "🔧 Rendre les objets réparables"],
              "impact": "Moins d'objets jetés, moins de déchets.",
              "howTo": "Elle aime dessiner et a appris dans une école de design.",
              "emoji": "✏️",
              "image": null,
              "position": { "x": 40, "y": 20 }
            }
          ]
        }
      ]
    }
  ],
  "quests": [
    {
      "id": "q1",
      "text": "Oh non ! La plage est pleine de plastique. Qui peut aider ?",
      "answers": ["ecoconceptrice-objets", "…"],
      "targetIsland": "ecologie",
      "successText": "Fallback shown if the AI is unavailable (correct case).",
      "hints": ["Fallback hint 1", "Fallback hint 2", "Fallback hint 3"]
    }
  ]
}
```

Rules:
- `answers` may contain **several** job ids; any of them solves the quest.
- `targetIsland` must contain at least one of the `answers` (used for hints and the 3-miss highlight).
- All player-facing text follows §2.1 (short, simple, emoji-friendly).
- Job `position` is relative to its island (0–100 %).
- IDs are kebab-case and unique.
- Demo target: **4 quests** `[DEFAULT]`, played in fixed order.

---

## 11. Technical stack & structure

`[DEFAULT]` — optimised for 1 day, several devs, no backend beyond one function.

- **Frontend**: Vite + React + TypeScript, Tailwind CSS, Framer Motion (animations), `react-zoom-pan-pinch` (map camera), `canvas-confetti` (success), browser `speechSynthesis` (read-aloud).
- **Map**: inline SVG; islands as SVG paths/blobs generated from `content.json` positions.
- **State**: React context or Zustand — `currentQuestIndex`, `attemptsPerQuest`, `visitedJobs`, `view` (world | island), `selectedIsland`, `selectedJob`.
- **Persistence**: `localStorage` for carnet + progress.
- **API**: one serverless function `api/guide.ts` (Vercel) — or an Express route if hosted on Replit.
- **Deploy**: Vercel, from the first hour.

Suggested structure:
```
/
├─ SPEC.md
├─ data/content.json
├─ api/guide.ts
├─ src/
│  ├─ main.tsx, App.tsx
│  ├─ state/gameStore.ts
│  ├─ components/
│  │  ├─ StartScreen.tsx
│  │  ├─ QuestBanner.tsx
│  │  ├─ WorldMap.tsx
│  │  ├─ IslandView.tsx
│  │  ├─ JobPoint.tsx
│  │  ├─ JobCard.tsx
│  │  ├─ GuideBubble.tsx
│  │  ├─ Carnet.tsx
│  │  └─ EndScreen.tsx
│  └─ lib/guideClient.ts   // calls /api/guide with fallback
└─ .env.example           // ANTHROPIC_API_KEY=
```

---

## 12. Build phases & acceptance criteria

### Phase 1 — Skeleton (hour 0–1)
- Repo + deploy live with empty app. Schema of `content.json` agreed and committed with fake data (3 islands, 12 jobs, 3 quests).

### Phase 2 — Parallel build (hours 1–3)
- **Map**: world view renders islands from JSON; click zooms into island; job points clickable; back button works.
- **Game flow**: start screen, quest banner, card opens on landing, correct/wrong detection, next quest, end screen.
- **AI**: `/api/guide` returns a response for both cases; fallback works when the key is removed.

### Phase 3 — Integration (hours 3–4)
✅ A player can go start → 3 quests → end screen without errors, with the Guide speaking on each landing.

### Phase 4 — Content & polish (hours 4–6)
- Real content (≥ 20 jobs, 4 quests), landing animation, confetti, 🔊 read-aloud, carnet, kiosk idle reset, 3-miss island highlight. Phone layout last.

### Phase 5 — Freeze (last hour)
- No new features. Demo script: play one quest, land wrong once (show the AI), then land right.

### Global acceptance
- Works on Chrome desktop at 1366×768 and 1920×1080 with mouse + keyboard. Phone: usable, not polished.
- No API key visible in frontend code or network responses.
- Game remains playable with the AI endpoint down.

---

## 13. Open questions

| # | Question | Default if unanswered |
|---|---|---|
| 1 | ~~LLM provider~~ | **Decided: Anthropic, Haiku 4.5** |
| 2 | ~~Target age~~ | **Decided: 8–11** |
| 3 | ~~Main device~~ | **Decided: laptop / stand screen** |
| 3b | ~~Touchscreen?~~ | **Decided: no, mouse + keyboard** |
| 3c | Will the stand have sound (for 🔊)? | Yes, button is optional anyway |
| 4 | ~~Islands~~ | **Decided: the 6 in §6** |
| 5 | ~~Role models~~ | **Decided: none, generated illustrations (§7.1)** |
| 6 | Game name? | "Terr'Îles" |
| 7 | Quests in fixed order or player's choice? | Fixed order |
| 7b | ~~Quest setting~~ | **Decided: Marseille / PACA** |
| 8 | Should the end screen suggest "jobs that suit you" (profile)? | No — top explored islands only |
| 9 | ~~Visual style~~ | **Decided: flat pastel, rounded (§2.2)** |
| 10 | Any Terr'elles branding requirements (colours, logo)? | Use logo from site, own palette |
