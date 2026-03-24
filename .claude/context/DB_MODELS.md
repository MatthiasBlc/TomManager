# DB Models - Schema Prisma

## Session

| Field     | Type     | Notes              |
| --------- | -------- | ------------------ |
| id        | String   | PK                 |
| sid       | String   | Unique session ID  |
| data      | String   | Serialized session |
| expiresAt | DateTime | Expiration         |

## User

| Field        | Type      | Notes                   |
| ------------ | --------- | ----------------------- |
| id           | String    | UUID PK                 |
| email        | String    | Unique                  |
| username     | String    | Unique                  |
| passwordHash | String    | Bcrypt hash             |
| role         | Role      | USER (default) or ADMIN |
| createdAt    | DateTime  | Auto                    |
| updatedAt    | DateTime  | Auto                    |
| deletedAt    | DateTime? | Soft delete             |

## Enum Role

USER | ADMIN
