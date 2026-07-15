# DB Models - Schema Prisma

## Session

| Field     | Type     | Notes              |
| --------- | -------- | ------------------ |
| id        | String   | PK                 |
| sid       | String   | Unique session ID  |
| data      | String   | Serialized session |
| expiresAt | DateTime | Expiration         |

## User

| Field           | Type      | Notes                                                |
| --------------- | --------- | ---------------------------------------------------- |
| id              | String    | UUID PK                                              |
| email           | String?   | Unique, nullable (comptes Discord n'ont pas d'email) |
| username        | String    | Unique                                               |
| passwordHash    | String?   | Bcrypt hash, nullable (comptes Discord-only)         |
| discordId       | String?   | Snowflake Discord, UNIQUE                            |
| discordUsername | String?   | Handle global Discord (ex: tomdu35)                  |
| avatarUrl       | String?   | URL CDN Discord, mise a jour au login                |
| role            | Role      | USER (default) or ADMIN                              |
| createdAt       | DateTime  | Auto                                                 |
| updatedAt       | DateTime  | Auto                                                 |
| deletedAt       | DateTime? | Soft delete                                          |

Invariant : un User a soit (email + passwordHash) soit discordId, soit les deux (compte hybride).

Relations: createdEvents, sentInvitations, eventParticipations, createdGameTables, gameTableParticipations, notifications

## Event

| Field         | Type     | Notes                                   |
| ------------- | -------- | --------------------------------------- |
| id            | String   | UUID PK                                 |
| name          | String   | required                                |
| startDateTime | DateTime | UTC                                     |
| endDateTime   | DateTime | UTC                                     |
| createdBy     | String   | FK -> User.id                           |
| discordRoleId | String?  | ID role Discord lie a cet event, UNIQUE |
| createdAt     | DateTime | Auto                                    |
| updatedAt     | DateTime | Auto                                    |

Relations: creator (User), invitations, participations, gameTables

## EventInvitation

| Field     | Type             | Notes               |
| --------- | ---------------- | ------------------- |
| id        | String           | UUID PK             |
| eventId   | String           | FK -> Event.id      |
| email     | String           | required            |
| invitedBy | String           | FK -> User.id       |
| token     | String           | Unique, UUID v4     |
| expiresAt | DateTime         | = event.endDateTime |
| status    | InvitationStatus | PENDING (default)   |
| createdAt | DateTime         | Auto                |

Contrainte unique: (email, eventId)
Relations: event (Event), inviter (User)

## EventParticipation

| Field     | Type     | Notes               |
| --------- | -------- | ------------------- |
| id        | String   | UUID PK             |
| eventId   | String   | FK -> Event.id      |
| userId    | String   | FK -> User.id       |
| status    | String   | default "CONFIRMED" |
| createdAt | DateTime | Auto                |
| updatedAt | DateTime | Auto                |

Contrainte unique: (eventId, userId)
Relations: event (Event), user (User)

## GameTable

| Field         | Type      | Notes                                                          |
| ------------- | --------- | -------------------------------------------------------------- |
| id            | String    | UUID PK                                                        |
| eventId       | String    | FK -> Event.id                                                 |
| createdBy     | String    | FK -> User.id (GM)                                             |
| title         | String    | required, 1-150 chars                                          |
| type          | TableType | JDR (default) or JDS                                           |
| gmIsPlayer    | Boolean   | default false (JDR only)                                       |
| pitch         | String?   | max 2000 chars                                                 |
| triggers      | String?   | max 1000 chars                                                 |
| comments      | String?   | max 1000 chars                                                 |
| maxPlayers    | Int       | required, 1-20                                                 |
| reservedSeats | Int       | default 0. Total FIXE configure par le MJ (uniquement mute via update table). Le nombre de places reservees occupees se derive des participants (CONFIRMED + isOnReservedSeat), jamais stocke/mute par join/promote/demote/leave/kick |
| startDateTime | DateTime  | >= event.startDateTime                                         |
| endDateTime   | DateTime  | <= event.endDateTime                                           |
| createdAt     | DateTime  | Auto                                                           |
| updatedAt     | DateTime  | Auto                                                           |

Index: (eventId, startDateTime)
Relations: event (Event), creator (User), tags (GameTableTag[]), participants (GameTableParticipant[])

## Tag

| Field | Type   | Notes             |
| ----- | ------ | ----------------- |
| id    | String | UUID PK           |
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

| Field            | Type                   | Notes                                                                           |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------- |
| id               | String                 | UUID PK                                                                         |
| gameTableId      | String                 | FK -> GameTable.id                                                              |
| userId           | String                 | FK -> User.id                                                                   |
| status           | TableParticipantStatus | CONFIRMED default                                                               |
| isOnReservedSeat | Boolean                | default false. True si le joueur a ete affecte sur une place reservee par le MJ |
| joinedAt         | DateTime               | Auto. Reinitialise a now() lors d'un demote MJ : le joueur repart en fin de file |

Contrainte unique: (gameTableId, userId)
Index: (gameTableId, status)
onDelete Cascade sur gameTable
Relations: gameTable (GameTable), user (User)

## BoardGame

| Field          | Type     | Notes                    |
| -------------- | -------- | ------------------------ |
| id             | String   | UUID PK                  |
| name           | String   | required, indexed        |
| externalSource | String?  | Ex: "BGG"                |
| externalId     | String?  | ID sur la source externe |
| yearPublished  | Int?     |                          |
| minPlayers     | Int?     |                          |
| maxPlayers     | Int?     |                          |
| playingTime    | Int?     | En minutes               |
| description    | String?  | Peut contenir du HTML    |
| imageUrl       | String?  | URL de l'image           |
| createdAt      | DateTime | Auto                     |

Contrainte unique: (externalSource, externalId) — NULLs traites comme distincts par PostgreSQL
Index: (name)
Relations: eventBoardGames (EventBoardGame[])

## EventBoardGame

| Field           | Type     | Notes              |
| --------------- | -------- | ------------------ |
| id              | String   | UUID PK            |
| eventId         | String   | FK -> Event.id     |
| boardGameId     | String   | FK -> BoardGame.id |
| broughtByUserId | String   | FK -> User.id      |
| createdAt       | DateTime | Auto               |

Contrainte unique: (eventId, boardGameId, broughtByUserId)
Index: (eventId)
Relations: event (Event), boardGame (BoardGame), broughtBy (User)

## Enum Role

USER | ADMIN

## Enum InvitationStatus

PENDING | ACCEPTED | EXPIRED

## Enum TableType

JDR | JDS

## Enum TableParticipantStatus

CONFIRMED | WAITLIST

## Enum NotificationType

TABLE_DELETED | TABLE_UPDATED | WAITLIST_PROMOTED | WAITLIST_DEMOTED | RESERVED_SEAT_ASSIGNED | PLAYER_KICKED | PARTICIPANT_REMOVED | EVENT_UPDATED | EVENT_DELETED

## Notification

| Champ     | Type             | Notes                 |
| --------- | ---------------- | --------------------- |
| id        | String           | UUID PK               |
| userId    | String           | FK -> User.id         |
| type      | NotificationType | required              |
| title     | String           | required              |
| message   | String           | required              |
| metadata  | Json?            | Donnees contextuelles |
| read      | Boolean          | default false         |
| readAt    | DateTime?        | Timestamp de lecture  |
| createdAt | DateTime         | default now()         |

Index: (userId, read, createdAt DESC)
Relations: user (User)
