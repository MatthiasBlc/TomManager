# Backend

API REST du projet TomManager : Express + TypeScript + Prisma (PostgreSQL).

## Stack

- Node.js + Express
- TypeScript
- Prisma ORM (PostgreSQL)
- Socket.io (temps reel)
- express-session + `@quixo3/prisma-session-store` (sessions persistees en DB)
- Zod (validation), Pino (logs), Sentry (erreurs, optionnel)

## Structure

```
src/
├── config/        # Variables d'environnement (envalid), config Sentry/CORS/etc.
├── controllers/    # Handlers de routes (logique HTTP)
├── services/       # Logique metier
├── routes/         # Definition des routes Express
├── middleware/      # Auth, gestion d'erreurs, rate limiting...
├── schemas/        # Schemas de validation Zod
├── socket/         # Handlers Socket.io
├── types/          # Types partages
├── util/           # Utilitaires (Sentry, helpers divers)
└── __tests__/
    ├── unit/          # Tests unitaires (services, utils)
    └── integration/   # Tests API avec base de donnees de test
prisma/
├── schema.prisma   # Schema de la base de donnees
└── migrations/     # Historique des migrations
```

Voir `.claude/context/API_MAP.md` (endpoints) et `.claude/context/DB_MODELS.md` (schema Prisma) a la racine du repo pour le detail.

## Commandes

Ce package tourne normalement dans Docker (voir le README racine). En local, dans `backend/` :

```bash
npm run dev              # Serveur dev avec reload (nodemon)
npm run build             # Compilation TypeScript -> dist/
npm start                 # Lancer le build compile

npm run lint               # ESLint

npm test                   # Tests unitaires + integration (vitest)
npm run test:watch         # Tests en mode watch
npm run test:coverage      # Couverture de tests

npm run test:integration   # Lance une DB Postgres de test (docker-compose.test.yml), applique les migrations et lance les tests
npm run test:db:up         # Demarrer uniquement la DB de test
npm run test:db:down       # Arreter la DB de test
npm run test:db:reset      # Redemarrer la DB de test

npm run seed                # Peupler la base via prisma/seed.js
```

## Variables d'environnement

Voir le README racine (section "Variables d'environnement") pour la liste complete. Cote backend, les principales sont : `DATABASE_URL`, `PORT`, `SESSION_SECRET`, `CORS_ORIGIN`, les variables `DISCORD_*`, `BGG_API_TOKEN` et `SENTRY_DSN`.

## Tests

- **Unitaires** (`src/__tests__/unit/`) : services et logique metier isoles, sans DB.
- **Integration** (`src/__tests__/integration/`) : routes API completes via Supertest, contre une vraie base PostgreSQL de test (`docker-compose.test.yml`, port 5433).

Les tests d'integration necessitent les variables d'env (`DATABASE_URL`, `SESSION_SECRET`) — utiliser `npm run test:integration` qui gere le cycle de vie de la DB de test automatiquement.
