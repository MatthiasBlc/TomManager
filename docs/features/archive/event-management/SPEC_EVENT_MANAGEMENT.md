# Spec : Event Management

> CRUD complet des events, gestion des participants et invitations.

---

## Contexte

Phase 1 a pose les bases : modeles DB (Event, EventInvitation, EventParticipation), creation d'event, invitations, auth avec token. Phase 2 complete le CRUD event et ajoute la gestion des participants.

---

## 1. Nouveaux middlewares

| Middleware                | Role                                                     | Erreur |
| ------------------------- | -------------------------------------------------------- | ------ |
| `requireEventParticipant` | Verifie EventParticipation existe pour (eventId, userId) | 403    |
| `requireEventCreator`     | Verifie `event.createdBy === userId`                     | 403    |

---

## 2. Endpoints backend

### 2.1 Events CRUD

| Method   | Path                   | Auth                                 | Description                                           |
| -------- | ---------------------- | ------------------------------------ | ----------------------------------------------------- |
| `GET`    | `/api/events`          | requireAuth                          | Lister events (USER: mes participations, ADMIN: tous) |
| `GET`    | `/api/events/:eventId` | requireAuth + (participant OU ADMIN) | Detail event                                          |
| `PATCH`  | `/api/events/:eventId` | requireAuth + requireEventCreator    | Modifier event                                        |
| `DELETE` | `/api/events/:eventId` | requireAuth + requireEventCreator    | Supprimer event + cascade                             |

**GET /api/events**

- USER : events ou l'utilisateur a une EventParticipation
- ADMIN : tous les events
- Query param : `?upcoming=true` (filtre startDateTime > now)
- Reponse : `200 [{ id, name, startDateTime, endDateTime, participantCount }]`

**GET /api/events/:eventId**

- Reponse : `200 { data: event }` avec liste participants (userId, username, joinedAt)

**PATCH /api/events/:eventId**

- Body : `{ name?, startDateTime?, endDateTime? }` (partiel)
- Validation : memes regles que creation apres merge
- Side effect : mettre a jour expiresAt des invitations PENDING
- (Cascade dates GameTables repoussee a Phase 3)
- Reponse : `200 { data: event }`

**DELETE /api/events/:eventId**

- Cascade hard : EventInvitations, EventParticipations (les GameTables n'existent pas encore)
- Reponse : `204`

### 2.2 Invitations listing

| Method | Path                               | Auth                              | Description        |
| ------ | ---------------------------------- | --------------------------------- | ------------------ |
| `GET`  | `/api/events/:eventId/invitations` | requireAuth + requireEventCreator | Lister invitations |

- Reponse : `200 [{ id, email, status, createdAt }]`

### 2.3 Participants

| Method   | Path                                        | Auth                                  | Description         |
| -------- | ------------------------------------------- | ------------------------------------- | ------------------- |
| `GET`    | `/api/events/:eventId/participants`         | requireAuth + requireEventParticipant | Lister participants |
| `DELETE` | `/api/events/:eventId/participants/:userId` | requireAuth + requireEventCreator     | Retirer participant |
| `DELETE` | `/api/events/:eventId/participants/me`      | requireAuth + requireEventParticipant | Quitter event       |

**GET participants**

- Reponse : `200 [{ userId, username, role, joinedAt }]`

**DELETE participants/:userId**

- Le createur ne peut pas etre retire
- Cascade basique (Phase 2) : supprimer EventParticipation
- (Cascade etendue GameTables/BoardGames repoussee a Phase 3/4)
- Reponse : `204`

**DELETE participants/me**

- Le createur ne peut pas quitter son propre event
- Meme cascade que retrait admin
- Reponse : `204`

---

## 3. Frontend

### 3.1 Layout / Navigation

**Navbar** — barre de navigation commune

- Logo/titre, lien events, logout

### 3.2 Pages

**EventListPage** (`/events`)

- Grille de cards des events
- Bouton "Creer un event" (admin only)
- Affiche nom, dates, nombre de participants

**EventDetailPage** (`/events/:eventId`)

- Onglets : Info / Participants / Invitations (createur only)
- Info : nom, dates, bouton edit/delete (createur)
- Participants : liste avec bouton retirer (createur)
- Invitations : liste + formulaire d'envoi

### 3.3 Composants

| Composant           | Description                        |
| ------------------- | ---------------------------------- |
| `CreateEventModal`  | Modal creation event               |
| `EditEventModal`    | Modal modification event           |
| `InvitationManager` | Envoi + liste invitations          |
| `ParticipantList`   | Liste participants + actions admin |

---

## 4. Tests attendus

### Backend (integration)

- Event list (USER voit ses events, ADMIN voit tout, filtre upcoming)
- Event detail (participant OK, non-participant 403, admin OK)
- Event update (createur OK, non-createur 403, validation)
- Event delete (createur OK, non-createur 403, cascade)
- Invitation listing (createur OK, non-createur 403)
- Participant listing (participant OK, non-participant 403)
- Participant remove (createur OK, self-remove impossible, non-createur 403)
- Leave event (participant OK, createur impossible)

### Frontend

- EventListPage affiche les events
- CreateEventModal validation
- ParticipantList affichage
