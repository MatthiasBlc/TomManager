# TomManager - Specification Technique Complete

> Application web de gestion d'evenements JDR (Jeu de Role) avec planning collaboratif et inventaire de jeux de societe.

---

## 1. Conventions & Generalites

### 1.1 Stack technique

| Couche          | Technologies                                     |
| --------------- | ------------------------------------------------ |
| Frontend        | React 18, TypeScript, Vite, TailwindCSS, DaisyUI |
| Backend         | Node.js, Express, TypeScript, Prisma ORM         |
| Base de donnees | PostgreSQL 15                                    |
| Real-time       | Socket.io                                        |
| Infra           | Docker, GitHub Actions, Portainer, Traefik       |

### 1.2 Regles generales

- **Langue du code** : 100% anglais (variables, fonctions, modeles). Commentaires francais OK.
- **Accents** : aucun dans le code ni les docs (ASCII only).
- **IDs** : UUID v4 partout.
- **Timezone** : toutes les dates stockees en UTC. Timezone d'affichage fixe : `Europe/Paris`. Conversion cote UI.
- **Soft delete** : uniquement sur `User` (champ `deletedAt`). Toutes les autres entites utilisent le hard delete.
- **Sessions** : `express-session` avec Prisma session store. Cookie `connect.sid`, httpOnly, secure en prod, sameSite: lax, TTL 1h.

### 1.3 Format des reponses API

**Succes :**

```json
{ "data": { ... } }
```

**Erreur :**

```json
{ "error": { "message": "Description lisible", "code": "ERROR_CODE" } }
```

### 1.4 Codes HTTP utilises

| Code | Usage                                |
| ---- | ------------------------------------ |
| 200  | Succes (lecture, modification)       |
| 201  | Ressource creee                      |
| 204  | Succes sans contenu (suppression)    |
| 400  | Requete invalide (validation)        |
| 401  | Non authentifie                      |
| 403  | Non autorise (permissions)           |
| 404  | Ressource introuvable                |
| 409  | Conflit (doublon, deja utilise)      |
| 410  | Ressource expiree (invitation)       |
| 422  | Entite non traitable (regles metier) |
| 500  | Erreur serveur                       |

---

## 2. Modele de donnees

### 2.1 Vue d'ensemble des entites

```
User ─────────┬── Event (createdBy)
              ├── EventInvitation (invitedBy)
              ├── EventParticipation (userId)
              ├── GameTable (createdBy = GM)
              ├── GameTableParticipant (userId)
              └── EventBoardGame (broughtByUserId)

Event ────────┬── EventInvitation (eventId)
              ├── EventParticipation (eventId)
              ├── GameTable (eventId)
              └── EventBoardGame (eventId)

GameTable ────┬── GameTableParticipant (gameTableId)
              └── GameTableTag (gameTableId)

Tag ──────────── GameTableTag (tagId)

BoardGame ────── EventBoardGame (boardGameId)

Notification ─── User (userId)
```

### 2.2 Enums

| Enum                     | Valeurs                                                                                                                                 | Utilise par                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `Role`                   | `USER`, `ADMIN`                                                                                                                         | `User.role`                   |
| `InvitationStatus`       | `PENDING`, `ACCEPTED`, `EXPIRED`                                                                                                        | `EventInvitation.status`      |
| `TableParticipantStatus` | `CONFIRMED`, `WAITLIST`                                                                                                                 | `GameTableParticipant.status` |
| `NotificationType`       | `TABLE_DELETED`, `TABLE_DATE_CLAMPED`, `WAITLIST_PROMOTED`, `WAITLIST_DEMOTED`, `PLAYER_KICKED`, `PARTICIPANT_REMOVED`, `EVENT_UPDATED` | `Notification.type`           |

### 2.3 Modeles detailles

#### 2.3.1 User

| Champ          | Type      | Contraintes                                         | Notes                                         |
| -------------- | --------- | --------------------------------------------------- | --------------------------------------------- |
| `id`           | UUID      | PK, default uuid()                                  |                                               |
| `email`        | String    | unique, required                                    |                                               |
| `username`     | String    | unique, required, 3-30 chars, alphanum + underscore | Ancien libere au changement, pas d'historique |
| `passwordHash` | String    | required                                            | bcrypt                                        |
| `role`         | Role      | default USER                                        | ADMIN ou USER                                 |
| `createdAt`    | DateTime  | default now()                                       |                                               |
| `updatedAt`    | DateTime  | @updatedAt                                          |                                               |
| `deletedAt`    | DateTime? | nullable                                            | Soft delete                                   |

**Relations :** createdEvents, sentInvitations, eventParticipations, createdGameTables, gameTableParticipations, eventBoardGames, notifications

**Regles soft delete :** toutes les requetes DOIVENT filtrer `deletedAt IS NULL` sauf requete admin explicite sur les utilisateurs supprimes.

#### 2.3.2 Session

| Champ       | Type     | Contraintes    |
| ----------- | -------- | -------------- |
| `id`        | String   | PK             |
| `sid`       | String   | unique         |
| `data`      | String   | JSON serialise |
| `expiresAt` | DateTime |                |

Geree automatiquement par `@quixo3/prisma-session-store`.

#### 2.3.3 Event

| Champ           | Type     | Contraintes               | Notes          |
| --------------- | -------- | ------------------------- | -------------- |
| `id`            | UUID     | PK                        |                |
| `name`          | String   | required, 1-100 chars     |                |
| `startDateTime` | DateTime | required                  | Stocke en UTC  |
| `endDateTime`   | DateTime | required, > startDateTime | Stocke en UTC  |
| `createdBy`     | UUID     | FK -> User.id             | Admin createur |
| `createdAt`     | DateTime | default now()             |                |
| `updatedAt`     | DateTime | @updatedAt                |                |

