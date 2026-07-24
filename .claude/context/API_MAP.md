# API Map - Endpoints

## Format d'erreur

`{ error: { message, status, code? } }` — `message` reste en anglais (logs/tests) ;
`code` est un identifiant stable optionnel (ex. `TABLE_NOT_FOUND`, `NO_OPEN_SEAT`)
pose via `createError(status, msg, { code })` et mappe en francais cote front dans
`frontend/src/config/apiErrors.ts` (`getErrorMessage(err, fallback)`). Ne jamais
afficher le message anglais brut dans l'UI.

## Health

| Method | Path      | Description  |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |

## Auth (`/api/auth`)

| Method | Path                | Description                                                                  |
| ------ | ------------------- | ---------------------------------------------------------------------------- |
| POST   | `/login`            | Login with identifier (email/username) + password (rate limited)             |
| POST   | `/logout`           | Destroy session                                                              |
| GET    | `/me`               | Get current user (inclut discordId, discordUsername, avatarUrl, preferences) |
| GET    | `/discord`          | Initie OAuth Discord — retourne `{ url }` (503 si non configure)             |
| GET    | `/discord/callback` | Callback OAuth — echange code, sync roles, cree session, redirect            |
| DELETE | `/discord/link`     | Dissocie Discord du compte local (requireAuth, interdit si Discord-only)     |

Note : plus de signup ni d'invitations — la creation de compte passe par Discord OAuth (sync roles).

## Events (`/api/events`)

| Method | Path              | Auth                                  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ----------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/`               | requireAuth + requireAdmin            | Create event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| GET    | `/`               | requireAuth                           | List events (USER/ADMIN, `?mine=true` force le filtre participation meme pour ADMIN)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| GET    | `/:eventId`       | requireAuth + requireEventParticipant | Event detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| PATCH  | `/:eventId`       | requireAuth + requireEventCreator     | Update event — emet `event:updated` (room event) + notif EVENT_UPDATED aux participants (sauf auteur) si nom/dates changent                                                                                                                                                                                                                                                                                                                                                                                                                     |
| POST   | `/:eventId/purge` | requireAuth + requireAdmin            | Purge silencieuse : supprime tables/participations/jeux, garde l'event (et son discordRoleId) puis re-importe les participants du role Discord — 200 `{ data: { resyncedParticipants: number \| null } }` (null si pas de role ou bot indisponible). CookV1 (Lot G) : garde aussi `EventKitchen`+`chefRoleId`, purge repas (cascade ingredients/ustensiles/inscriptions)/equipe courses/chefs `MANUAL` ; chefs `ROLE` reconstitues via `syncChefRoleRoster` une fois les participants re-importes (best-effort, silencieux si bot indisponible) |
| DELETE | `/:eventId`       | requireAuth + requireEventCreator     | Delete event + cascade — emet `event:deleted` + notif EVENT_DELETED aux participants (sauf auteur)                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Participants (`/api/events/:eventId/participants`)

| Method | Path       | Auth                                  | Description        |
| ------ | ---------- | ------------------------------------- | ------------------ |
| GET    | `/`        | requireAuth + requireEventParticipant | List participants  |
| DELETE | `/me`      | requireAuth + requireEventParticipant | Leave event        |
| DELETE | `/:userId` | requireAuth + requireEventCreator     | Remove participant |

## GameTables (`/api/events/:eventId/tables`)

| Method | Path                                    | Auth                                  | Description                                                                                                                                                                                                                                                                           |
| ------ | --------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/`                                     | requireAuth + requireEventParticipant | Create table                                                                                                                                                                                                                                                                          |
| GET    | `/`                                     | requireAuth + requireEventParticipant | List tables — `currentUserConflict`/`conflictingPlayerCount` calcules par le moteur de conflits UNIFIE tables+cuisine (`services/conflicts.ts`, Lot F) : une occupation cuisine (chef sur son repas, equipier inscrit) qui chevauche la table compte aussi                            |
| GET    | `/:tableId`                             | requireAuth + requireEventParticipant | Table detail                                                                                                                                                                                                                                                                          |
| PATCH  | `/:tableId`                             | requireAuth + requireTableGMOrAdmin   | Update table — toggle gmIsPlayer : cree/supprime la place du MJ (maxPlayers +1/-1), personne demote/promu                                                                                                                                                                             |
| DELETE | `/:tableId`                             | requireAuth + requireTableGMOrAdmin   | Delete table                                                                                                                                                                                                                                                                          |
| POST   | `/:tableId/join`                        | requireAuth + requireEventParticipant | Join table                                                                                                                                                                                                                                                                            |
| DELETE | `/:tableId/leave`                       | requireAuth                           | Leave table                                                                                                                                                                                                                                                                           |
| DELETE | `/:tableId/participants/:userId`        | requireAuth + requireTableGMOrAdmin   | Kick player — 400 si la cible est le MJ assis a sa table (JDS/MJ joueur)                                                                                                                                                                                                              |
| PATCH  | `/:tableId/participants/:userId/status` | requireAuth + requireTableGMOrAdmin   | Promote/demote player (GM/admin), body `{ status, seat }` — `seat` OBLIGATOIRE si status=CONFIRMED (choisit ou convertit libre/reservee ; RESERVED interdit pour le MJ). Demote : 400 si cible = MJ, 409 si deja en waitlist, le joueur repart en fin de file (joinedAt reinitialise) |

