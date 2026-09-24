# Running Terr'Îles

- Start the **Start application** workflow (`npm run dev`), serving Express + Vite on port 5000.
- `npm run build` builds the frontend; `npm start` serves it through Express.
- Edit `data/content.json` for islands, zones, jobs and quests. Do not duplicate game content in code.
- The Guide uses server-side Anthropic credentials when the Replit AI integration is enabled; without credentials or with `GUIDE_DISABLED=true`, quest fallback text is returned.