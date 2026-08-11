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

Relations: createdEvents, eventParticipations, createdGameTables, gameTableParticipations, eventBoardGames, notifications, preferences

## UserPreference

| Field     | Type     | Notes                                |
| --------- | -------- | ------------------------------------ |
| id        | String   | UUID PK                              |
| userId    | String   | FK -> User.id, onDelete Cascade      |
| key       | String   | Ex: "admin.events", "beta.pdfExport" |
| value     | Boolean  | required                             |
| updatedAt | DateTime | Auto                                 |

Contrainte unique: (userId, key)
Liste blanche des cles (backend `schemas/preference.ts`) : admin.events, admin.tables, admin.games, admin.kitchen, admin.courses, beta.pdfExport, beta.gameDb.
`admin.courses` ("Gestion courses") ouvre l'onglet Courses ; elle ne se derive jamais de `admin.kitchen` (cf `docs/features/KitchenCourses/`).
Les cles `admin.*` et `beta.*` ne sont modifiables que par un ADMIN. Cle absente = false.
Droits admin opt-in : le front ne montre les actions admin que si le toggle correspondant est actif (le backend reste protege par requireAdmin & co independamment).

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

Relations: creator (User), participations, gameTables, eventBoardGames

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

| Field         | Type      | Notes                                                                                                                                                                                                                                 |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id            | String    | UUID PK                                                                                                                                                                                                                               |
| eventId       | String    | FK -> Event.id                                                                                                                                                                                                                        |
| createdBy     | String    | FK -> User.id (GM)                                                                                                                                                                                                                    |
| title         | String    | required, 1-150 chars                                                                                                                                                                                                                 |
| type          | TableType | JDR (default) or JDS                                                                                                                                                                                                                  |
| gmIsPlayer    | Boolean   | default false (JDR only). Toggle en edition : cree/supprime la place du MJ (maxPlayers +1/-1)                                                                                                                                         |
| pitch         | String?   | max 2000 chars                                                                                                                                                                                                                        |
| triggers      | String?   | max 1000 chars                                                                                                                                                                                                                        |
| comments      | String?   | max 1000 chars                                                                                                                                                                                                                        |
| maxPlayers    | Int       | required, 1-20                                                                                                                                                                                                                        |
| reservedSeats | Int       | default 0. Total FIXE configure par le MJ (uniquement mute via update table). Le nombre de places reservees occupees se derive des participants (CONFIRMED + isOnReservedSeat), jamais stocke/mute par join/promote/demote/leave/kick |
| startDateTime | DateTime  | >= event.startDateTime                                                                                                                                                                                                                |
| endDateTime   | DateTime  | <= event.endDateTime                                                                                                                                                                                                                  |
| createdAt     | DateTime  | Auto                                                                                                                                                                                                                                  |
| updatedAt     | DateTime  | Auto                                                                                                                                                                                                                                  |

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

| Field            | Type                   | Notes                                                                            |
| ---------------- | ---------------------- | -------------------------------------------------------------------------------- |
| id               | String                 | UUID PK                                                                          |
| gameTableId      | String                 | FK -> GameTable.id                                                               |
| userId           | String                 | FK -> User.id                                                                    |
| status           | TableParticipantStatus | CONFIRMED default                                                                |
| isOnReservedSeat | Boolean                | default false. True si le joueur a ete affecte sur une place reservee par le MJ  |
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

## Enum TableType

JDR | JDS

## Enum TableParticipantStatus

CONFIRMED | WAITLIST

## Enum NotificationType

TABLE_DELETED | TABLE_UPDATED | WAITLIST_PROMOTED | WAITLIST_DEMOTED | RESERVED_SEAT_ASSIGNED | PLAYER_KICKED | PARTICIPANT_REMOVED | EVENT_UPDATED | EVENT_DELETED | GM_PLAYER_JOINED | GM_PLAYER_WAITLISTED | GM_PLAYER_LEFT | GM_TABLE_FULL | KITCHEN_SWAP_REQUESTED | KITCHEN_SWAP_ACCEPTED | KITCHEN_SWAP_REJECTED | KITCHEN_ASSISTANT_SWAP_REQUESTED | KITCHEN_ASSISTANT_SWAP_ACCEPTED | KITCHEN_CHEF_ADDED | KITCHEN_CHEF_REMOVED | KITCHEN_MEAL_CLAIMED | KITCHEN_OVERCAPACITY | KITCHEN_DIET_SPLIT_UPDATED

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

## Module cuisine (CookV1)

