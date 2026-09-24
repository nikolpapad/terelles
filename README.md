# Terr'Îles

Un jeu d'exploration de métiers verts pour les enfants, basé sur [SPEC.md](SPEC.md).

## Démarrer

Sur Replit, lancez le workflow **Start application**. En local : `npm install` puis `npm run dev` (port 5000). Pour vérifier la version compilée : `npm run build`, puis `npm start`.

Toutes les îles, zones, métiers et quêtes sont dans [`data/content.json`](data/content.json). Modifiez ce fichier pour changer le contenu du jeu.

Le serveur Express expose `POST /api/guide`. Avec l'intégration Anthropic de Replit activée, il utilise Claude Haiku ; sans elle, il renvoie les textes statiques des quêtes. Définissez `GUIDE_DISABLED=true` pour forcer ces textes pendant les tests. Aucune clé ne doit être placée dans le frontend.