**Relations :** creator (User), invitations, participations, gameTables, eventBoardGames

**Regles :**

- Plusieurs events peuvent coexister simultanement.
- La duree est calculee, jamais stockee.
- Le createur est automatiquement ajoute en EventParticipation CONFIRMED a la creation.

#### 2.3.4 EventInvitation

| Champ       | Type             | Contraintes            | Notes                             |
| ----------- | ---------------- | ---------------------- | --------------------------------- |
| `id`        | UUID             | PK                     |                                   |
| `eventId`   | UUID             | FK -> Event.id         |                                   |
| `email`     | String           | required, email valide |                                   |
| `invitedBy` | UUID             | FK -> User.id          | Admin qui invite                  |
| `token`     | String           | unique                 | UUID v4, single-use               |
| `expiresAt` | DateTime         |                        | = event.endDateTime a la creation |
| `status`    | InvitationStatus | default PENDING        |                                   |
| `createdAt` | DateTime         | default now()          |                                   |

**Contrainte unique :** `(email, eventId)`

**Regles :**

- Le token est partage manuellement par l'admin (pas d'envoi email MVP).
- Token single-use : apres acceptation, status = ACCEPTED, token conserve mais inutilisable.
- Si invitation EXPIRED existe pour meme (email, eventId) : supprimer l'ancienne, en creer une nouvelle.
- Si invitation PENDING ou ACCEPTED existe : retourner 409.
- Modification dates event : mettre a jour `expiresAt` de toutes les invitations PENDING.

#### 2.3.5 EventParticipation

| Champ       | Type     | Contraintes        | Notes                   |
| ----------- | -------- | ------------------ | ----------------------- |
| `id`        | UUID     | PK                 |                         |
| `eventId`   | UUID     | FK -> Event.id     |                         |
| `userId`    | UUID     | FK -> User.id      |                         |
| `status`    | String   | toujours CONFIRMED | Pas d'enum, valeur fixe |
| `createdAt` | DateTime | default now()      |                         |
| `updatedAt` | DateTime | @updatedAt         |                         |

**Contrainte unique :** `(eventId, userId)`

**Regles :**

- Cree automatiquement quand une invitation est acceptee (signup ou login via token).
- Si la participation existe deja (re-clic sur lien) : succes idempotent.
- Seuls les participants CONFIRMED peuvent : creer des tables, rejoindre des tables, ajouter des jeux.

#### 2.3.6 GameTable

| Champ           | Type     | Contraintes           | Notes                                 |
| --------------- | -------- | --------------------- | ------------------------------------- |
| `id`            | UUID     | PK                    |                                       |
| `eventId`       | UUID     | FK -> Event.id        |                                       |
| `createdBy`     | UUID     | FK -> User.id         | Le MJ (GM)                            |
| `title`         | String   | required, 1-150 chars |                                       |
| `pitch`         | String?  | max 2000 chars        | Description de la partie              |
| `triggers`      | String?  | max 1000 chars        | Avertissements de contenu             |
| `comments`      | String?  | max 1000 chars        | Notes additionnelles                  |
| `maxPlayers`    | Int      | required, 1-20        | Joueurs hors GM                       |
| `startDateTime` | DateTime | required              | >= event.startDateTime                |
| `endDateTime`   | DateTime | required              | <= event.endDateTime, > startDateTime |
| `createdAt`     | DateTime | default now()         |                                       |
| `updatedAt`     | DateTime | @updatedAt            |                                       |

**Relations :** event, creator (GM), tags (via GameTableTag), participants (via GameTableParticipant)

**Regles :**

- `maxPlayers` = nombre de places joueurs, le GM n'est PAS compte dedans.
- Les dates doivent rester dans les bornes de l'event.
- Le chevauchement entre tables pour un meme utilisateur est autorise (warning UI, pas de blocage).
- Seul le GM ou un ADMIN peut editer/supprimer une table.

**Index :** `(eventId, startDateTime)`

#### 2.3.7 Tag

| Champ  | Type   | Contraintes                             |
| ------ | ------ | --------------------------------------- |
| `id`   | UUID   | PK                                      |
| `name` | String | unique, 1-50 chars, stocke en lowercase |

**Regles :**

- Pool global partage entre tous les events.
- Crees a la volee quand un GM ajoute un nouveau nom de tag.
- Pas de suppression de tags pour le MVP (accumulation).

#### 2.3.8 GameTableTag

| Champ         | Type | Contraintes        |
| ------------- | ---- | ------------------ |
| `gameTableId` | UUID | FK -> GameTable.id |
| `tagId`       | UUID | FK -> Tag.id       |

**PK composite :** `(gameTableId, tagId)`

Table de jointure pure, pas de champs supplementaires.

#### 2.3.9 GameTableParticipant

| Champ         | Type                   | Contraintes        | Notes                       |
| ------------- | ---------------------- | ------------------ | --------------------------- |
| `id`          | UUID                   | PK                 |                             |
| `gameTableId` | UUID                   | FK -> GameTable.id |                             |
| `userId`      | UUID                   | FK -> User.id      |                             |
| `status`      | TableParticipantStatus | required           | CONFIRMED ou WAITLIST       |
| `joinedAt`    | DateTime               | default now()      | Determine l'ordre FIFO/LIFO |

**Contrainte unique :** `(gameTableId, userId)`

**Regles :**

- Le GM ne peut PAS rejoindre sa propre table comme participant.
- Status determine par la capacite au moment du join (transaction).
- `joinedAt` utilise pour : promotion waitlist (FIFO, ASC), demotion overflow (LIFO, DESC).

**Index :** `(gameTableId, status)`

#### 2.3.10 BoardGame

