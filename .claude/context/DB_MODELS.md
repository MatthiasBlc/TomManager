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

Relations: createdEvents, sentInvitations, eventParticipations

## Event

| Field         | Type     | Notes          |
| ------------- | -------- | -------------- |
| id            | String   | UUID PK        |
| name          | String   | required       |
| startDateTime | DateTime | UTC            |
| endDateTime   | DateTime | UTC            |
| createdBy     | String   | FK -> User.id  |
| createdAt     | DateTime | Auto           |
| updatedAt     | DateTime | Auto           |

Relations: creator (User), invitations, participations

## EventInvitation

| Field     | Type             | Notes                          |
| --------- | ---------------- | ------------------------------ |
| id        | String           | UUID PK                        |
| eventId   | String           | FK -> Event.id                 |
| email     | String           | required                       |
| invitedBy | String           | FK -> User.id                  |
| token     | String           | Unique, UUID v4                |
| expiresAt | DateTime         | = event.endDateTime            |
| status    | InvitationStatus | PENDING (default)              |
| createdAt | DateTime         | Auto                           |

Contrainte unique: (email, eventId)
Relations: event (Event), inviter (User)

## EventParticipation

| Field     | Type     | Notes                    |
| --------- | -------- | ------------------------ |
| id        | String   | UUID PK                  |
| eventId   | String   | FK -> Event.id           |
| userId    | String   | FK -> User.id            |
| status    | String   | default "CONFIRMED"      |
| createdAt | DateTime | Auto                     |
| updatedAt | DateTime | Auto                     |

Contrainte unique: (eventId, userId)
Relations: event (Event), user (User)

## Enum Role

USER | ADMIN

## Enum InvitationStatus

PENDING | ACCEPTED | EXPIRED