Voir `docs/features/CookV1/SPEC_COOKING.md` pour le detail fonctionnel. Migration
100% additive `20260721101121_kitchen_v1_foundations`.

### EventKitchen (1:1 avec Event, cree paresseusement)

| Field                   | Type     | Notes                                       |
| ----------------------- | -------- | ------------------------------------------- |
| id                      | String   | UUID PK                                     |
| eventId                 | String   | FK -> Event.id, UNIQUE, onDelete Cascade    |
| chefRoleId              | String?  | Snowflake role Discord chef ; null = manuel |
| allergiesNotes          | String?  | Texte libre global (max 5000)               |
| dislikesNotes           | String?  | Texte libre global (max 5000)               |
| equipierPlanningEnabled | Boolean  | default false                               |
| createdAt / updatedAt   | DateTime |                                             |

Relations: event (Event), chefs (KitchenChef[]), coursesMembers (KitchenCoursesMember[]), meals (Meal[]), assistants (MealAssistant[])

`allergiesNotes` (medical, bloquant) et `dislikesNotes` (preference de confort) sont
deux champs distincts et non deux rubriques d'un meme texte : ils s'affichent en deux
blocs de couleurs differentes et ne demandent pas la meme attention au chef. Meme
regle de visibilite pour les deux (`isFullReader` : chef + responsable, jamais
l'equipier). Migration additive `20260811205217_kitchen_dislikes_notes`.

### KitchenChef (roster chef materialise)

| Field          | Type       | Notes                                   |
| -------------- | ---------- | --------------------------------------- | ------ |
| id             | String     | UUID PK                                 |
| eventKitchenId | String     | FK -> EventKitchen.id, onDelete Cascade |
| userId         | String     | FK -> User.id                           |
| source         | ChefSource | ROLE                                    | MANUAL |

Unique: (eventKitchenId, userId)

### KitchenCoursesMember (equipe courses — donne aussi l'acces a l'onglet Courses)

| Field          | Type   | Notes                                   |
| -------------- | ------ | --------------------------------------- |
| id             | String | UUID PK                                 |
| eventKitchenId | String | FK -> EventKitchen.id, onDelete Cascade |
| userId         | String | FK -> User.id                           |

Unique: (eventKitchenId, userId)

### Meal (fiche repas ; 1 chef = 1 repas)

| Field                 | Type        | Notes                                              |
| --------------------- | ----------- | -------------------------------------------------- | ------ |
| id                    | String      | UUID PK                                            |
| eventKitchenId        | String      | FK -> EventKitchen.id, onDelete Cascade            |
| chefUserId            | String?     | FK -> User.id ; null = orphelin (onDelete SetNull) |
| name                  | String      | 1-150                                              |
| service               | MealService | LUNCH                                              | DINNER |
| startDateTime         | DateTime    | >= event.startDateTime, < endDateTime              |
| endDateTime           | DateTime    | <= event.endDateTime                               |
| maxAssistants         | Int         | default 0                                          |
| vegeCount             | Int         | default 0 (KitchenDietSplit)                       |
| carneCount            | Int         | default 0 (KitchenDietSplit)                       |
| createdAt / updatedAt | DateTime    |                                                    |

Unique: (eventKitchenId, chefUserId) — NULLs distincts sous PostgreSQL
Index: (eventKitchenId, startDateTime)

vegeCount/carneCount : repartition agregee vege/carne, editable par le responsable
uniquement (meme statut que maxAssistants dans updateMeal). Doit sommer au nombre de
participants confirmes de l'event (`eventParticipantsCount`, expose par GET /kitchen
a chef/responsable/admin simple, jamais a l'equipier) — coherence non contrainte en
base, juste un warning cote front. Migration `20260724170207_kitchen_diet_split`
(additive). Voir `docs/features/KitchenDietSplit/SPEC_KITCHEN_DIET_SPLIT.md`.

### MealIngredient

| Field     | Type    | Notes                                                                   |
| --------- | ------- | ----------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ----- |
| id        | String  | UUID PK                                                                 |
| mealId    | String  | FK -> Meal.id, onDelete Cascade                                         |
| productId | String? | FK -> Product.id (onDelete SetNull)                                     |
| name      | String  | Denormalise (cache d'affichage)                                         |
| quantity  | Decimal | @db.Decimal(10,3)                                                       |
| unit      | Unit    | G                                                                       | KG  | ML  | CL  | L   | CAS | CAC | PIECE |
| note      | String? | Commentaire libre du chef sur la ligne (max 300), pour l'equipe courses |

### Product (catalogue, pattern Tag)

| Field | Type   | Notes                       |
| ----- | ------ | --------------------------- |
| id    | String | UUID PK                     |
| name  | String | Unique, normalise lowercase |

### MealUtensil

| Field     | Type    | Notes                                  |
| --------- | ------- | -------------------------------------- |
| id        | String  | UUID PK                                |
| mealId    | String  | FK -> Meal.id, onDelete Cascade        |
| utensilId | String? | FK -> Utensil.id (onDelete SetNull)    |
| name      | String  | 1-100, denormalise (cache d'affichage) |

### Utensil (catalogue, pattern Product/Tag)

| Field | Type   | Notes                       |
| ----- | ------ | --------------------------- |
| id    | String | UUID PK                     |
| name  | String | Unique, normalise lowercase |

Migration `20260722114926_kitchen_utensil_catalog` (additive : ALTER TABLE ADD COLUMN
nullable + CREATE TABLE, cf Evolutions.md point 7).

### MealAssistant (inscription equipier)

| Field          | Type     | Notes                                                               |
| -------------- | -------- | ------------------------------------------------------------------- |
| id             | String   | UUID PK                                                             |
| mealId         | String   | FK -> Meal.id, onDelete Cascade                                     |
| eventKitchenId | String   | FK -> EventKitchen.id, onDelete Cascade (denormalise pour l'unique) |
| userId         | String   | FK -> User.id                                                       |
| createdAt      | DateTime |                                                                     |

Unique: (mealId, userId) ET (eventKitchenId, userId) — au plus un repas par event

### MealSwapRequest (echange de creneau entre 2 chefs, confirmation mutuelle)

| Field           | Type       | Notes                                                        |
| --------------- | ---------- | ------------------------------------------------------------ |
| id              | String     | UUID PK                                                      |
| eventKitchenId  | String     | FK -> EventKitchen.id, onDelete Cascade                      |
| requesterMealId | String     | FK -> Meal.id (relation SwapRequesterMeal), onDelete Cascade |
| targetMealId    | String     | FK -> Meal.id (relation SwapTargetMeal), onDelete Cascade    |
| requesterUserId | String     | FK -> User.id (denormalise, fige l'identite)                 |
| targetUserId    | String     | FK -> User.id                                                |
| status          | SwapStatus | default PENDING                                              |
| createdAt       | DateTime   |                                                              |
| respondedAt     | DateTime?  |                                                              |

Index: (eventKitchenId, status), (targetMealId, status). Une seule PENDING par repas
(verif applicative, pas de contrainte DB). A l'acceptation : swap chefUserId + name +
FK ingredients/ustensiles ; MealAssistant + horaires + service inchanges (equipiers
restent sur le creneau). Migration `20260722080827_kitchen_matrix_swap` (additive).

### AssistantSwapRequest (echange entre equipiers, Evolutions.md point 4)

| Field           | Type       | Notes                                                                       |
| --------------- | ---------- | --------------------------------------------------------------------------- |
| id              | String     | UUID PK                                                                     |
| eventKitchenId  | String     | FK -> EventKitchen.id, onDelete Cascade                                     |
| requesterMealId | String     | FK -> Meal.id (relation AssistantSwapRequesterMeal), onDelete Cascade       |
| targetMealId    | String     | FK -> Meal.id (relation AssistantSwapTargetMeal), onDelete Cascade          |
| requesterUserId | String     | FK -> User.id                                                               |
| accepterUserId  | String?    | FK -> User.id, renseigne uniquement a l'acceptation (inconnu a la creation) |
| status          | SwapStatus | default PENDING (enum reutilise, pas de nouveau CREATE TYPE)                |
| createdAt       | DateTime   |                                                                             |
| respondedAt     | DateTime?  |                                                                             |

Index: (eventKitchenId, status), (targetMealId, status), (requesterUserId, status).
Difference cle avec MealSwapRequest : la cible est un REPAS, pas une personne fixee a
la creation — n'importe quel MealAssistant courant du repas cible peut accepter (premier
arrive, premier servi), d'ou l'absence de `targetUserId` et la revalidation "stale" des
DEUX cotes a l'acceptation. Echange 1-pour-1 de `MealAssistant.mealId` (capacite-neutre,
aucun controle de capacite necessaire). Migration `20260722175747_add_assistant_swap_request`
(additive — CREATE TABLE seul, reutilise l'enum SwapStatus existant).

### Enum SwapStatus

PENDING | ACCEPTED | REJECTED | CANCELLED

### Enum ChefSource

ROLE | MANUAL

### Enum MealService

LUNCH | DINNER

### Enum Unit

G | KG | ML | CL | L | CAS | CAC | PIECE
