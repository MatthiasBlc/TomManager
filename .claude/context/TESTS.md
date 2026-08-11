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

**ATTENTION - `npm test` / `npm run test:backend` (variante docker) efface les donnees de dev.**
Ces commandes font `docker compose exec backend npm test`, qui tourne dans le conteneur
backend contre la MEME base que le dev (`tommanager_db`). `globalSetup.ts` fait un
`deleteMany()` sur toutes les tables `beforeEach`/`afterEach` de CHAQUE test pour
l'isolation — donc la base dev (users, events, tables seedees) est integralement videe
a la fin de la suite. Si des donnees de dev/demo comptent (seed manuel, tables de test
UI), reseeder ensuite : `docker exec tommanager-backend node prisma/seed.js`.
Alternative sans ce risque : `npm run test:db:up` + `npm run test:integration` (DB de
test isolee sur le port 5433, ne touche jamais `tommanager_db`).

## E2E — Architecture

- Playwright s'installe localement (`~/.cache/ms-playwright/`), pas dans Docker
- Aucune variable d'environnement requise : baseURL = `http://localhost:3000` (defaut playwright.config.ts)
- Les tests seedent leurs propres donnees via l'API (`e2e/fixtures/seed.ts`)
- Le login se fait par injection du cookie de session obtenu via l'API (`e2e/fixtures/session.ts` — `loginAs(page, cookie)`), pas par le formulaire (masque de l'UI, Discord uniquement)
- En CI : le backend/frontend sont lances directement sur le runner (pas via Docker), Chromium installe via `--with-deps`
- Specs : `auth`, `planning`, `waitlist`, `mobile`, `notifications` (temps reel : notif MJ live via socket, clic -> modale table + fermeture panneau + badge lu, sync du badge entre deux onglets via read-all), `cuisine` (CookV1 Lot G : responsable configure -> chef cree un repas -> genere le planning -> responsable ajuste vege/carne (auto-equilibrage, notif chef avec detail ancien/nouveau, KitchenDietSplit) -> equipier s'inscrit + rejoint une table chevauchante -> conflit visible dans Planning -> purge efface le contenu cuisine), `timezone` (ParisTimezone Lot F : cree une table a une heure de Paris connue + resize CalendarView, sous le projet `chromium-non-paris` uniquement)
- Projet Playwright `chromium-non-paris` (`timezoneId: "America/New_York"`, cf `playwright.config.ts`) : reserve a `e2e/timezone.spec.ts` (`testMatch`), exclu des autres projets (`testIgnore`) — regression fuseau navigateur non-Paris (ParisTimezone)

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

### Backend (422 tests)

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
- `integration/kitchen.test.ts` - Kitchen API CookV1 (GET modele par role + anti-fuite allergies/aversions/ingredients equipier, `dislikesNotes` sous la meme regle de visibilite que `allergiesNotes` et mise a jour independante (ecrire l'une n'efface pas l'autre, sauts de ligne conserves, max 5000), dashboard admin nominatif chefs/courses/sans-affectation desormais cumulatif avec le role chef (admin+chef recoit dashboard ET sa propre fiche, plus exclusif), PATCH config + ecrasement MANUAL->ROLE, chefs/courses manuels + exclusivite (2.4), orphelinage retrait chef, liste sans affectation, auto-unassign courses (equipier deja inscrit -> desinscription silencieuse au lieu de bloquer) + auto-claim chef manuel d'un creneau orphelin (Evolutions.md point 3, synchro role Discord inchangee)) ; notifications `KITCHEN_CHEF_ADDED`/`_REMOVED` (Lot H) ; `vegeCount`/`carneCount` + `eventParticipantsCount` exposes a chef/manager/admin simple, jamais a l'equipier (KitchenDietSplit)
- `integration/meal.test.ts` - Meal API CookV1 (plus de creation manuelle : `createMealForChef` seede un repas directement via Prisma ; reclamation `claim` d'un creneau orphelin + concurrence/roster/deja-un-repas, edition champs structurants manager-only, unique 1 chef/repas, orphelinage/reassignation, ingredients/ustensiles find-or-create Product/Utensil + quantite coercee, inscription/deplacement/desinscription equipier transactionnels, capacite, exclusivite, assignation/retrait manager d'un equipier tiers `POST/DELETE .../assistants/:userId`) ; notification `KITCHEN_MEAL_CLAIMED` aux equipiers deja inscrits sur un creneau reclame (Lot H) ; `vegeCount`/`carneCount` manager-only (403 pour un chef), notification `KITCHEN_DIET_SPLIT_UPDATED` avec detail ancien/nouveau, silencieuse si valeurs inchangees, repas orphelin, ou quand le responsable qui edite est lui-meme le chef du repas (KitchenDietSplit + correctif UX section 10) ; commentaire par ingredient (`note`) persiste, normalise a `null` si absent ou blanc, rejete au-dela de 300 caracteres
- `integration/utensil.test.ts` - Autocomplete ustensiles CookV1 (auth requise, prefix match normalise lowercase, query vide, pattern Product/Tag) (Evolutions.md point 7)
- `integration/mealSwap.test.ts` - Echange de creneau chefs (CookV1) : swap recette+chef avec equipiers/horaires inchanges, doublon PENDING refuse, accept reserve a la cible, reject/cancel, refus contre un creneau orphelin ; `POST /meals/:mealId/move` (Evolutions.md point 1) : deplacement instantane vers un creneau libre (recette suit, creneau quitte orphelin avec equipiers inchanges), NOT_A_CHEF_WITH_MEAL, SWAP_SAME_MEAL, MEAL_NOT_ORPHAN, MEAL_NOT_FOUND, annulation des demandes d'echange PENDING referencant les repas concernes ; notifications `KITCHEN_SWAP_REQUESTED`/`_ACCEPTED`/`_REJECTED` (Lot H)
- `integration/assistantSwap.test.ts` - Echange entre equipiers (Evolutions.md point 4) : creation bloquee si le repas cible a une place libre (TARGET_MEAL_HAS_SEATS), ASSISTANT_SWAP_SAME_MEAL, ASSISTANT_SWAP_ALREADY_PENDING, NOT_MEAL_ASSISTANT ; acceptation par n'importe quel assistant du repas cible (swap 1-pour-1 capacite-neutre), FORBIDDEN si pas sur le repas cible, ASSISTANT_SWAP_STALE (defense en profondeur) ; annulation par le demandeur seul ; auto-annulation en cascade quand la fiche du demandeur change (leave direct, devient chef, rejoint l'equipe courses) ; notifications `KITCHEN_ASSISTANT_SWAP_REQUESTED`/`_ACCEPTED` (Lot H)
- `integration/kitchenPlanning.test.ts` + `unit/kitchenPlanning.test.ts` - Generation/reset planning (grille depuis dates `computeExpectedSlots` Paris multi-jours/1 jour/2 jours, repartition sur nouveaux creneaux, exclusion chefs/courses, idempotence double-generate, coexistence d'un repas seede hors-grille, overCapacity ; `POST /reset` supprime tous les repas en gardant les rosters, `/generate` reconstruit la grille apres reset ; `computeMealCapacities` floor/reste/clamps) ; notification `KITCHEN_OVERCAPACITY` au chef d'un repas sur-occupe (Lot H)
- `unit/conflicts.test.ts` - Moteur de conflits unifie (CookV1 Lot F) : computeConflicts pur (chevauchement/adjacence, garde-fou meme source, isolation par personne, 3 engagements simultanes, comptage multi-personnes sur une source)
- `unit/timezone.test.ts` - `util/timezone.ts` (ParisTimezone) : `getZoneOffsetMs` CET/CEST, `zonedWallClockToUtc` (double passe DST, cas aux bornes 2026-03-29/2026-10-25), `zonedYMD` (jour calendaire Paris pres de minuit UTC)
- `integration/kitchenConflicts.test.ts` - Conflit cross-domaine (CookV1 Lot F) : chef occupe par son repas + inscrit a une table (visible chef ET MJ), pas de conflit si disjoint, equipier inscrit a un repas + une table chevauchante (visibilite personne/chef)
- `integration/shoppingList.test.ts` + `unit/shoppingList.test.ts` - Module Courses (KitchenCourses). Integration : matrice de droits complete (403 pour un participant ordinaire, un chef, un admin nu et un admin `admin.kitchen` seul ; 200 pour un admin `admin.courses` et pour un membre de l'equipe courses sans droit admin), les trois vues renvoyees d'un coup, repas sans ingredient present dans `byMeal` et absent de `flat`/`aggregated`, trois listes vides si pas d'EventKitchen ; export xlsx (bon Content-Type + `Content-Disposition: attachment` + signature zip "PK" pour les 3 vues, 400 `INVALID_EXPORT_VIEW` sur vue inconnue/absente, 403 sans droit). Unit (fonction pure `buildShoppingViews`) : conversion masse (500 g + 1 kg = 1,5 kg) et volume (seuil L), non-conversion cas/cac/piece (lignes distinctes du meme nom), normalisation casse/espaces du nom avec premiere graphie conservee, tri fr insensible aux accents, repas contributeurs sans doublon, commentaires attribues a leur repas et vides ecartes, arrondi 3 decimales
- `integration/kitchenPurge.test.ts` - Extension purge (CookV1 Lot G) : EventKitchen+chefRoleId+config conserves, repas (cascade ingredients/assistants/AssistantSwapRequest)/courses/chefs MANUAL purges, chefs ROLE preserves par la suppression ; reconstitution ROLE au re-import (adminSync mocke : le container dev a un vrai token/guild Discord, jamais solliciter le reseau reel en test) ; no-op si pas d'EventKitchen

### Frontend (ROADMAP COMPLETE)

- `BoardGameCard.test.tsx` - Rendu nom/annee, joueurs/duree, bouton Remove (aria-label "Remove <game>"), masquage pour autre utilisateur
- `useIsMobile.test.tsx` - Hook : valeur initiale matchMedia, mise a jour sur change, cleanup listener
- `useOnlineStatus.test.tsx` - Hook : valeur initiale navigator.onLine, evenements online/offline, cleanup listeners
- `useEventSocket.test.tsx` - Join immediat, re-join + onReconnected apres une reconnexion (pas au premier connect), cleanup listener
- `useNotifications.test.tsx` - Fetch initial + unread count, toast d'erreur sur chaque catch (fetch/markAsRead/delete), refetch au reconnect socket, sync multi-appareils (read/read-all/deleted idempotents, echo local sans double decrement, item hors page charge, dedoublonnage notification:new)
- `EmptyState.test.tsx` - Rendu titre, description optionnelle, icone, action
- `FAB.test.tsx` - Rendu bouton, aria-label, click handler
- `Skeleton.test.tsx` - Variantes (Text, Card, CardGrid, BoardGame, Notification, TableDetail, EventDetail)
- `computeLayout.test.ts` - computeSeatBreakdown/formatSeatSummary/formatParticipantsHeading/formatVacantReservedSeats sur toute la matrice reservedSeats (sans reservation, partielle+places libres, complete+places libres, places libres epuisees mais reserve vacante, reservation totale pourvue/non pourvue), singulier/pluriel
- `TableCard.test.tsx` - Rendu titre/GM/pitch/tags, badges (GM, conflit, waitlist, joined, joueur reserve), badge "libre" masque quand reservedSeats=maxPlayers, click
- `NotificationItem.test.tsx` - Rendu contenu, lu/non-lu, navigation eventId, mark as read, delete, icones par type, routage par type (PARTICIPANT_REMOVED/EVENT_DELETED -> /events, TABLE_DELETED/PLAYER_KICKED sans ?table), onNavigate (fermeture panneau) ; types cuisine (Lot H) -> `/events/:eventId?tab=kitchen`
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
- `NumberStepper.test.tsx` - Increment/decrement, disable aux bornes min/max, prop step ; saisie clavier / pave numerique (valeur directe, clamp au max, zero, champ vide tolere puis resynchro au blur, filtrage des caracteres non numeriques)
- `ManualBoardGameForm.test.tsx` - Champs requis, validation Name, soumission valeurs numeriques (stepper), cancel
- `TagInput.test.tsx` - Badges, ajout (Enter/comma), suppression, dedupe, backspace, suggestions API, loading/erreur/aucun-resultat pendant la recherche
- `LoginPage.test.tsx` - Redirect si connecte, fallback message si Discord 503 (formulaire password masque), OAuth click, error param
- `AddBoardGameModal.test.tsx` - Modes search/manual, ajout local, import BGG, close
- `AdminBoardGamePanel.test.tsx` - Liste, total, edit/delete/merge modals, empty state recherche sans resultat
- `EventListPage.test.tsx` - Fetch/affichage, empty state, etat d'erreur distinct + retry, FAB/bouton creation selon droit admin.events (admin sans droit = pas de bouton)
- `EventDetailPage.test.tsx` - Skeleton pendant le chargement puis contenu, params non definis, onglet Cuisine masque a un USER classique / visible admin ou chef (point 10)
- `CreateEventModal.test.tsx` - Submit succes, validation croisee endDateTime > startDateTime
- `EditEventModal.test.tsx` - Submit succes, validation croisee endDateTime > startDateTime
- `ProfilePage.test.tsx` - Link/unlink Discord, confirmation avant unlink, disabled selon email, section droits admin (toggles, master toggle + confirmation, appels updatePreferences)
- `CreateTableModal.test.tsx` - Render, JDR/JDS conditional, validation, submit, cancel, stepper reservedSeats plafonne a maxPlayers
- `EditTableModal.test.tsx` - Encart occupation actuelle, avertissement + confirm avant demotion (maxPlayers/reservedSeats), submit sans confirm si pas d'impact
- `TableDetailModal.test.tsx` - Fetch, render, boutons selon role (Rejoindre/Quitter/Modifier/Supprimer), join/delete API, badge "reservee" par joueur, boutons de promotion waitlist (simple ou double libre+reservee selon disponibilite, payload `seat`), bouton disabled si table pleine, conversion en place d'un joueur confirme (libre<->reservee), Modifier/Supprimer admin conditionnes au droit admin.tables, titre "Places de la table" des que reservedSeats>0 (sinon "Participants"), notice place(s) reservee(s) vacante(s) (singulier/pluriel + elision "l'attribuera"/"les attribuera", phrasing canEdit vs visiteur), notice absente si tout est pourvu ou visible meme sans participant confirme, encart explicatif pres du bouton Rejoindre quand rejoindre ne mene qu'a la liste d'attente a cause d'une reservation (absent si table simplement pleine)
- `KitchenTab.test.tsx` - Matrice de visibilite CookV1 (equipier masque, chef = claim picker sans panneau gestion, panneau gestion visible manager/admin, redirection auto sur "Mon repas" pour un chef+manager) ; admin+chef (pas responsable) recoit un selecteur Vue d'ensemble/Mon repas (au lieu de perdre l'acces dashboard), landing auto sur "Mon repas" (point 5 etendu) ; allergies et aversions cablees en deux blocs distincts en haut de "Mon repas"
- `KitchenNotesPanels.test.tsx` - Fiches allergies/aversions du chef : rien si les deux champs sont vides ou blancs, deux blocs cote a cote sur desktop (`md:grid-cols-2`, aucun `<details>`), sauts de ligne conserves (`whitespace-pre-line` + textContent identique a la saisie), pleine largeur quand une seule fiche est remplie, accordeon replie sur mobile pour les aversions uniquement (les allergies restent toujours visibles)
- `KitchenBoard.test.tsx` - Masquage si equipier + toggle off, visible toujours pour chef, matrice jour x service, badge "Sans chef", join/move/leave jamais propose a un chef/membre courses (point 4), banniere "choisis ton creneau" (point 11), disabled si complet, panneau AssistantSwapPanel monte pour un equipier avec un creneau uniquement (Evolutions.md point 4)
- `KitchenManagementPanel.test.tsx` - Modales de confirmation (retrait chef, generation planning, reinitialisation planning) + annulation, mode role (roster lecture seule), toggle Generer/Reinitialiser selon `meals.length`, affichage `capacitySummary` + jauge/note sur-allocation (Evolutions.md point 2), grille responsive des blocs roster (point 6) ; deux fiches de notes distinctes (allergies au-dessus des aversions, etats vides propres, PATCH `dislikesNotes` seul sans toucher aux allergies, sauts de ligne internes preserves par le `trim`, rendu `whitespace-pre-line`) ; tests du reglage chefRoleId deplaces dans `ChefRoleSettings.test.tsx`
- `ChefRoleSettings.test.tsx` - Popover reglage chefRoleId (extrait de KitchenManagementPanel) : confirmation avant ecrasement des chefs MANUAL au set d'un chefRoleId + annulation, pas de confirmation si inchange
- `KitchenDashboard.test.tsx` - Vue d'ensemble admin (Evolutions.md point 5, refonte UI meme habillage que Gestion) : listes nominatives chefs/courses/sans-affectation + equipiers par repas en lecture seule (aucun bouton), grille responsive, badge Publie (vert) / Non publie (orange) du planning equipier (point 7) ; badges vege/carne lecture seule + badge warning si la somme ne correspond plus a `eventParticipantsCount` (KitchenDietSplit)
- `MealFichesList.test.tsx` - Liste Gestion (Admin Chef) : empty state, pas de champ jour/debut/fin ni bouton supprimer, chef picker sur un creneau orphelin (PATCH), ajout/retrait equipier (POST/DELETE `.../assistants/:userId`), clic ligne -> modale details lecture seule -> "Modifier" -> "Valider" (un seul PATCH, fermeture), grille responsive des cartes (point 6) ; ligne "Repas" vege/carne : auto-equilibrage (edit un champ recalcule l'autre contre `eventParticipantsCount`, un seul PATCH groupe), warning si la somme ne correspond plus, note "a jour" sinon (KitchenDietSplit) ; enregistrement differe (correctif UX section 10) : vase communicant affiche immediatement, rafale de clics regroupee en un seul PATCH sans gel des steppers, retour a 0 / 100% carne au clavier, flush du brouillon en attente au demontage
- `MealFicheEditor.test.tsx` - "Mon repas" (chef, inchange) : autosave par champ sans bouton (debounce nom), resume horaires/capacite en lecture seule, warning nombre d'equipiers avant suppression, reset des champs au changement de repas ; bloc lecture seule vege/carne + note informative non-actionnable si la somme ne correspond plus a `eventParticipantsCount` (KitchenDietSplit)
- `MealSwapPanel.test.tsx` - Dropdown liste les creneaux d'autres chefs ET les creneaux libres (tag "libre"), propose un echange (POST /swaps) sans confirmation vs prend un creneau libre (POST /meals/:id/move) avec confirmation modale (Evolutions.md point 1)
- `AssistantSwapPanel.test.tsx` - Filtre les creneaux complets uniquement comme candidats, empty state, propose/annule/accepte une demande (Evolutions.md point 4)
- `useDebouncedSave.test.tsx` - Auto-save differe : jamais de sauvegarde au montage, rafale de changements groupee en un seul envoi de la derniere valeur, envoi du brouillon en attente au demontage (filet de securite), pas de doublon si tout est deja sauvegarde ni si une requete est encore en vol
- `IngredientListInput.test.tsx` - Quantite virgule ET point acceptees (point 8), pas de commit sur saisie non-parsable ; commentaire par ingredient (masque tant qu'il n'est pas demande, remonte la saisie, reaffiche un commentaire existant) ; debit de l'autocompletion produit (pas de recherche sous 2 caracteres, une seule requete pour un nom tape en continu)
- `UtensilListInput.test.tsx` - Badges, ajout (Enter), autocomplete `/api/kitchen/utensils` (point 7)
- `useEventSocket.test.tsx` (CookV1) - Reaction aux evenements `kitchen:*` (config-updated, meal-changed, assistant-changed, planning-generated, swap-request-changed, assistant-swap-changed)
- `dateTime.test.ts` (ParisTimezone) - Toutes les fonctions de `utils/dateTime.ts` : conversions heure murale Paris <-> UTC (cas aux bornes DST 2026), inputs (`parisDateInputValue`/`parisTimeInputValue`/`parisDateTimeInputValue`), "fake UTC" FullCalendar (`toParisFakeUtc`/`fromParisFakeUtc` round-trip, `formatFakeUtcDate`)

Roadmap tests a venir : `docs/features/frontend-tests/ROADMAP.md` (phase 8 - pages)

### Couverture (seuils CI)

- Backend : seuil 50%/50%
- Frontend : seuil 50%/50%