| Champ            | Type     | Contraintes   | Notes                                        |
| ---------------- | -------- | ------------- | -------------------------------------------- |
| `id`             | UUID     | PK            |                                              |
| `name`           | String   | required      |                                              |
| `externalSource` | String?  | nullable      | Ex: "BGG"                                    |
| `externalId`     | String?  | nullable      | ID sur la source externe                     |
| `yearPublished`  | Int?     | nullable      |                                              |
| `minPlayers`     | Int?     | nullable      |                                              |
| `maxPlayers`     | Int?     | nullable      |                                              |
| `playingTime`    | Int?     | nullable      | En minutes                                   |
| `description`    | String?  | nullable      | Peut contenir du HTML (sanitiser cote front) |
| `imageUrl`       | String?  | nullable      | URL de l'image                               |
| `createdAt`      | DateTime | default now() |                                              |

**Contrainte unique partielle :** `(externalSource, externalId)` WHERE both NOT NULL

**Regles :**

- Entrees manuelles : `externalSource` et `externalId` sont NULL, pas de contrainte d'unicite (doublons OK).
- Cache depuis l'API BGG au premier fetch, jamais re-fetche apres.
- Sert a la fois de cache API et de source d'autocomplete.

**Index :** `(name)`

#### 2.3.11 EventBoardGame

| Champ             | Type     | Contraintes        | Notes |
| ----------------- | -------- | ------------------ | ----- |
| `id`              | UUID     | PK                 |       |
| `eventId`         | UUID     | FK -> Event.id     |       |
| `boardGameId`     | UUID     | FK -> BoardGame.id |       |
| `broughtByUserId` | UUID     | FK -> User.id      |       |
| `createdAt`       | DateTime | default now()      |       |

**Contrainte unique :** `(eventId, boardGameId, broughtByUserId)` — un meme utilisateur ne peut pas amener le meme jeu deux fois au meme event. Mais deux utilisateurs differents peuvent amener le meme jeu.

**Regles :**

- 1 exemplaire par entree (pas de champ quantite pour le MVP).
- Seuls les participants de l'event peuvent ajouter des jeux.
- Suppression d'un participant -> cascade delete de ses EventBoardGame.

**Index :** `(eventId)`

#### 2.3.12 Notification

| Champ       | Type             | Contraintes   | Notes                      |
| ----------- | ---------------- | ------------- | -------------------------- |
| `id`        | UUID             | PK            |                            |
| `userId`    | UUID             | FK -> User.id | Destinataire               |
| `type`      | NotificationType | required      |                            |
| `title`     | String           | required      |                            |
| `message`   | String           | required      |                            |
| `data`      | Json?            | nullable      | Ex: `{ eventId, tableId }` |
| `readAt`    | DateTime?        | nullable      | null = non lu              |
| `createdAt` | DateTime         | default now() |                            |

---

## 3. Authentification & Invitations

### 3.1 Flow d'inscription (invitation-based)

**Il n'y a PAS d'auto-inscription.** Tout passe par les invitations.

```
1. Admin cree EventInvitation -> token UUID genere
2. Admin partage le lien /invite/:token manuellement
3. Destinataire clique sur le lien
4. Backend valide le token (existe, pas expire, status PENDING)
5a. Si email correspond a un User existant :
    -> Redirection vers login avec contexte token
    -> Apres login : invitation ACCEPTED + EventParticipation CONFIRMED
5b. Si pas de User existant :
    -> Redirection vers signup avec email pre-rempli
    -> Apres signup : invitation ACCEPTED + EventParticipation CONFIRMED
6. Redirection vers la page de l'event
```

### 3.2 Edge cases auth

| Situation                                            | Reponse                                                  |
| ---------------------------------------------------- | -------------------------------------------------------- |
| Token expire                                         | 410 Gone, "Invitation expiree"                           |
| Token deja utilise (ACCEPTED)                        | 409, "Invitation deja utilisee"                          |
| Token pour email X mais connecte en tant que email Y | 403, "Vous devez vous connecter avec le bon compte"      |
| User deja participant de l'event                     | Succes idempotent, redirection vers event                |
| User soft-deleted tente d'utiliser une invitation    | 403, "Compte desactive"                                  |
| Signup sans token                                    | 400, "Token d'invitation requis"                         |
| Login normal (sans token)                            | Fonctionne normalement, pas de creation de participation |

### 3.3 Login

Le login accepte **email OU username** + password :

```
POST /api/auth/login
Body: { identifier: "email-ou-username", password: "...", invitationToken?: "..." }
```

- Si `invitationToken` present : apres login, accepter l'invitation et creer la participation.
- Si pas de token : login normal.

### 3.4 Session

- Cookie `connect.sid`, httpOnly, secure en prod, sameSite: lax, maxAge: 1h
- Contenu session : `{ userId: string }`
- Pas d'invalidation de session au changement de username.
- Logout : destruction session cote serveur + suppression cookie.

### 3.5 Matrice d'autorisation

| Action                 | USER non-participant | USER participant |    GM de la table    |        ADMIN         |
| ---------------------- | :------------------: | :--------------: | :------------------: | :------------------: |
| Creer event            |          -           |        -         |          -           |         Oui          |
| Editer event           |          -           |        -         |          -           |       Createur       |
| Supprimer event        |          -           |        -         |          -           |       Createur       |
| Envoyer invitation     |          -           |        -         |          -           |       Createur       |
| Voir planning event    |          -           |       Oui        |         Oui          |         Oui          |
| Creer table            |          -           |       Oui        |         N/A          | Oui (si participant) |
| Editer table           |          -           |        -         |         Oui          |         Oui          |
| Supprimer table        |          -           |        -         |         Oui          |         Oui          |
| Rejoindre table        |          -           |       Oui        |         N/A          | Oui (si participant) |
| Quitter table          |          -           |    Si inscrit    | N/A (doit supprimer) |      Si inscrit      |
| Ajouter jeu de societe |          -           |       Oui        |         Oui          | Oui (si participant) |
| Supprimer jeu          |          -           |     Le sien      |       Le sien        |   N'importe lequel   |
| Retirer participant    |          -           |        -         |          -           |       Createur       |

