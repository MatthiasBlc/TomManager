# Spec : Planning System (GameTables)

> CRUD complet des GameTables, tags, participation avec waitlist, cascade dates event.

---

## 1. Nouveaux modeles DB

### GameTable

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | UUID | PK |
| `eventId` | UUID | FK -> Event.id |
| `createdBy` | UUID | FK -> User.id (GM) |
| `title` | String | required, 1-150 chars |
| `pitch` | String? | max 2000 chars |
| `triggers` | String? | max 1000 chars |
| `comments` | String? | max 1000 chars |
| `maxPlayers` | Int | required, 1-20 |
| `startDateTime` | DateTime | >= event.startDateTime |
| `endDateTime` | DateTime | <= event.endDateTime, > startDateTime |
| `createdAt` | DateTime | default now() |
| `updatedAt` | DateTime | @updatedAt |

Index : `(eventId, startDateTime)`

### Tag

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | UUID | PK |
| `name` | String | unique, lowercase |

### GameTableTag

PK composite : `(gameTableId, tagId)`

### GameTableParticipant

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | UUID | PK |
| `gameTableId` | UUID | FK -> GameTable.id |
| `userId` | UUID | FK -> User.id |
| `status` | TableParticipantStatus | CONFIRMED / WAITLIST |
| `joinedAt` | DateTime | default now() |

Contrainte unique : `(gameTableId, userId)`
Index : `(gameTableId, status)`

### Enum TableParticipantStatus

`CONFIRMED` | `WAITLIST`

---

## 2. Endpoints backend

### 2.1 Table CRUD

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/events/:eventId/tables` | requireAuth + requireEventParticipant | Creer table |
| `GET` | `/api/events/:eventId/tables` | requireAuth + requireEventParticipant | Lister tables |
| `GET` | `/api/events/:eventId/tables/:tableId` | requireAuth + requireEventParticipant | Detail table |
| `PATCH` | `/api/events/:eventId/tables/:tableId` | requireAuth + requireTableGMOrAdmin | Modifier table |
| `DELETE` | `/api/events/:eventId/tables/:tableId` | requireAuth + requireTableGMOrAdmin | Supprimer table |

### 2.2 Table participation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `.../tables/:tableId/join` | requireAuth + requireEventParticipant | Rejoindre |
| `DELETE` | `.../tables/:tableId/leave` | requireAuth | Quitter |
| `DELETE` | `.../tables/:tableId/participants/:userId` | requireAuth + requireTableGMOrAdmin | Expulser |

### 2.3 Tags

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tags?q=` | requireAuth | Autocomplete tags |

### 2.4 Modifications existantes

- `PATCH /api/events/:eventId` : cascade dates sur GameTables
- `DELETE /api/events/:eventId/participants/:userId` : cascade tables

### 2.5 Nouveau middleware

- `requireTableGMOrAdmin` : verifie GM de la table ou ADMIN

---

## 3. Regles metier critiques

### Join (transaction serialisable)
1. Lock table FOR UPDATE
2. Verifier pas deja participant -> 409
3. Verifier pas le GM -> 400
4. Si count(CONFIRMED) < maxPlayers -> CONFIRMED, sinon WAITLIST
5. Retourner status + warning overlap si applicable

### Leave (transaction serialisable)
1. Supprimer participant
2. Si etait CONFIRMED et waitlist non vide -> promouvoir premier waitlist

### Reduction maxPlayers (transaction)
1. Si count(CONFIRMED) > new maxPlayers -> demoter les derniers inscrits en WAITLIST

### Augmentation maxPlayers (transaction)
1. Promouvoir waitlist en CONFIRMED selon capacite disponible

### Cascade dates event
1. Pour chaque table : clamper dates
2. Si start clampe >= end clampe -> supprimer table
3. Mettre a jour expiresAt invitations PENDING

### Cascade retrait participant
1. Supprimer GameTables creees par le user (+ participants, tags)
2. Supprimer GameTableParticipant pour ce user dans toutes les tables de l'event
3. Promouvoir waitlist si le user etait CONFIRMED

---

## 4. Tests attendus

- Table CRUD (create, read, update, delete)
- Validation dates (dans bornes event)
- Join table (confirmed vs waitlist)
- Leave table (auto-promotion waitlist)
- Reduction maxPlayers (demotion)
- Augmentation maxPlayers (promotion)
- GM ne peut pas rejoindre sa propre table
- Cascade dates event (clamp, suppression)
- Cascade retrait participant (tables + participations)
- Tag autocomplete
- requireTableGMOrAdmin middleware
