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

Relations: createdEvents, sentInvitations, eventParticipations, createdGameTables, gameTableParticipations

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

Relations: creator (User), invitations, participations, gameTables

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

## GameTable

| Field         | Type     | Notes                        |
| ------------- | -------- | ---------------------------- |
| id            | String   | UUID PK                      |
| eventId       | String   | FK -> Event.id               |
| createdBy     | String   | FK -> User.id (GM)           |
| title         | String   | required, 1-150 chars        |
| pitch         | String?  | max 2000 chars               |
| triggers      | String?  | max 1000 chars               |
| comments      | String?  | max 1000 chars               |
| maxPlayers    | Int      | required, 1-20               |
| startDateTime | DateTime | >= event.startDateTime       |
| endDateTime   | DateTime | <= event.endDateTime         |
| createdAt     | DateTime | Auto                         |
| updatedAt     | DateTime | Auto                         |

Index: (eventId, startDateTime)
Relations: event (Event), creator (User), tags (GameTableTag[]), participants (GameTableParticipant[])

## Tag

| Field | Type   | Notes          |
| ----- | ------ | -------------- |
| id    | String | UUID PK        |
| name  | String | Unique, lowercase |

Relations: gameTables (GameTableTag[])

## GameTableTag

| Field       | Type   | Notes              |
| ----------- | ------ | ------------------ |
| gameTableId | String | FK -> GameTable.id |
| tagId       | String | FK -> Tag.id       |

PK composite: (gameTableId, tagId)
onDelete Cascade sur gameTable
Relations: gameTable (GameTable), tag (Tag)

## GameTableParticipant

| Field       | Type                   | Notes              |
| ----------- | ---------------------- | ------------------ |
| id          | String                 | UUID PK            |
| gameTableId | String                 | FK -> GameTable.id |
| userId      | String                 | FK -> User.id      |
| status      | TableParticipantStatus | CONFIRMED default  |
| joinedAt    | DateTime               | Auto               |

Contrainte unique: (gameTableId, userId)
Index: (gameTableId, status)
onDelete Cascade sur gameTable
Relations: gameTable (GameTable), user (User)

## Enum Role

USER | ADMIN

## Enum InvitationStatus

PENDING | ACCEPTED | EXPIRED

## Enum TableParticipantStatus

CONFIRMED | WAITLIST
