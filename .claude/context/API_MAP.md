# API Map - Endpoints

## Health

| Method | Path      | Description  |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |

## Auth (`/api/auth`)

| Method | Path      | Description                                                 |
| ------ | --------- | ----------------------------------------------------------- |
| POST   | `/signup` | Create account (requires invitationToken, email must match) |
| POST   | `/login`  | Login with identifier (email/username), optional token      |
| POST   | `/logout` | Destroy session                                             |
| GET    | `/me`     | Get current user                                            |

## Events (`/api/events`)

| Method | Path          | Auth                              | Description                |
| ------ | ------------- | --------------------------------- | -------------------------- |
| POST   | `/`           | requireAuth + requireAdmin        | Create event               |
| GET    | `/`           | requireAuth                       | List events (USER/ADMIN)   |
| GET    | `/:eventId`   | requireAuth + requireEventParticipant | Event detail           |
| PATCH  | `/:eventId`   | requireAuth + requireEventCreator | Update event               |
| DELETE | `/:eventId`   | requireAuth + requireEventCreator | Delete event + cascade     |

## Invitations

| Method | Path                                   | Auth                              | Description           |
| ------ | -------------------------------------- | --------------------------------- | --------------------- |
| POST   | `/api/events/:eventId/invitations`     | requireAuth + requireAdmin        | Create invitation     |
| GET    | `/api/events/:eventId/invitations`     | requireAuth + requireEventCreator | List invitations      |
| GET    | `/api/invitations/:token`              | Public                            | Validate token        |

## Participants (`/api/events/:eventId/participants`)

| Method | Path         | Auth                              | Description          |
| ------ | ------------ | --------------------------------- | -------------------- |
| GET    | `/`          | requireAuth + requireEventParticipant | List participants |
| DELETE | `/me`        | requireAuth + requireEventParticipant | Leave event       |
| DELETE | `/:userId`   | requireAuth + requireEventCreator | Remove participant   |

## GameTables (`/api/events/:eventId/tables`)

| Method | Path          | Auth                                      | Description        |
| ------ | ------------- | ----------------------------------------- | ------------------ |
| POST   | `/`           | requireAuth + requireEventParticipant     | Create table       |
| GET    | `/`           | requireAuth + requireEventParticipant     | List tables        |
| GET    | `/:tableId`   | requireAuth + requireEventParticipant     | Table detail       |

## Tags (`/api/tags`)

| Method | Path    | Auth        | Description          |
| ------ | ------- | ----------- | -------------------- |
| GET    | `/?q=`  | requireAuth | Tag autocomplete     |