## Tags (`/api/tags`)

| Method | Path   | Auth        | Description      |
| ------ | ------ | ----------- | ---------------- |
| GET    | `/?q=` | requireAuth | Tag autocomplete |

## Board Games (`/api/boardgames`)

| Method | Path            | Auth        | Description                      |
| ------ | --------------- | ----------- | -------------------------------- |
| GET    | `/search?q=`    | requireAuth | Recherche (local + fallback BGG) |
| GET    | `/:boardGameId` | requireAuth | Detail (lazy fetch BGG si stub)  |
| POST   | `/`             | requireAuth | Creation manuelle                |
| POST   | `/from-bgg`     | requireAuth | Find or create from BGG data     |

## Notifications (`/api/notifications`)

| Method | Path            | Auth        | Description                 |
| ------ | --------------- | ----------- | --------------------------- |
| GET    | `/`             | requireAuth | List (pagine, cursor-based) |
| GET    | `/unread-count` | requireAuth | Unread count                |
| PATCH  | `/:id/read`     | requireAuth | Mark as read                |
| PATCH  | `/read-all`     | requireAuth | Mark all as read            |
| DELETE | `/:id`          | requireAuth | Delete notification         |

Evenements socket emis vers la room `user:<userId>` (sync multi-appareils/onglets) :
`notification:new { notification }` (creation), `notification:read { id }`,
`notification:read-all {}`, `notification:deleted { id }`. La creation de
notification est non-bloquante (echec logge, retourne null/[], l'action metier
n'echoue jamais a cause d'une notification).

Types cuisine (module Kitchen, cf ci-dessous) : `KITCHEN_SWAP_REQUESTED`/`_ACCEPTED`/`_REJECTED`
(echange entre chefs), `KITCHEN_ASSISTANT_SWAP_REQUESTED`/`_ACCEPTED` (echange entre equipiers),
`KITCHEN_CHEF_ADDED`/`_REMOVED` (roster chef, manuel ou sync role Discord), `KITCHEN_MEAL_CLAIMED`
(un chef reclame un creneau ou des equipiers sont deja inscrits), `KITCHEN_OVERCAPACITY`
(sur-occupation post-generation, notifie le chef du repas). Tous `metadata: { eventId, ... }`,
deep-link frontend vers `/events/:eventId?tab=kitchen`. La sync continue du roster chef via
le bot Discord (`discord-bot/src/services/syncKitchenChef.ts`) ecrit directement la ligne
`Notification` (pas de push socket temps reel depuis ce process separe).

