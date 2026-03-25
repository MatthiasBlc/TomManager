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

- Framework: Vitest + Testing Library
- Environment: jsdom
- Setup: `__tests__/setup/vitestSetup.ts`
- Pattern: `src/__tests__/**/*.test.{ts,tsx}`

## Inventaire des tests

### Backend (~92 tests)

- `integration/health.test.ts` - Health check endpoint
- `integration/auth.test.ts` - Auth API (signup with token, login by email/username, login with token, me)
- `integration/event.test.ts` - Event API (CRUD: create, list, detail, update, delete + auth + cascade)
- `integration/invitation.test.ts` - Invitation API (create, resend, validate token)
- `integration/participant.test.ts` - Participant API (list, remove, leave) + Invitation listing
- `integration/gameTable.test.ts` - GameTable API (CRUD, join/leave/kick, waitlist, demotion/promotion) + Tag autocomplete

### Frontend (~1 test)

- `unit/App.test.tsx` - App renders

### Couverture (seuils CI)

- Backend : seuil 50%/50%
- Frontend : seuil 50%/50%
