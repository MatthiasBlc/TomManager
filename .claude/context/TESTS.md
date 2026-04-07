# Tests - Infrastructure & Reference

## Commandes

```bash
# Depuis la racine (via docker)
npm test                          # Backend + Frontend
npm run test:backend              # Backend seul
npm run test:frontend             # Frontend seul
npm run test:coverage             # Couverture complete

# Depuis backend/ (hors docker, necessite DB test)
npm run test:db:up                # Demarrer DB test (port 5433)
npm run test:db:down              # Arreter DB test
npm run test:integration          # Flow complet (db:up + migrate + test + db:down)

# Depuis frontend/
npx vitest run                    # Tous les tests
```

## Configuration

### Backend (backend/vitest.config.ts)

- Framework: Vitest + Supertest
- Environment: Node.js
- Setup: `__tests__/setup/globalSetup.ts`
- Pattern: `src/__tests__/**/*.test.ts`
- Timeout: 30s
- Pool: singleFork (DB partagee, cleanup afterEach)
- Helpers: `src/__tests__/setup/testHelpers.ts`

### Frontend (frontend/vitest.config.ts)

- Framework: Vitest + @testing-library/react + jsdom
- Environment: jsdom
- Setup: `src/test/setup.ts` (@testing-library/jest-dom)
- Pattern: `src/__tests__/**/*.test.{ts,tsx}`
- Globals: actifs (describe, it, expect, vi sans import)
- Coverage: v8, reporter text + html

## Inventaire des tests

### Backend (~167 tests)

- `integration/health.test.ts` - Health check endpoint
- `integration/auth.test.ts` - Auth API (signup with token, login by email/username, login with token, me, error format consistency)
- `integration/event.test.ts` - Event API (CRUD: create, list, detail, update, delete + auth + cascade)
- `integration/invitation.test.ts` - Invitation API (create, resend, validate token)
- `integration/participant.test.ts` - Participant API (list, remove, leave) + Invitation listing
- `integration/gameTable.test.ts` - GameTable API (CRUD, join/leave/kick, waitlist, demotion/promotion) + Tag autocomplete
- `integration/boardGame.test.ts` - BoardGame API (CRUD, search local + BGG fallback, lazy fetch, from-bgg, error format) + BGG XML parsing
- `integration/eventBoardGame.test.ts` - EventBoardGame API (add, list, remove, duplicate, non-participant, cascade)
- `integration/socket.test.ts` - Socket.io (auth, reject without session, rooms, broadcast)
- `integration/notification.test.ts` - Notification service (create, bulk, pagination, mark read, delete) + API endpoints + triggers (table delete/update/kick, participant remove, promotions/demotions)

### Frontend (4 tests)

- `BoardGameCard.test.tsx` - Rendu nom/annee, joueurs/duree, bouton remove own entry, masquage pour autre utilisateur

Roadmap tests a venir : `docs/features/frontend-tests/ROADMAP.md` (phases 1-8)

### Couverture (seuils CI)

- Backend : seuil 50%/50%
- Frontend : seuil 50%/50%