## Preferences (`/api/me`)

| Method | Path           | Auth        | Description                                                                                      |
| ------ | -------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| PATCH  | `/preferences` | requireAuth | Update bulk `{ cle: bool }` — liste blanche, cles `admin.*`/`beta.*` reservees ADMIN (403 sinon) |

Cles : admin.events, admin.tables, admin.games, admin.kitchen, beta.pdfExport, beta.gameDb. Retourne la map complete.

## Kitchen (`/api/events/:eventId/kitchen`) — module cuisine (CookV1)

Voir `docs/features/CookV1/SPEC_COOKING.md`. `requireKitchenManager` = ADMIN + preference
`admin.kitchen`. GET est module par role (`currentUserKitchenRole`) : voir 9 de la spec pour
la matrice exacte de champs exposes (anti-fuite allergies/ingredients pour un equipier ET
pour un ADMIN sans `admin.kitchen`, qui recoit un bloc `dashboard` en plus). Ce bloc `dashboard`
est cumulatif avec le role chef (`hasAdminOverview = isAdmin && !manager`, independant de
`isChef`) : un admin qui est aussi chef recoit le `dashboard` ET ses propres allergies/
ingredients/ustensiles (via `isFullReader`), plus exclusifs comme avant. La reponse expose
aussi `isChef` et `isCoursesMember` (booleens, flags self) independamment de
`currentUserKitchenRole` : `isChef` distingue un responsable qui est aussi chef (cf 4/9 de la
spec) ; `isCoursesMember` sert au front a masquer le bouton "S'inscrire" du board Infos a un
membre de l'equipe courses (role-exclusivite, Evolutions.md point 4).

