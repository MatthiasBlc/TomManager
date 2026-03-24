# API Map - Endpoints

## Health

| Method | Path      | Description  |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |

## Auth (`/api/auth`)

| Method | Path      | Description            |
| ------ | --------- | ---------------------- |
| POST   | `/signup` | Create account         |
| POST   | `/login`  | Login with credentials |
| POST   | `/logout` | Destroy session        |
| GET    | `/me`     | Get current user       |

## Events (`/api/events`)

| Method | Path | Auth                    | Description  |
| ------ | ---- | ----------------------- | ------------ |
| POST   | `/`  | requireAuth + requireAdmin | Create event |
