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

| Method | Path                                   | Auth                       | Description        |
| ------ | -------------------------------------- | -------------------------- | ------------------ |
| POST   | `/api/events/:eventId/invitations`     | requireAuth + requireAdmin | Create invitation  |
| GET    | `/api/invitations/:token`              | Public                     | Validate token     |