### 3.6 Middlewares

| Middleware                         | Role                                 | Erreur |
| ---------------------------------- | ------------------------------------ | ------ |
| `requireAuth`                      | Verifie `session.userId` existe      | 401    |
| `requireAdmin`                     | Verifie `user.role === ADMIN`        | 403    |
| `requireEventParticipant(eventId)` | Verifie EventParticipation existe    | 403    |
| `requireEventCreator(eventId)`     | Verifie `event.createdBy === userId` | 403    |
| `requireTableGMOrAdmin(tableId)`   | Verifie GM ou admin                  | 403    |

---

## 4. Domaine : Events

### 4.1 Creation d'event

- **Endpoint :** `POST /api/events`
- **Auth :** requireAuth + requireAdmin
- **Body :** `{ name, startDateTime, endDateTime }`
- **Validation :**
  - `name` : requis, 1-100 caracteres
  - `startDateTime` < `endDateTime`
  - Dates en format ISO8601 valide
  - `startDateTime` doit etre dans le futur (pour la creation)
- **Side effect :** le createur est automatiquement ajoute en EventParticipation CONFIRMED.
- **Reponse :** 201 + objet event

### 4.2 Liste des events

- **Endpoint :** `GET /api/events`
- **Auth :** requireAuth
- **Logique :**
  - USER : retourne les events ou l'utilisateur a une EventParticipation
  - ADMIN : retourne tous les events
- **Query params :** `?upcoming=true` (filtre startDateTime > now)
- **Reponse :** 200 + tableau `[{ id, name, startDateTime, endDateTime, participantCount }]`

### 4.3 Detail d'un event

- **Endpoint :** `GET /api/events/:eventId`
- **Auth :** requireAuth + (requireEventParticipant OU ADMIN)
- **Reponse :** 200 + event complet avec liste participants et nombre de tables

### 4.4 Modification d'un event

- **Endpoint :** `PATCH /api/events/:eventId`
- **Auth :** requireAuth + requireEventCreator
- **Body :** `{ name?, startDateTime?, endDateTime? }`
- **Validation :** memes regles que creation, `endDateTime > startDateTime` apres merge

#### Cascade de modification des dates (TRANSACTION CRITIQUE)

Quand les dates d'un event changent :

```
BEGIN transaction (serialisable)
  1. Mettre a jour les dates de l'event
  2. Pour chaque GameTable de cet event :
     a. Clamper startDateTime = max(table.start, event.newStart)
     b. Clamper endDateTime = min(table.end, event.newEnd)
     c. Si start clampe >= end clampe :
        -> Supprimer la table entierement (hard delete)
        -> Creer notification pour tous les joueurs inscrits (TABLE_DELETED)
     d. Si clampe mais toujours valide :
        -> Mettre a jour les dates de la table
        -> Creer notification pour le GM (TABLE_DATE_CLAMPED)
  3. Mettre a jour expiresAt de toutes les invitations PENDING
COMMIT
```

### 4.5 Suppression d'un event

- **Endpoint :** `DELETE /api/events/:eventId`
- **Auth :** requireAuth + requireEventCreator
- **Hard delete en cascade :**
  - EventInvitations
  - EventParticipations
  - GameTables (+ GameTableParticipants + GameTableTags)
  - EventBoardGames
- **Reponse :** 204

### 4.6 Invitations

#### Envoyer une invitation

- **Endpoint :** `POST /api/events/:eventId/invitations`
- **Auth :** requireAuth + requireEventCreator
- **Body :** `{ email }`
- **Validation :** format email valide
- **Logique :**
  1. Verifier qu'aucune invitation PENDING ou ACCEPTED n'existe pour `(email, eventId)` -> 409
  2. Si une invitation EXPIRED existe -> la supprimer, en creer une nouvelle
  3. Generer un token UUID
  4. `expiresAt = event.endDateTime`
  5. Creer EventInvitation avec status PENDING
- **Reponse :** 201 + `{ id, email, token, status, expiresAt }`
- **Note :** le token est retourne a l'admin qui partage le lien manuellement. Pas d'envoi email (MVP).

#### Lister les invitations d'un event

- **Endpoint :** `GET /api/events/:eventId/invitations`
- **Auth :** requireAuth + requireEventCreator
- **Reponse :** 200 + `[{ id, email, status, createdAt }]`

#### Valider un token d'invitation

- **Endpoint :** `GET /api/invitations/:token`
- **Auth :** aucune (public)
- **Logique :** trouver l'invitation par token, verifier status + expiration
- **Reponse :** 200 + `{ email, eventId, eventName, status }` si valide
- **Erreurs :** 404 si introuvable, 410 si expire, 409 si deja utilise

#### Accepter une invitation (via signup ou login)

- **Endpoint :** `POST /api/invitations/:token/accept`
- **Auth :** requireAuth (l'utilisateur doit etre connecte ou venir de s'inscrire)
- **Logique :**
  1. Valider token (existe, PENDING, pas expire)
  2. Verifier que l'email de la session correspond a l'email de l'invitation
  3. Marquer invitation ACCEPTED
  4. Creer EventParticipation si inexistante (upsert)
- **Reponse :** 200 + `{ eventId, participation }`

### 4.7 Participation

#### Lister les participants

- **Endpoint :** `GET /api/events/:eventId/participants`
- **Auth :** requireAuth + requireEventParticipant
- **Reponse :** 200 + `[{ userId, username, role, joinedAt }]`

#### Retirer un participant (admin)

