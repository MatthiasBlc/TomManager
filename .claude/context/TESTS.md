# Tests - Infrastructure & Reference

## Commandes

```bash
# Backend + Frontend unitaires (via docker, depuis la racine)
npm test                          # Backend + Frontend
npm run test:backend              # Backend seul
npm run test:frontend             # Frontend seul
npm run test:coverage             # Couverture complete

# Backend hors docker (necessite DB test sur port 5433)
npm run test:db:up                # Demarrer DB test
npm run test:db:down              # Arreter DB test
npm run test:integration          # Flow complet

# Frontend seul
npx vitest run

# E2E Playwright — tourne EN LOCAL, pas dans Docker
# Prerequis : npx playwright install chromium (une seule fois)
# Docker doit etre demarre (npm run docker:up:build)
npx playwright test --project=chromium   # Recommande
npm run test:e2e                         # Tous les projets
npx playwright test --grep "nom"         # Un test specifique
```

## E2E — Architecture

- Playwright s'installe localement (`~/.cache/ms-playwright/`), pas dans Docker
- Aucune variable d'environnement requise : baseURL = `http://localhost:3000` (defaut playwright.config.ts)
- Les tests seedent leurs propres donnees via l'API (`e2e/fixtures/seed.ts`)
- En CI : le backend/frontend sont lances directement sur le runner (pas via Docker), Chromium installe via `--with-deps`

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

### Backend (178 tests)

- `integration/health.test.ts` - Health check endpoint
- `integration/auth.test.ts` - Auth API (signup with token, login by email/username, login with token, me, error format consistency)
- `integration/event.test.ts` - Event API (CRUD: create, list, detail, update, delete + auth + cascade)
- `integration/invitation.test.ts` - Invitation API (create, resend, validate token)
- `integration/participant.test.ts` - Participant API (list, remove, leave) + Invitation listing
- `integration/gameTable.test.ts` - GameTable API (CRUD, join/leave/kick, waitlist, demotion/promotion, promote/demote manuel GM, reserved seats) + Tag autocomplete
- `integration/boardGame.test.ts` - BoardGame API (CRUD, search local + BGG fallback, lazy fetch, from-bgg, error format) + BGG XML parsing
- `integration/eventBoardGame.test.ts` - EventBoardGame API (add, list, remove, duplicate, non-participant, cascade)
- `integration/socket.test.ts` - Socket.io (auth, reject without session, rooms, broadcast)
- `integration/notification.test.ts` - Notification service (create, bulk, pagination, mark read, delete) + API endpoints + triggers (table delete/update/kick, participant remove, promotions/demotions)

### Frontend (162 tests - ROADMAP COMPLETE)

- `BoardGameCard.test.tsx` - Rendu nom/annee, joueurs/duree, bouton Remove (aria-label "Remove <game>"), masquage pour autre utilisateur
- `useIsMobile.test.tsx` - Hook : valeur initiale matchMedia, mise a jour sur change, cleanup listener
- `useOnlineStatus.test.tsx` - Hook : valeur initiale navigator.onLine, evenements online/offline, cleanup listeners
- `EmptyState.test.tsx` - Rendu titre, description optionnelle, icone, action
- `FAB.test.tsx` - Rendu bouton, aria-label, click handler
- `Skeleton.test.tsx` - Variantes (Text, Card, CardGrid, BoardGame, Notification, TableDetail)
- `TableCard.test.tsx` - Rendu titre/GM/pitch/tags, badges (GM, conflit, waitlist, joined), click
- `NotificationItem.test.tsx` - Rendu contenu, lu/non-lu, navigation eventId, mark as read, delete, icones par type
- `PrivateRoute.test.tsx` - Spinner pendant loading, redirection /login si non auth, rendu enfant si auth
- `ErrorBoundary.test.tsx` - Rendu enfant sans erreur, fallback par defaut, fallback custom
- `ConnectionStatus.test.tsx` - Pas de rendu sans socket, badge selon etat initial, mise a jour sur connect/disconnect
- `BoardGameSearchInput.test.tsx` - Pas de query <2 char, debounce + resultats, badge BGG, selection clear input, gestion erreur API
- `Navbar.test.tsx` - Desktop/mobile, login/logout, avatar, evenements visibles selon auth
- `BottomTabBar.test.tsx` - Pas de rendu sans user, tabs Events/Planning/Games selon route, logout
- `MobileHeader.test.tsx` - Logo TM, bell + status visibles si auth
- `AppLayout.test.tsx` - Padding mobile/desktop selon auth
- `BoardGameList.test.tsx` - Empty state, liste, regroupement par jeu
- `ParticipantList.test.tsx` - Empty state, table desktop / cards mobile, remove/leave selon role
- `TimelineView.test.tsx` - Empty state, cartes, regroupement par date, click handler
- `NotificationBell.test.tsx` - Bell badge, cap 99+, dropdown desktop, sheet mobile, mark all read
- `ManualBoardGameForm.test.tsx` - Champs requis, validation Name, soumission valeurs numeriques, cancel
- `TagInput.test.tsx` - Badges, ajout (Enter/comma), suppression, dedupe, backspace, suggestions API
- `LoginPage.test.tsx` - Render, submit success/fail, redirect si connecte, Discord 503, OAuth click, error param
- `AddBoardGameModal.test.tsx` - Modes search/manual, ajout local, import BGG, close
- `CreateTableModal.test.tsx` - Render, JDR/JDS conditional, validation, submit, cancel
- `TableDetailModal.test.tsx` - Fetch, render, boutons selon role (Rejoindre/Quitter/Modifier/Supprimer), join/delete API

Roadmap tests a venir : `docs/features/frontend-tests/ROADMAP.md` (phase 8 - pages)

### Couverture (seuils CI)

- Backend : seuil 50%/50%
- Frontend : seuil 50%/50%
