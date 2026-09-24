# Terr'Îles

Un jeu d'exploration pour **TERR'ELLES** qui fait découvrir aux filles de 8 à 11 ans les métiers de l'environnement, à Marseille.
Le joueur voyage d'île en île (les secteurs), atterrit sur des métiers et résout des quêtes avec l'aide de **Terra**, une guide IA.

- Spécification fonctionnelle : [`SPEC.md`](SPEC.md)
- Direction artistique : [`MARSEILLE_RPG.md`](MARSEILLE_RPG.md)
- Contenu (îles, métiers, quêtes) : [`data/content.json`](data/content.json) : la seule source à modifier pour le contenu

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Sans clé API, le jeu marche quand même : Terra utilise les textes de secours (`hints` / `successText`) de chaque quête.

## Le jeu

Une carte de Marseille en pixel-art (style RPG 16 bits), générée par le code (`src/lib/worldgen.ts`).
Chaque secteur est un lieu connu : Grand Port, La Joliette, MuCEM, Noailles, Vélodrome, Calanques.

Zoom par niveaux : **lieux** → **sous-catégories** (panneaux en bois) → **personnes** (chaque métier tient son objet).
L'héroïne marche jusqu'à la personne choisie (clic, ou flèches / ZQSD puis Espace).

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4
- **Canvas 2D** : carte, caméra, personnages et animations (`src/lib/engine.ts`)
- **Zustand** : état du jeu, sauvegardé dans `localStorage` (carnet + progression)
- **Framer Motion**, **canvas-confetti**, `speechSynthesis` (lecture à voix haute fr-FR)
- **`/api/guide`** : route serveur qui appelle Claude (Haiku 4.5, 150 tokens, 5 s de timeout) avec repli sur les textes de secours. La clé reste côté serveur.

## Structure

```
data/content.json            contenu du jeu (métiers, quêtes, indices)
src/app/api/guide/route.ts   guide IA (Terra) + repli statique
src/state/gameStore.ts       état du jeu
src/lib/
  marseille.ts               lieux, zones, position des personnages
  worldgen.ts                génération de la carte pixel-art
  engine.ts                  moteur canvas : caméra, zoom, héroïne, animations
  characters.ts, icons.ts    sprites (personnages, objets des métiers, icônes)
src/components/              écrans et fenêtres (fiche métier, carnet, quêtes…)
```

Note : la position des personnages est calculée dans `src/lib/marseille.ts` ; le champ `position` et les emojis de `content.json` ne sont plus affichés.

## Raccourcis

- Molette : zoomer · glisser : déplacer la carte
- Flèches / ZQSD : marcher · Espace : parler
- `Échap` : fermer · `Retour arrière` : dézoomer

## Déploiement

Vercel : importer le repo et ajouter la variable d'environnement `ANTHROPIC_API_KEY`.