- **Endpoint :** `DELETE /api/events/:eventId/participants/:userId`
- **Auth :** requireAuth + requireEventCreator
- **Regles :** le createur ne peut pas se retirer lui-meme
- **Cascade hard en transaction :**
  1. Supprimer toutes les GameTables ou `createdBy = userId` dans cet event (+ participants, tags)
  2. Supprimer tous les GameTableParticipant pour ce user dans les tables de cet event
  3. Supprimer tous les EventBoardGame pour ce user dans cet event
  4. Supprimer l'EventParticipation
  5. Creer notifications pour les utilisateurs affectes (tables supprimees, etc.)
- **Reponse :** 204

#### Quitter un event (self)

- **Endpoint :** `DELETE /api/events/:eventId/participants/me`
- **Auth :** requireAuth + requireEventParticipant
- **Regles :** le createur ne peut pas quitter son propre event
- **Meme cascade que le retrait admin mais pour soi-meme**
- **Reponse :** 204

---

## 5. Domaine : Planning / GameTables

### 5.1 Creation de table

- **Endpoint :** `POST /api/events/:eventId/tables`
- **Auth :** requireAuth + requireEventParticipant (ou ADMIN participant)
- **Body :** `{ title, pitch?, triggers?, comments?, maxPlayers, startDateTime, endDateTime, tags?: string[] }`
- **Validation :**
  - `title` : 1-150 caracteres
  - `pitch` : max 2000 caracteres
  - `triggers` : max 1000 caracteres
  - `comments` : max 1000 caracteres
  - `maxPlayers` : entier, 1-20
  - `startDateTime >= event.startDateTime`
  - `endDateTime <= event.endDateTime`
  - `endDateTime > startDateTime`
  - `tags` : tableau de strings, max 10 tags, chaque tag max 50 caracteres
- **Logique :**
  - Le createur devient GM (`createdBy`)
  - Le GM n'est PAS ajoute comme GameTableParticipant (il est GM via `createdBy`)
  - Tags : pour chaque nom de tag, find-or-create Tag (stocke en lowercase), puis creer GameTableTag
- **Reponse :** 201 + objet table avec tags

### 5.2 Liste des tables d'un event

- **Endpoint :** `GET /api/events/:eventId/tables`
- **Auth :** requireAuth + requireEventParticipant
- **Query params :** `?date=YYYY-MM-DD` (filtre optionnel par jour en Europe/Paris)
- **Reponse :** 200 + tableau avec : id, title, pitch, triggers, comments, maxPlayers, startDateTime, endDateTime, gm (username, id), tags, confirmedCount, waitlistCount, currentUserStatus (CONFIRMED/WAITLIST/null)

### 5.3 Detail d'une table

- **Endpoint :** `GET /api/events/:eventId/tables/:tableId`
- **Auth :** requireAuth + requireEventParticipant
- **Reponse :** 200 + table complete avec liste des participants (confirmed + waitlist, ordonnes)

### 5.4 Modification d'une table

- **Endpoint :** `PATCH /api/events/:eventId/tables/:tableId`
- **Auth :** requireAuth + requireTableGMOrAdmin
- **Body :** memes champs que creation, tous optionnels

#### Reduction de maxPlayers (TRANSACTION CRITIQUE)

```
BEGIN transaction (serialisable)
  1. Lock table row FOR UPDATE
  2. Compter les participants CONFIRMED ordonnes par joinedAt DESC
  3. Si count(CONFIRMED) > new maxPlayers :
     -> Deplacer les excedentaires (derniers inscrits en premier) en WAITLIST
     -> Creer notification WAITLIST_DEMOTED pour chaque joueur deplace
  4. Mettre a jour maxPlayers
COMMIT
```

#### Augmentation de maxPlayers (TRANSACTION)

```
BEGIN transaction (serialisable)
  1. Lock table row FOR UPDATE
  2. Recuperer les participants WAITLIST ordonnes par joinedAt ASC
  3. Promouvoir autant que la capacite le permet en CONFIRMED
  4. Creer notification WAITLIST_PROMOTED pour chaque joueur promu
COMMIT
```

### 5.5 Suppression d'une table

- **Endpoint :** `DELETE /api/events/:eventId/tables/:tableId`
- **Auth :** requireAuth + requireTableGMOrAdmin
- **Hard delete :** table + GameTableParticipants + GameTableTags
- **Creer notification TABLE_DELETED pour tous les participants inscrits**
- **Reponse :** 204

### 5.6 Rejoindre une table

- **Endpoint :** `POST /api/events/:eventId/tables/:tableId/join`
- **Auth :** requireAuth + requireEventParticipant
- **Pas de body**

#### Transaction (CRITIQUE, serialisable)

```
BEGIN transaction (serialisable)
  1. Lock table row FOR UPDATE
  2. Verifier que l'utilisateur n'est pas deja participant -> 409
  3. Verifier que l'utilisateur n'est pas le GM -> 400
  4. Compter les participants CONFIRMED
  5. Si count < maxPlayers -> status = CONFIRMED
  6. Sinon -> status = WAITLIST
  7. Creer GameTableParticipant avec joinedAt = now()
COMMIT
```

- **Reponse :** 200 + `{ status: "CONFIRMED" | "WAITLIST", position?: number }`
- **Detection de chevauchement :** si l'utilisateur a une autre table dans un creneau chevauchant, inclure `warning: "overlap"` dans la reponse (pas de blocage).

### 5.7 Quitter une table

- **Endpoint :** `DELETE /api/events/:eventId/tables/:tableId/leave`
- **Auth :** requireAuth (doit etre participant de la table)
- **Le GM ne peut pas quitter (il doit supprimer la table)**

#### Transaction

