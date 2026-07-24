# Discord Bot

Bot Discord du projet TomManager : synchronise en temps reel les participations et le tableau de cuisine avec les changements de role sur le serveur Discord.

## Stack

- Node.js + TypeScript
- discord.js (Gateway Events)
- Prisma (acces direct a la meme base PostgreSQL que le backend)

## Structure

```
src/
├── handlers/     # Handlers d'evenements Discord (ex: guildMemberUpdate)
├── services/     # Logique de synchronisation (participations, cuisine, sync au demarrage)
├── util/         # Connexion DB (Prisma) et variables d'environnement (envalid)
└── __tests__/    # Tests unitaires (handlers, services)
```

## Fonctionnement

- Ecoute les evenements Discord Gateway (changement de role d'un membre) via **Server Members Intent**.
- A chaque changement de role, resynchronise les participations aux evenements (`syncParticipation`) et les creneaux de cuisine (`syncKitchenChef`) correspondants dans la base.
- Au demarrage, effectue une synchronisation complete (`startupSync`) pour rattraper les changements manques pendant un arret.
- Necessite un role Discord associe a chaque evenement (champ "Discord Role ID" configure cote admin dans l'interface web).

## Commandes

Ce package tourne normalement dans Docker (voir le README racine, service `discord-bot`). En local, dans `discord-bot/` :

```bash
npm run dev    # Lancer le bot en dev (nodemon + ts-node)
npm run build  # Compilation TypeScript -> dist/
npm start      # Lancer le build compile

npm run lint   # ESLint

npm test              # Tests unitaires (vitest)
npm run test:coverage # Couverture de tests
```

## Variables d'environnement

Voir le README racine (section "Variables d'environnement"). Le bot a besoin de : `DATABASE_URL`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_ADMIN_ROLE_ID` (optionnel).

Sans `DISCORD_BOT_TOKEN` valide, le bot ne demarre pas (les autres services de la stack ne sont pas impactes).
