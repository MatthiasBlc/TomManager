# API Map - Endpoints

## Health

| Method | Path      | Description  |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |

## Auth (`/api/auth`)

| Method | Path                | Description                                                              |
| ------ | ------------------- | ------------------------------------------------------------------------ |
| POST   | `/signup`           | Create account (requires invitationToken, email must match)              |
| POST   | `/login`            | Login with identifier (email/username), optional token                   |
| POST   | `/logout`           | Destroy session                                                          |
| GET    | `/me`               | Get current user (inclut discordId, discordUsername, avatarUrl)          |
| GET    | `/discord`          | Initie OAuth Discord — retourne `{ url }` (503 si non configure)        |
| GET    | `/discord/callback` | Callback OAuth — echange code, sync roles, cree session, redirect        |
| DELETE | `/discord/link`     | Dissocie Discord du compte local (requireAuth, interdit si Discord-only) |

## Events (`/api/events`)

| Method | Path        | Auth                                  | Description              |
| ------ | ----------- | ------------------------------------- | ------------------------ |
| POST   | `/`         | requireAuth + requireAdmin            | Create event             |
| GET    | `/`         | requireAuth                           | List events (USER/ADMIN) |
| GET    | `/:eventId` | requireAuth + requireEventParticipant | Event detail             |
| PATCH  | `/:eventId` | requireAuth + requireEventCreator     | Update event             |
| DELETE | `/:eventId` | requireAuth + requireEventCreator     | Delete event + cascade   |

## Invitations

| Method | Path                               | Auth                              | Description       |
| ------ | ---------------------------------- | --------------------------------- | ----------------- |
| POST   | `/api/events/:eventId/invitations` | requireAuth + requireAdmin        | Create invitation |
| GET    | `/api/events/:eventId/invitations` | requireAuth + requireEventCreator | List invitations  |
| GET    | `/api/invitations/:token`          | Public                            | Validate token    |

## Participants (`/api/events/:eventId/participants`)

| Method | Path       | Auth                                  | Description        |
| ------ | ---------- | ------------------------------------- | ------------------ |
| GET    | `/`        | requireAuth + requireEventParticipant | List participants  |
| DELETE | `/me`      | requireAuth + requireEventParticipant | Leave event        |
| DELETE | `/:userId` | requireAuth + requireEventCreator     | Remove participant |

## GameTables (`/api/events/:eventId/tables`)

| Method | Path                             | Auth                                  | Description  |
| ------ | -------------------------------- | ------------------------------------- | ------------ |
| POST   | `/`                              | requireAuth + requireEventParticipant | Create table |
| GET    | `/`                              | requireAuth + requireEventParticipant | List tables  |
| GET    | `/:tableId`                      | requireAuth + requireEventParticipant | Table detail |
| PATCH  | `/:tableId`                      | requireAuth + requireTableGMOrAdmin   | Update table |
| DELETE | `/:tableId`                      | requireAuth + requireTableGMOrAdmin   | Delete table |
| POST   | `/:tableId/join`                 | requireAuth + requireEventParticipant | Join table   |
| DELETE | `/:tableId/leave`                | requireAuth                           | Leave table  |
| DELETE | `/:tableId/participants/:userId` | requireAuth + requireTableGMOrAdmin   | Kick player  |

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

## Admin (`/api/admin`)

| Method | Path              | Auth                         | Description                              |
| ------ | ----------------- | ---------------------------- | ---------------------------------------- |
| POST   | `/discord/sync`   | requireAuth + requireAdmin   | Sync manuelle membres Discord → DB       |

## Event Board Games (`/api/events/:eventId/boardgames`)

| Method | Path   | Auth                                  | Description                |
| ------ | ------ | ------------------------------------- | -------------------------- |
| POST   | `/`    | requireAuth + requireEventParticipant | Ajouter un jeu a l'event   |
| GET    | `/`    | requireAuth + requireEventParticipant | Lister les jeux de l'event |
| DELETE | `/:id` | requireAuth + requireEventParticipant | Retirer un jeu de l'event  |