```
BEGIN transaction (serialisable)
  1. Lock table row FOR UPDATE
  2. Supprimer GameTableParticipant pour cet utilisateur
  3. Si l'utilisateur etait CONFIRMED et la waitlist n'est pas vide :
     -> Promouvoir le premier en waitlist (joinedAt ASC) en CONFIRMED
     -> Creer notification WAITLIST_PROMOTED pour le joueur promu
COMMIT
```

- **Reponse :** 204

### 5.8 Expulser un joueur d'une table

- **Endpoint :** `DELETE /api/events/:eventId/tables/:tableId/participants/:userId`
- **Auth :** requireAuth + requireTableGMOrAdmin
- **Meme logique que quitter mais pour un autre utilisateur**
- **Creer notification PLAYER_KICKED pour le joueur expulse**
- **Reponse :** 204

### 5.9 Detection de chevauchement

Le chevauchement entre tables pour un meme utilisateur est **autorise** mais signale visuellement.

**Condition de chevauchement :**

```
new.startDateTime < existing.endDateTime
AND
new.endDateTime > existing.startDateTime
```

- Cote API : le chevauchement est retourne comme warning, jamais comme blocage.
- Cote UI : indicateur visuel sur les tables chevauchantes (couleur, icone).

### 5.10 Tags

- **Endpoint :** `GET /api/tags?q=search`
- **Auth :** requireAuth
- **Logique :** retourne les tags matchant la query (ILIKE), max 20 resultats
- **Reponse :** 200 + `[{ id, name }]`

---

## 6. Domaine : Jeux de societe (Board Games)

### 6.1 Recherche et cache

#### Rechercher des jeux

- **Endpoint :** `GET /api/boardgames/search?q=name`
- **Auth :** requireAuth
- **Logique :**
  1. Chercher en DB locale : `WHERE name ILIKE '%query%'` (limit 20)
  2. Si resultats locaux < 5 : query BGG XML API en fallback
  3. Parser la reponse XML de BGG, cacher chaque resultat en DB comme BoardGame
  4. Merger les resultats (dedupliquer par externalSource+externalId)
  5. Retourner les resultats combines
- **API BGG :**
  - Recherche : `https://boardgamegeek.com/xmlapi2/search?query=NAME&type=boardgame`
  - Details : `https://boardgamegeek.com/xmlapi2/thing?id=ID&stats=1` (pour les details complets a la selection)
- **Reponse :** 200 + `[{ id, name, yearPublished, imageUrl, externalSource, externalId }]`

#### Detail d'un jeu

- **Endpoint :** `GET /api/boardgames/:boardGameId`
- **Auth :** requireAuth
- **Logique :** retourner le BoardGame depuis la DB locale. Si seul un stub existe (depuis la recherche), fetcher les details complets depuis BGG et mettre a jour le cache.
- **Reponse :** 200 + objet BoardGame complet

#### Creer un jeu manuellement

- **Endpoint :** `POST /api/boardgames`
- **Auth :** requireAuth
- **Body :** `{ name, yearPublished?, minPlayers?, maxPlayers?, playingTime?, description? }`
- `externalSource` et `externalId` sont NULL
- Pas de verification d'unicite pour les entrees manuelles (doublons OK)
- **Reponse :** 201 + objet BoardGame

### 6.2 Jeux d'un event

#### Ajouter un jeu a un event

- **Endpoint :** `POST /api/events/:eventId/boardgames`
- **Auth :** requireAuth + requireEventParticipant
- **Body :** `{ boardGameId }`
- `broughtByUserId` = utilisateur de la session
- Contrainte unique `(eventId, boardGameId, broughtByUserId)` -> 409 si doublon
- **Reponse :** 201 + EventBoardGame avec details du BoardGame

#### Lister les jeux d'un event

- **Endpoint :** `GET /api/events/:eventId/boardgames`
- **Auth :** requireAuth + requireEventParticipant
- **Reponse :** 200 + `[{ id, boardGame: {...}, broughtBy: { id, username } }]`
- Groupes par jeu (plusieurs utilisateurs peuvent amener le meme jeu)

#### Retirer un jeu d'un event

- **Endpoint :** `DELETE /api/events/:eventId/boardgames/:eventBoardGameId`
- **Auth :** requireAuth, doit etre `broughtByUserId` OU ADMIN
- **Reponse :** 204

### 6.3 Gestion de la concurrence BGG

**Deux utilisateurs cherchent le meme nouveau jeu simultanement :**

Les deux appellent l'API BGG et tentent d'INSERT le meme BoardGame.

**Solution :** contrainte unique sur `(externalSource, externalId)`. Si le second insert echoue -> catch l'erreur, fetch la ligne existante, continuer normalement.

---

## 7. Domaine : Real-Time (Socket.io)

### 7.1 Architecture

- Socket.io attache au serveur HTTP Express existant.
- Authentification : cookie de session forwarde lors du handshake WebSocket, parse cote serveur.
- Namespace : `/` (namespace par defaut).
- Rooms : une room par event `event:{eventId}` + une room par user `user:{userId}`.

### 7.2 Events emis par le serveur

| Event                   | Payload                                 | Declencheur                                  |
| ----------------------- | --------------------------------------- | -------------------------------------------- |
| `table:created`         | `{ table }`                             | Nouvelle GameTable creee                     |
| `table:updated`         | `{ table }`                             | GameTable modifiee                           |
| `table:deleted`         | `{ tableId }`                           | GameTable supprimee                          |
| `table:player:joined`   | `{ tableId, userId, username, status }` | Joueur rejoint une table                     |
| `table:player:left`     | `{ tableId, userId }`                   | Joueur quitte une table                      |
| `table:player:promoted` | `{ tableId, userId, username }`         | Promotion depuis waitlist                    |
| `table:player:demoted`  | `{ tableId, userId, username }`         | Demotion vers waitlist                       |
| `participant:joined`    | `{ userId, username }`                  | Nouveau participant a l'event                |
| `participant:removed`   | `{ userId }`                            | Participant retire de l'event                |
| `boardgame:added`       | `{ eventBoardGame }`                    | Jeu ajoute a l'event                         |
| `boardgame:removed`     | `{ eventBoardGameId }`                  | Jeu retire de l'event                        |
| `notification:new`      | `{ notification }`                      | Nouvelle notification (room `user:{userId}`) |