| Method | Path               | Auth                                  | Description                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/`                | requireAuth + requireEventParticipant | Config + roster chef + courses + repas, module par role ; etat par defaut si pas d'EventKitchen (pas de 404). Chaque repas expose `currentUserConflict`/`conflictingCount` (moteur de conflits unifie tables+cuisine, Lot F — cf `services/conflicts.ts`), rendus dans l'onglet Planning. Bloc manager uniquement : `capacitySummary: { allocated, poolTotal }` (places reparties vs pool total, Admin Chef point 4) |
| PATCH  | `/`                | requireAuth + requireKitchenManager   | Config (chefRoleId, allergiesNotes, equipierPlanningEnabled) — cree l'EventKitchen a la 1re ecriture ; set chefRoleId ecrase les chefs MANUAL et sync le roster ROLE (best-effort)                                                                                                                                                                                                                                   |
| POST   | `/chefs`           | requireAuth + requireKitchenManager   | Ajout chef manuel (mode manuel seulement, participants only) — 400 `CHEF_ROLE_MODE_ACTIVE` si chefRoleId actif, 409 `ALREADY_CHEF`                                                                                                                                                                                                                                                                                   |
| DELETE | `/chefs/:userId`   | requireAuth + requireKitchenManager   | Retrait chef manuel — orpheline son repas (chefUserId=null) ; 404 `NOT_IN_CHEF_ROSTER`                                                                                                                                                                                                                                                                                                                               |
| POST   | `/courses`         | requireAuth + requireKitchenManager   | Ajout membre courses (participants only) — 409 `ROLE_EXCLUSIVITY` si chef/equipier deja inscrit, 409 `ALREADY_COURSES_MEMBER`                                                                                                                                                                                                                                                                                        |
| DELETE | `/courses/:userId` | requireAuth + requireKitchenManager   | Retrait membre courses — 404 `NOT_COURSES_MEMBER`                                                                                                                                                                                                                                                                                                                                                                    |

Codes d'erreur specifiques : `KITCHEN_MANAGER_REQUIRED`, `CHEF_ROLE_MODE_ACTIVE`, `ALREADY_CHEF`,
`NOT_IN_CHEF_ROSTER`, `ALREADY_COURSES_MEMBER`, `NOT_COURSES_MEMBER`, `ROLE_EXCLUSIVITY`,
`ALLERGIES_TOO_LONG` (+ `NOT_EVENT_PARTICIPANT` reutilise).

### Repas & inscriptions (meme prefixe, `requireMealChefOrManager` = chef proprietaire du

repas OU responsable cuisine)

| Method | Path                                | Auth                                   | Description                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ----------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PATCH  | `/meals/:mealId`                    | requireAuth + requireMealChefOrManager | Edite un repas ; le chef proprietaire n'edite que `name`/ingredients/ustensiles. `service`, `startDateTime`, `endDateTime`, `maxAssistants`, `chefUserId` (reassignation d'un orphelin, 400 `MEAL_NOT_ORPHAN`) reserves au manager (403 `FORBIDDEN`)                                                                                                                                               |
| DELETE | `/meals/:mealId`                    | requireAuth + requireMealChefOrManager | Supprime un repas (cascade ingredients/ustensiles/inscriptions) — plus expose dans l'UI Admin Chef (creneau genere non supprimable, point 5), conserve pour "Mon repas" (chef sur son propre creneau)                                                                                                                                                                                              |
| POST   | `/meals/:mealId/claim`              | requireAuth + requireEventParticipant  | Un chef du roster reclame un creneau orphelin de la grille (verrou de ligne) — 403 `NOT_IN_CHEF_ROSTER`, 409 `MEAL_ALREADY_CLAIMED`, 409 `CHEF_ALREADY_HAS_MEAL`                                                                                                                                                                                                                                   |
| POST   | `/meals/:mealId/move`               | requireAuth + requireEventParticipant  | Evolutions.md point 1 : un chef ayant deja un repas se deplace INSTANTANEMENT vers un creneau orphelin (pas de confirmation d'un tiers, contrairement a `/swaps`) — le creneau quitte devient orphelin (equipiers/horaires/capacite inchanges), recette+chef suivent. 404 `NOT_A_CHEF_WITH_MEAL`/`MEAL_NOT_FOUND`, 400 `SWAP_SAME_MEAL`/`MEAL_NOT_ORPHAN`, 409 `MEAL_ALREADY_CLAIMED`/`SWAP_STALE` |
| POST   | `/meals/:mealId/assistants`         | requireAuth + requireEventParticipant  | Equipier s'inscrit ou se deplace (transaction, verrou ligne repas) — 409 `MEAL_FULL`, `ROLE_EXCLUSIVITY` (chef/courses), `ALREADY_MEAL_ASSISTANT`                                                                                                                                                                                                                                                  |
| DELETE | `/meals/:mealId/assistants/me`      | requireAuth + requireEventParticipant  | Equipier se desinscrit — 404 `NOT_MEAL_ASSISTANT`                                                                                                                                                                                                                                                                                                                                                  |
| POST   | `/meals/:mealId/assistants/:userId` | requireAuth + requireKitchenManager    | Admin Chef point 5 : le manager assigne/deplace un equipier tiers sur un creneau (reutilise `joinOrMoveMeal`) — memes erreurs que l'auto-inscription + 400 `NOT_EVENT_PARTICIPANT`                                                                                                                                                                                                                 |
| DELETE | `/meals/:mealId/assistants/:userId` | requireAuth + requireKitchenManager    | Le manager retire un equipier tiers d'un creneau (reutilise `leaveMeal`)                                                                                                                                                                                                                                                                                                                           |

**Creation manuelle hors-grille retiree** (Admin Chef point 3) : tous les repas naissent desormais
de `/generate`. `POST /meals` (creneau orphelin `{date, service}`) et son schema `createMealSchema`
ont ete supprimes ; les tests seedent un `Meal` directement via Prisma quand un repas hors-grille
est necessaire.

Ingredients/ustensiles : listes envoyees dans le body de PATCH (`ingredients: [{name, quantity,
unit}]`, `utensils: [{name}]`), remplacement complet a chaque appel (delete+recreate). Les
ingredients font un find-or-create sur `Product` (nom normalise lowercase, cf `/api/kitchen/products`).

Codes supplementaires : `MEAL_NOT_FOUND`, `MEAL_NOT_ORPHAN`, `MEAL_START_OUT_OF_BOUNDS`,
`MEAL_END_OUT_OF_BOUNDS`, `ALREADY_MEAL_ASSISTANT`, `NOT_MEAL_ASSISTANT`, `NOT_EVENT_PARTICIPANT`
(+ `FORBIDDEN`, `END_BEFORE_START`, `INVALID_START_DATETIME`, `INVALID_END_DATETIME`,
`MEAL_ALREADY_EXISTS` (reassignation PATCH) reutilises).

### Generation / reset planning (meme prefixe)

| Method | Path        | Auth                                | Description                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ----------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/generate` | requireAuth + requireKitchenManager | Genere la grille de repas depuis les dates de l'event (Europe/Paris : diner J1, midi+soir intermediaires, rien le dernier jour ; heures 10h30-13h / 18h30-21h). Idempotent : ne recree/modifie jamais un creneau existant (cle `startDateTime`+`service`), ajoute seulement les manquants. Repartit `remainingPool = pool - sum(existants)` sur les nouveaux. Reponse `{ pool, createdCount, mealCount, capacities, overCapacity }`. |
| POST   | `/reset`    | requireAuth + requireKitchenManager | Admin Chef points 1/2 : supprime tous les repas de l'event (cascade ingredients/ustensiles/inscriptions/echanges), garde les rosters chefs/equipe courses intacts. Reponse `{ deletedCount }`. Cote UI, remplace le bouton "Generer" des que des repas existent                                                                                                                                                                      |

