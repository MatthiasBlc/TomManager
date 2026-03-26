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

### Backend (~165 tests)

- `integration/health.test.ts` - Health check endpoint
- `integration/auth.test.ts` - Auth API (signup with token, login by email/username, login with token, me)
- `integration/event.test.ts` - Event API (CRUD: create, list, detail, update, delete + auth + cascade)
- `integration/invitation.test.ts` - Invitation API (create, resend, validate token)
- `integration/participant.test.ts` - Participant API (list, remove, leave) + Invitation listing
- `integration/gameTable.test.ts` - GameTable API (CRUD, join/leave/kick, waitlist, demotion/promotion) + Tag autocomplete
- `integration/boardGame.test.ts` - BoardGame API (CRUD, search local + BGG fallback, lazy fetch, from-bgg) + BGG XML parsing
- `integration/eventBoardGame.test.ts` - EventBoardGame API (add, list, remove, duplicate, non-participant, cascade)
- `integration/socket.test.ts` - Socket.io (auth, reject without session, rooms, broadcast)
- `integration/notification.test.ts` - Notification service (create, bulk, pagination, mark read, delete) + API endpoints + triggers (table delete/update/kick, participant remove, promotions/demotions)

### Frontend (~58 tests)

- `unit/App.test.tsx` - App renders
- `unit/NotificationBell.test.tsx` - Bell badge, dropdown toggle, mark all read, empty state, load more
- `unit/NotificationItem.test.tsx` - Render by type, bold unread, click navigation, mark read, delete
- `unit/BottomTabBar.test.tsx` - Events tab, username, Planning/Games conditional on eventId
- `unit/MobileSheet.test.tsx` - Open/close, title, backdrop click, Escape key, aria-modal
- `unit/AuthPages.test.tsx` - HomePage responsive classes, LoginPage mobile card, SignupPage no w-96, InvitationLandingPage spinner
- `unit/EventPages.test.tsx` - FAB aria-label/positioning, ResponsiveModal desktop/mobile/closed rendering
- `unit/SkeletonEmptyState.test.tsx` - Skeleton variants (card, grid, board game, notification, table detail), EmptyState (title, icon, description, action, animation)
- `unit/Accessibility.test.tsx` - axe-core tests: EmptyState, SkeletonCardGrid, MobileSheet, ResponsiveModal, NotificationItem (0 violations)

### Couverture (seuils CI)

- Backend : seuil 50%/50%
- Frontend : seuil 50%/50%