### 7.3 Events emis par le client

| Event         | Payload       | But                          |
| ------------- | ------------- | ---------------------------- |
| `join:event`  | `{ eventId }` | Rejoindre la room d'un event |
| `leave:event` | `{ eventId }` | Quitter la room d'un event   |

### 7.4 Cycle de vie de connexion

1. Client se connecte avec le cookie de session
2. Serveur valide la session, extrait le userId
3. Client rejoint automatiquement `user:{userId}` (pour notifications)
4. Client emet `join:event` avec eventId
5. Serveur verifie que l'utilisateur est participant, rejoint la room `event:{eventId}`
6. Client recoit tous les events suivants pour cette room
7. A la deconnexion/navigation, le client emet `leave:event` ou quitte automatiquement

### 7.5 Gestion d'erreurs

- Session invalide -> deconnexion avec erreur
- Pas participant de l'event -> event erreur, pas de join de room
- Redemarrage serveur -> reconnexion automatique (built-in Socket.io)

---

## 8. Domaine : Notifications In-App

### 8.1 Types de notifications

| Type                  | Destinataires                     | Message template                                         |
| --------------------- | --------------------------------- | -------------------------------------------------------- |
| `TABLE_DELETED`       | Tous les participants de la table | "La table '{title}' a ete supprimee"                     |
| `TABLE_DATE_CLAMPED`  | GM de la table                    | "Les horaires de votre table '{title}' ont ete ajustes"  |
| `WAITLIST_PROMOTED`   | Joueur promu                      | "Vous avez ete promu sur la table '{title}'"             |
| `WAITLIST_DEMOTED`    | Joueur deplace                    | "Vous avez ete deplace en liste d'attente sur '{title}'" |
| `PLAYER_KICKED`       | Joueur expulse                    | "Vous avez ete retire de la table '{title}'"             |
| `PARTICIPANT_REMOVED` | Utilisateur retire                | "Vous avez ete retire de l'evenement '{name}'"           |
| `EVENT_UPDATED`       | Tous les participants             | "L'evenement '{name}' a ete modifie"                     |

### 8.2 Delivery

- Chaque notification est **persistee en DB** ET **emise en temps reel** via Socket.io sur la room `user:{userId}`.
- Event Socket.io : `notification:new` avec le payload complet de la notification.
- Le client met a jour le badge/compteur en temps reel.

### 8.3 Endpoints

#### Lister les notifications

- **Endpoint :** `GET /api/notifications`
- **Auth :** requireAuth
- **Query params :** `?unreadOnly=true`, `?limit=50`, `?offset=0`
- **Reponse :** 200 + tableau de notifications, triees par `createdAt DESC`

#### Marquer comme lue

- **Endpoint :** `PATCH /api/notifications/:notificationId/read`
- **Auth :** requireAuth (doit etre proprietaire)
- **Met `readAt = now()`**
- **Reponse :** 200

#### Marquer toutes comme lues

- **Endpoint :** `POST /api/notifications/read-all`
- **Auth :** requireAuth
- **Met `readAt = now()` sur toutes les notifications non lues de l'utilisateur**
- **Reponse :** 200 + `{ count }`

#### Compteur non lues

- **Endpoint :** `GET /api/notifications/unread-count`
- **Auth :** requireAuth
- **Reponse :** 200 + `{ count: number }`

---

## 9. Gestion des utilisateurs

### 9.1 Profil

#### Obtenir son profil

- **Endpoint :** `GET /api/auth/me` (existe deja)
- **Auth :** requireAuth
- **Reponse :** 200 + `{ id, email, username, role, createdAt }`

#### Modifier son profil

- **Endpoint :** `PATCH /api/users/me`
- **Auth :** requireAuth
- **Body :** `{ username?, email?, currentPassword?, newPassword? }`
- **Regles :**
  - Changement de username : verifier unicite, ancien username libere immediatement
  - Changement d'email : verifier unicite
  - Changement de mot de passe : `currentPassword` requis pour verification
  - Pas d'invalidation de session sur aucun changement
- **Reponse :** 200 + utilisateur mis a jour

### 9.2 Administration des utilisateurs

#### Lister les utilisateurs (admin)

- **Endpoint :** `GET /api/admin/users`
- **Auth :** requireAuth + requireAdmin
- **Query params :** `?q=search`, `?includeDeleted=true`
- **Reponse :** 200 + tableau d'utilisateurs

#### Soft delete d'un utilisateur (admin)

- **Endpoint :** `DELETE /api/admin/users/:userId`
- **Auth :** requireAuth + requireAdmin
- **Met `deletedAt = now()`**
- **Ne cascade PAS** (preserve l'integrite des donnees, l'utilisateur ne peut simplement plus se connecter)
- **Invalide toutes les sessions de cet utilisateur**
- **Reponse :** 204

---

## 10. Regles de validation

