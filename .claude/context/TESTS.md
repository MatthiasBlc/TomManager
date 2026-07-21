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
- Le login se fait par injection du cookie de session obtenu via l'API (`e2e/fixtures/session.ts` — `loginAs(page, cookie)`), pas par le formulaire (masque de l'UI, Discord uniquement)
- En CI : le backend/frontend sont lances directement sur le runner (pas via Docker), Chromium installe via `--with-deps`
- Specs : `auth`, `planning`, `waitlist`, `mobile`, `notifications` (temps reel : notif MJ live via socket, clic -> modale table + fermeture panneau + badge lu, sync du badge entre deux onglets via read-all), `cuisine` (CookV1 Lot G : responsable configure -> chef cree un repas -> genere le planning -> equipier s'inscrit + rejoint une table chevauchante -> conflit visible dans Planning -> purge efface le contenu cuisine)

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

### Backend (367 tests)

- `integration/health.test.ts` - Health check endpoint
- `integration/auth.test.ts` - Auth API (signup with token, login by email/username, login with token, me, error format consistency)
- `integration/event.test.ts` - Event API (CRUD: create, list, detail, update, delete + auth + cascade)
- `integration/invitation.test.ts` - Invitation API (create, resend, validate token)
- `integration/participant.test.ts` - Participant API (list, remove, leave) + Invitation listing
- `integration/gameTable.test.ts` - GameTable API (CRUD, join/leave/kick, waitlist, demotion/promotion, promote/demote manuel GM, reserved seats, choix explicite libre/reservee, conversion en place d'un joueur confirme, borne reservedSeats <= maxPlayers-1 si le MJ prend une place (create + update), garde-fous MJ (pas de demote/kick/place reservee pour le MJ assis a sa table), demote = fin de file waitlist (409 si deja en waitlist), seat obligatoire pour status=CONFIRMED, toggle gmIsPlayer = place du MJ creee/supprimee avec maxPlayers +1/-1) + Tag autocomplete
- `integration/boardGame.test.ts` - BoardGame API (CRUD, search local + BGG fallback, lazy fetch, from-bgg, error format) + BGG XML parsing
- `integration/eventBoardGame.test.ts` - EventBoardGame API (add, list, remove, duplicate, non-participant, cascade)
- `integration/socket.test.ts` - Socket.io (auth, reject without session, rooms, broadcast)
- `integration/notification.test.ts` - Notification service (create, bulk, pagination, mark read, delete) + API endpoints + triggers (table delete/update/kick, participant remove, promotions/demotions) + emissions socket de sync multi-appareils (notification:new/read/read-all/deleted, pas d'emission si ownership KO) + creation non-bloquante (null/[] si insert KO) + notifications MJ (GM_PLAYER_JOINED/WAITLISTED/LEFT, GM_TABLE_FULL, pas d'auto-notif JDS, MJ prevenu d'un update/delete admin, pas de notif sur ses propres updates) + notifications event (EVENT_UPDATED si nom/dates changent, pas de notif si rien de significatif, EVENT_DELETED, auteur exclu) + retention (purge lues >30j / non lues >90j)
- `integration/preference.test.ts` - Preferences API (defaults false dans /me, PATCH bulk + upsert, 403 cles admin/beta pour non-admin, 400 cle inconnue/valeur non bool/body vide)
- `integration/kitchen.test.ts` - Kitchen API CookV1 (GET modele par role + anti-fuite allergies/ingredients equipier, PATCH config + ecrasement MANUAL->ROLE, chefs/courses manuels + exclusivite (2.4), orphelinage retrait chef, liste sans affectation)
- `integration/meal.test.ts` - Meal API CookV1 (CRUD chef/manager, unique 1 chef/repas, orphelinage/reassignation, ingredients find-or-create Product + ustensiles, inscription/deplacement/desinscription equipier transactionnels, capacite, exclusivite)
- `integration/kitchenPlanning.test.ts` + `unit/kitchenPlanning.test.ts` - Generation planning (pool, tri startDateTime, exclusion courses, non-destructif + overCapacity, regen idempotente, clamps)
- `unit/conflicts.test.ts` - Moteur de conflits unifie (CookV1 Lot F) : computeConflicts pur (chevauchement/adjacence, garde-fou meme source, isolation par personne, 3 engagements simultanes, comptage multi-personnes sur une source)
- `integration/kitchenConflicts.test.ts` - Conflit cross-domaine (CookV1 Lot F) : chef occupe par son repas + inscrit a une table (visible chef ET MJ), pas de conflit si disjoint, equipier inscrit a un repas + une table chevauchante (visibilite personne/chef)
- `integration/kitchenPurge.test.ts` - Extension purge (CookV1 Lot G) : EventKitchen+chefRoleId+config conserves, repas (cascade ingredients/assistants)/courses/chefs MANUAL purges, chefs ROLE preserves par la suppression ; reconstitution ROLE au re-import (adminSync mocke : le container dev a un vrai token/guild Discord, jamais solliciter le reseau reel en test) ; no-op si pas d'EventKitchen

### Frontend (ROADMAP COMPLETE)

- `BoardGameCard.test.tsx` - Rendu nom/annee, joueurs/duree, bouton Remove (aria-label "Remove <game>"), masquage pour autre utilisateur
- `useIsMobile.test.tsx` - Hook : valeur initiale matchMedia, mise a jour sur change, cleanup listener
- `useOnlineStatus.test.tsx` - Hook : valeur initiale navigator.onLine, evenements online/offline, cleanup listeners
- `useEventSocket.test.tsx` - Join immediat, re-join + onReconnected apres une reconnexion (pas au premier connect), cleanup listener
- `useNotifications.test.tsx` - Fetch initial + unread count, toast d'erreur sur chaque catch (fetch/markAsRead/delete), refetch au reconnect socket, sync multi-appareils (read/read-all/deleted idempotents, echo local sans double decrement, item hors page charge, dedoublonnage notification:new)
- `EmptyState.test.tsx` - Rendu titre, description optionnelle, icone, action
- `FAB.test.tsx` - Rendu bouton, aria-label, click handler
- `Skeleton.test.tsx` - Variantes (Text, Card, CardGrid, BoardGame, Notification, TableDetail, EventDetail)
- `TableCard.test.tsx` - Rendu titre/GM/pitch/tags, badges (GM, conflit, waitlist, joined, joueur reserve), click
- `NotificationItem.test.tsx` - Rendu contenu, lu/non-lu, navigation eventId, mark as read, delete, icones par type, routage par type (PARTICIPANT_REMOVED/EVENT_DELETED -> /events, TABLE_DELETED/PLAYER_KICKED sans ?table), onNavigate (fermeture panneau)
- `PrivateRoute.test.tsx` - Spinner pendant loading, redirection /login si non auth, rendu enfant si auth
- `ErrorBoundary.test.tsx` - Rendu enfant sans erreur, fallback par defaut, fallback custom
- `ConnectionStatus.test.tsx` - Pas de rendu sans socket, badge selon etat initial, mise a jour sur connect/disconnect, toast disconnect/reconnect (jamais au premier connect)
- `BoardGameSearchInput.test.tsx` - Pas de query <2 char, debounce + resultats, badge BGG, selection clear input, gestion erreur API, message "Aucun resultat"
- `Navbar.test.tsx` - Desktop/mobile, login/logout, avatar, evenements visibles selon auth, decalage sticky si hors-ligne
- `BottomTabBar.test.tsx` - Pas de rendu sans user, tabs Events/Planning/Games selon route, bouton Profil (label fixe), logout
- `MobileHeader.test.tsx` - Logo TM, bell + status visibles si auth, decalage top-10 si hors-ligne
- `AppLayout.test.tsx` - Padding mobile/desktop selon auth, padding supplementaire mobile si hors-ligne
- `MobileSheet.test.tsx` - Verrou/deverrou du scroll body, compte-reference avec sheets imbriquees
- `BoardGameList.test.tsx` - Empty state, liste, regroupement par jeu
- `ParticipantList.test.tsx` - Empty state, table desktop / cards mobile, remove/leave selon role, troncature nom long, disabled pendant l'appel
- `TimelineView.test.tsx` - Empty state, cartes, regroupement par date, click handler, mono-colonne chronologique sur mobile, creneaux cuisine (CookV1 Lot F : rendu a cote/sans tables, badge conflit personne, compte conflits visible au chef uniquement)
- `NotificationBell.test.tsx` - Bell badge, cap 99+, dropdown desktop, sheet mobile, mark all read, cible tactile 44px mobile
- `NumberStepper.test.tsx` - Increment/decrement, disable aux bornes min/max, prop step
- `ManualBoardGameForm.test.tsx` - Champs requis, validation Name, soumission valeurs numeriques (stepper), cancel
- `TagInput.test.tsx` - Badges, ajout (Enter/comma), suppression, dedupe, backspace, suggestions API, loading/erreur/aucun-resultat pendant la recherche
- `LoginPage.test.tsx` - Redirect si connecte, fallback message si Discord 503 (formulaire password masque), OAuth click, error param
- `AddBoardGameModal.test.tsx` - Modes search/manual, ajout local, import BGG, close
- `AdminBoardGamePanel.test.tsx` - Liste, total, edit/delete/merge modals, empty state recherche sans resultat
- `EventListPage.test.tsx` - Fetch/affichage, empty state, etat d'erreur distinct + retry, FAB/bouton creation selon droit admin.events (admin sans droit = pas de bouton)
- `EventDetailPage.test.tsx` - Skeleton pendant le chargement puis contenu, params non definis
- `CreateEventModal.test.tsx` - Submit succes, validation croisee endDateTime > startDateTime
- `EditEventModal.test.tsx` - Submit succes, validation croisee endDateTime > startDateTime
- `ProfilePage.test.tsx` - Link/unlink Discord, confirmation avant unlink, disabled selon email, section droits admin (toggles, master toggle + confirmation, appels updatePreferences)
- `CreateTableModal.test.tsx` - Render, JDR/JDS conditional, validation, submit, cancel, stepper reservedSeats plafonne a maxPlayers
- `EditTableModal.test.tsx` - Encart occupation actuelle, avertissement + confirm avant demotion (maxPlayers/reservedSeats), submit sans confirm si pas d'impact
- `TableDetailModal.test.tsx` - Fetch, render, boutons selon role (Rejoindre/Quitter/Modifier/Supprimer), join/delete API, badge "reservee" par joueur, boutons de promotion waitlist (simple ou double libre+reservee selon disponibilite, payload `seat`), bouton disabled si table pleine, conversion en place d'un joueur confirme (libre<->reservee), Modifier/Supprimer admin conditionnes au droit admin.tables
- `KitchenTab.test.tsx` - Matrice de visibilite CookV1 (equipier masque, chef = CTA "Creer mon repas" sans panneau gestion, panneau gestion visible manager/admin)
- `KitchenBoard.test.tsx` - Masquage si equipier + toggle off, visible toujours pour chef, badge "sans chef", join/move/leave (S'inscrire / Se deplacer ici / Se desinscrire), disabled si complet, places restantes
- `KitchenManagementPanel.test.tsx` - Modales de confirmation (ecrasement chefs au set du chefRoleId, retrait chef, generation planning) + annulation, mode role (roster lecture seule), reassignation repas orphelin
- `MealFichesList.test.tsx` - Warning nombre d'equipiers avant suppression, permissions edit/delete (proprietaire/manager/aucun), stepper capacite manager uniquement, empty state
- `useEventSocket.test.tsx` (CookV1) - Reaction aux 4 evenements `kitchen:*` (config-updated, meal-changed, assistant-changed, planning-generated)

Roadmap tests a venir : `docs/features/frontend-tests/ROADMAP.md` (phase 8 - pages)

### Couverture (seuils CI)

- Backend : seuil 50%/50%
- Frontend : seuil 50%/50%