### Echange de creneau entre chefs (`/swaps`, meme prefixe)

| Method | Path                           | Auth                                  | Description                                                                                                                               |
| ------ | ------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/swaps`                       | requireAuth + requireEventParticipant | Demandes PENDING visibles par l'appelant (demandeur/cible, ou toutes si manager)                                                          |
| POST   | `/swaps`                       | requireAuth + requireEventParticipant | Propose un echange `{ targetMealId }` — 404 `NOT_A_CHEF_WITH_MEAL`, 400 `TARGET_MEAL_ORPHAN`/`SWAP_SAME_MEAL`, 409 `SWAP_ALREADY_PENDING` |
| POST   | `/swaps/:swapRequestId/accept` | requireAuth + requireEventParticipant | Cible accepte : swap chef+nom+ingredients+ustensiles ; equipiers/horaires/service inchanges. 403/409 `SWAP_STALE`/`SWAP_NOT_PENDING`      |
| POST   | `/swaps/:swapRequestId/reject` | requireAuth + requireEventParticipant | Cible refuse (statut REJECTED)                                                                                                            |
| POST   | `/swaps/:swapRequestId/cancel` | requireAuth + requireEventParticipant | Demandeur annule (statut CANCELLED)                                                                                                       |

### Echange de creneau entre equipiers (`/assistant-swaps`, meme prefixe, Evolutions.md point 4)

La cible est un REPAS, pas une personne : n'importe quel `MealAssistant` courant du repas
cible peut accepter (premier arrive, premier servi) — pas de `reject` individuel possible,
seulement `accept`/`cancel`. Creation bloquee (`TARGET_MEAL_HAS_SEATS`) si le repas cible a
encore une place libre (l'equipier doit utiliser `/meals/:mealId/assistants`, deplacement
direct, deja possible). Une demande PENDING en attente est annulee automatiquement (statut
CANCELLED) des que la fiche `MealAssistant` du demandeur change (leave/move/reassignation
manager/auto-desinscription role cuisine) — voir `kitchen.ts::cancelStaleAssistantSwapRequests`,
aussi duplique cote discord-bot (`syncKitchenChef.ts::materializeRoleChef`).

| Method | Path                                              | Auth                                  | Description                                                                                                                                                                                                                       |
| ------ | ------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/assistant-swaps`                                | requireAuth + requireEventParticipant | Demandes PENDING visibles par l'appelant (mes demandes envoyees + celles ciblant mon repas actuel, ou toutes si manager)                                                                                                          |
| POST   | `/assistant-swaps`                                | requireAuth + requireEventParticipant | Propose un echange `{ targetMealId }` — 404 `NOT_MEAL_ASSISTANT`/`MEAL_NOT_FOUND`, 400 `ASSISTANT_SWAP_SAME_MEAL`, 409 `TARGET_MEAL_HAS_SEATS`/`ASSISTANT_SWAP_ALREADY_PENDING`                                                   |
| POST   | `/assistant-swaps/:assistantSwapRequestId/accept` | requireAuth + requireEventParticipant | N'importe quel equipier actuellement sur le repas cible accepte : echange 1-pour-1 des `MealAssistant.mealId`, capacite-neutre. 403 `FORBIDDEN` (pas sur le repas cible), 409 `ASSISTANT_SWAP_STALE`/`ASSISTANT_SWAP_NOT_PENDING` |
| POST   | `/assistant-swaps/:assistantSwapRequestId/cancel` | requireAuth + requireEventParticipant | Demandeur annule (statut CANCELLED)                                                                                                                                                                                               |