| Entite          | Champ      | Regles                                      |
| --------------- | ---------- | ------------------------------------------- |
| User            | email      | Format email valide                         |
| User            | username   | 3-30 chars, alphanum + underscore           |
| User            | password   | Min 8 caracteres                            |
| Event           | name       | 1-100 caracteres                            |
| Event           | dates      | start < end, start dans le futur (creation) |
| GameTable       | title      | 1-150 caracteres                            |
| GameTable       | pitch      | Max 2000 caracteres                         |
| GameTable       | triggers   | Max 1000 caracteres                         |
| GameTable       | comments   | Max 1000 caracteres                         |
| GameTable       | maxPlayers | Entier, 1-20                                |
| GameTable       | dates      | Dans les bornes de l'event, end > start     |
| Tag             | name       | 1-50 caracteres, stocke lowercase           |
| EventInvitation | email      | Format email valide                         |

---

## 11. Transactions requises

| Operation            | Isolation    | Rows verrouilees              | Raison                |
| -------------------- | ------------ | ----------------------------- | --------------------- |
| Rejoindre table      | Serialisable | GameTable row                 | Empecher overbooking  |
| Quitter table        | Serialisable | GameTable row                 | Promotion correcte    |
| Expulser joueur      | Serialisable | GameTable row                 | Promotion correcte    |
| Reduire maxPlayers   | Serialisable | GameTable row                 | Etat coherent         |
| Augmenter maxPlayers | Serialisable | GameTable row                 | Promotion correcte    |
| Changer dates event  | Serialisable | Event + toutes ses GameTables | Cascade complexe      |
| Retirer participant  | Serialisable | Multiples tables              | Cascade multi-entites |

Toutes les transactions utilisent `prisma.$transaction()` en mode interactif avec isolation serialisable.

---

## 12. Table complete des endpoints API

| Method            | Path                                                        | Auth              | Description                 |
| ----------------- | ----------------------------------------------------------- | ----------------- | --------------------------- |
| GET               | `/health`                                                   | -                 | Health check                |
| **Auth**          |                                                             |                   |                             |
| POST              | `/api/auth/signup`                                          | - (token requis)  | Inscription via invitation  |
| POST              | `/api/auth/login`                                           | -                 | Connexion (token optionnel) |
| POST              | `/api/auth/logout`                                          | Auth              | Deconnexion                 |
| GET               | `/api/auth/me`                                              | Auth              | Profil courant              |
| **Users**         |                                                             |                   |                             |
| PATCH             | `/api/users/me`                                             | Auth              | Modifier son profil         |
| GET               | `/api/admin/users`                                          | Admin             | Lister les utilisateurs     |
| DELETE            | `/api/admin/users/:userId`                                  | Admin             | Soft delete utilisateur     |
| **Events**        |                                                             |                   |                             |
| POST              | `/api/events`                                               | Admin             | Creer un event              |
| GET               | `/api/events`                                               | Auth              | Lister mes events           |
| GET               | `/api/events/:eventId`                                      | Participant       | Detail d'un event           |
| PATCH             | `/api/events/:eventId`                                      | Createur          | Modifier un event           |
| DELETE            | `/api/events/:eventId`                                      | Createur          | Supprimer un event          |
| **Invitations**   |                                                             |                   |                             |
| POST              | `/api/events/:eventId/invitations`                          | Createur          | Envoyer une invitation      |
| GET               | `/api/events/:eventId/invitations`                          | Createur          | Lister les invitations      |
| GET               | `/api/invitations/:token`                                   | -                 | Valider un token            |
| POST              | `/api/invitations/:token/accept`                            | Auth              | Accepter une invitation     |
| **Participants**  |                                                             |                   |                             |
| GET               | `/api/events/:eventId/participants`                         | Participant       | Lister les participants     |
| DELETE            | `/api/events/:eventId/participants/:userId`                 | Createur          | Retirer un participant      |
| DELETE            | `/api/events/:eventId/participants/me`                      | Participant       | Quitter l'event             |
| **GameTables**    |                                                             |                   |                             |
| POST              | `/api/events/:eventId/tables`                               | Participant       | Creer une table             |
| GET               | `/api/events/:eventId/tables`                               | Participant       | Lister les tables           |
| GET               | `/api/events/:eventId/tables/:tableId`                      | Participant       | Detail d'une table          |
| PATCH             | `/api/events/:eventId/tables/:tableId`                      | GM/Admin          | Modifier une table          |
| DELETE            | `/api/events/:eventId/tables/:tableId`                      | GM/Admin          | Supprimer une table         |
| POST              | `/api/events/:eventId/tables/:tableId/join`                 | Participant       | Rejoindre une table         |
| DELETE            | `/api/events/:eventId/tables/:tableId/leave`                | Table participant | Quitter une table           |
| DELETE            | `/api/events/:eventId/tables/:tableId/participants/:userId` | GM/Admin          | Expulser un joueur          |
| **Tags**          |                                                             |                   |                             |
| GET               | `/api/tags`                                                 | Auth              | Rechercher des tags         |
| **Board Games**   |                                                             |                   |                             |
| GET               | `/api/boardgames/search`                                    | Auth              | Rechercher des jeux         |
| GET               | `/api/boardgames/:boardGameId`                              | Auth              | Detail d'un jeu             |
| POST              | `/api/boardgames`                                           | Auth              | Creer un jeu manuellement   |
| POST              | `/api/events/:eventId/boardgames`                           | Participant       | Ajouter un jeu a l'event    |
| GET               | `/api/events/:eventId/boardgames`                           | Participant       | Lister les jeux de l'event  |
| DELETE            | `/api/events/:eventId/boardgames/:id`                       | Owner/Admin       | Retirer un jeu de l'event   |
| **Notifications** |                                                             |                   |                             |
| GET               | `/api/notifications`                                        | Auth              | Lister les notifications    |
| PATCH             | `/api/notifications/:id/read`                               | Auth              | Marquer comme lue           |
| POST              | `/api/notifications/read-all`                               | Auth              | Marquer toutes comme lues   |
| GET               | `/api/notifications/unread-count`                           | Auth              | Compteur non lues           |

**Total : 37 endpoints** (+ 1 health check)
