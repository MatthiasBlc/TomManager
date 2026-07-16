# API Map - Endpoints

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

| Method | Path              | Auth                                  | Description                                                            |
| ------ | ----------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| POST   | `/`               | requireAuth + requireAdmin            | Create event                                                           |
| GET    | `/`               | requireAuth                           | List events (USER/ADMIN, `?mine=true` force le filtre participation meme pour ADMIN) |
| GET    | `/:eventId`       | requireAuth + requireEventParticipant | Event detail                                                           |
| PATCH  | `/:eventId`       | requireAuth + requireEventCreator     | Update event                                                           |
| POST   | `/:eventId/purge` | requireAuth + requireAdmin            | Purge silencieuse : supprime tables/participations/jeux, garde l'event |
| DELETE | `/:eventId`       | requireAuth + requireEventCreator     | Delete event + cascade                                                 |

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
| GET    | `/`                                     | requireAuth + requireEventParticipant | List tables                                                                                                                                                                                                                                                                           |
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

## Preferences (`/api/me`)

| Method | Path           | Auth        | Description                                                                                      |
| ------ | -------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| PATCH  | `/preferences` | requireAuth | Update bulk `{ cle: bool }` — liste blanche, cles `admin.*`/`beta.*` reservees ADMIN (403 sinon) |

Cles : admin.events, admin.tables, admin.games, beta.pdfExport, beta.gameDb. Retourne la map complete.

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