## Kitchen Products (`/api/kitchen/products`) — autocomplete ingredients (CookV1)

| Method | Path | Auth        | Description                                           |
| ------ | ---- | ----------- | ----------------------------------------------------- |
| GET    | `/`  | requireAuth | Autocomplete produits (`?q=`), calque sur `/api/tags` |

## Kitchen Utensils (`/api/kitchen/utensils`) — autocomplete ustensiles (CookV1, Evolutions.md point 7)

| Method | Path | Auth        | Description                                                                                                                       |
| ------ | ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/`  | requireAuth | Autocomplete ustensiles (`?q=`), calque sur `/api/tags` — find-or-create a l'ajout via PATCH meal (`utensilId` sur `MealUtensil`) |

## Admin (`/api/admin`)

| Method | Path                    | Auth                       | Description                                      |
| ------ | ----------------------- | -------------------------- | ------------------------------------------------ |
| POST   | `/discord/sync`         | requireAuth + requireAdmin | Sync manuelle membres Discord → DB (pas d'UI)    |
| GET    | `/boardgames`           | requireAuth + requireAdmin | Liste paginee des jeux (recherche `?search=`)    |
| PATCH  | `/boardgames/:id`       | requireAuth + requireAdmin | Edition d'un jeu (champs admin)                  |
| DELETE | `/boardgames/:id`       | requireAuth + requireAdmin | Suppression d'un jeu                             |
| POST   | `/boardgames/:id/merge` | requireAuth + requireAdmin | Fusion de deux jeux (choix des champs par field) |

## Event Board Games (`/api/events/:eventId/boardgames`)

| Method | Path   | Auth                                  | Description                |
| ------ | ------ | ------------------------------------- | -------------------------- |
| POST   | `/`    | requireAuth + requireEventParticipant | Ajouter un jeu a l'event   |
| GET    | `/`    | requireAuth + requireEventParticipant | Lister les jeux de l'event |
| DELETE | `/:id` | requireAuth + requireEventParticipant | Retirer un jeu de l'event  |

## Test (`/api/test`) — seed E2E

Monte uniquement si `NODE_ENV=test` ou `ENABLE_TEST_ROUTES=true`.

| Method | Path                | Description                 |
| ------ | ------------------- | --------------------------- |
| POST   | `/seed-admin`       | Cree un admin de test       |
| POST   | `/seed-participant` | Cree un participant de test |
