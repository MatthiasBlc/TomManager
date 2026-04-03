# Spec : Auth Rework (Inscription par invitation)

> Supprimer l'auto-inscription, implementer le flow d'invitation par token.

---

## Contexte

Actuellement, n'importe qui peut s'inscrire via `POST /api/auth/signup`. L'objectif est de verrouiller l'inscription derriere un systeme d'invitation : seul un admin peut inviter des utilisateurs a un event, et le signup n'est possible qu'avec un token d'invitation valide.

---

## 1. Nouveaux modeles DB

### Event

| Champ           | Type     | Contraintes                    |
| --------------- | -------- | ------------------------------ |
| `id`            | UUID     | PK                             |
| `name`          | String   | required, 1-100 chars          |
| `startDateTime` | DateTime | required, UTC                  |
| `endDateTime`   | DateTime | required, > startDateTime, UTC |
| `createdBy`     | UUID     | FK -> User.id                  |
| `createdAt`     | DateTime | default now()                  |
| `updatedAt`     | DateTime | @updatedAt                     |

Le createur est automatiquement ajoute en `EventParticipation` a la creation.

### EventInvitation

| Champ       | Type             | Contraintes            |
| ----------- | ---------------- | ---------------------- |
| `id`        | UUID             | PK                     |
| `eventId`   | UUID             | FK -> Event.id         |
| `email`     | String           | required, email valide |
| `invitedBy` | UUID             | FK -> User.id          |
| `token`     | String           | unique, UUID v4        |
| `expiresAt` | DateTime         | = event.endDateTime    |
| `status`    | InvitationStatus | default PENDING        |
| `createdAt` | DateTime         | default now()          |

**Contrainte unique :** `(email, eventId)`

**Regles :**

- Token partage manuellement (pas d'envoi email MVP)
- Single-use : apres acceptation, status = ACCEPTED
- Si EXPIRED existe pour meme (email, eventId) : supprimer l'ancienne, creer une nouvelle
- Si PENDING ou ACCEPTED existe : 409
- Modification dates event : mettre a jour `expiresAt` des invitations PENDING

### EventParticipation

| Champ       | Type     | Contraintes          |
| ----------- | -------- | -------------------- |
| `id`        | UUID     | PK                   |
| `eventId`   | UUID     | FK -> Event.id       |
| `userId`    | UUID     | FK -> User.id        |
| `status`    | String   | toujours "CONFIRMED" |
| `createdAt` | DateTime | default now()        |
| `updatedAt` | DateTime | @updatedAt           |

**Contrainte unique :** `(eventId, userId)`

### Enum InvitationStatus

`PENDING` | `ACCEPTED` | `EXPIRED`

---

## 2. Endpoints backend

### 2.1 Event (creation minimale)

| Method | Path          | Auth                       | Description    |
| ------ | ------------- | -------------------------- | -------------- |
| `POST` | `/api/events` | requireAuth + requireAdmin | Creer un event |

**Body :** `{ name, startDateTime, endDateTime }`
**Reponse :** `201 { data: event }`
**Regles :** Le createur est automatiquement ajoute en participation.

### 2.2 Invitations

| Method | Path                               | Auth                                  | Description             |
| ------ | ---------------------------------- | ------------------------------------- | ----------------------- |
| `POST` | `/api/events/:eventId/invitations` | requireAuth + requireAdmin (createur) | Envoyer invitation      |
| `GET`  | `/api/invitations/:token`          | Public                                | Valider un token        |
| `POST` | `/api/invitations/:token/accept`   | Public                                | Accepter une invitation |

**POST /api/events/:eventId/invitations**

- Body : `{ email }`
- Reponse : `201 { data: { invitation, inviteLink } }`
- Regles :
  - Si EXPIRED existe pour (email, eventId) : supprimer et recreer -> 201
  - Si PENDING ou ACCEPTED existe : 409
  - `expiresAt` = event.endDateTime

**GET /api/invitations/:token**

- Reponse : `200 { data: { email, eventName, eventId, hasAccount } }`
- Erreurs : 404 (introuvable), 410 (expiree), 409 (deja utilisee)
- `hasAccount` : true si un User existe avec cet email

**POST /api/invitations/:token/accept**

- Utilise dans le flow signup/login (pas appele directement par le front)

### 2.3 Auth (modifications)

**POST /api/auth/signup** (modifie)

- Body : `{ email, username, password, invitationToken }`
- `invitationToken` devient **obligatoire**
- Flow : valider token -> verifier email match -> creer user -> accepter invitation -> creer participation -> set session
- Reponse : `201 { user, eventId }`

**POST /api/auth/login** (modifie)

- Body : `{ identifier, password, invitationToken? }`
- `identifier` accepte email OU username
- Si `invitationToken` present : login + accepter invitation + creer participation
- Reponse : `200 { user, eventId? }`

### 2.4 Middleware

**requireAdmin** (nouveau)

- Verifie `user.role === ADMIN`
- Erreur : 403

---

## 3. Frontend

### 3.1 AuthContext / AuthProvider

- Store etat utilisateur (user | null, loading)
- `login()`, `signup()`, `logout()`, `checkAuth()` (appel `/api/auth/me`)
- Wrap l'app entiere

### 3.2 Pages

**InvitationLandingPage** (`/invite/:token`)

- Appelle `GET /api/invitations/:token`
- Si `hasAccount` : redirige vers `/login?token=:token`
- Si pas de compte : redirige vers `/signup?token=:token&email=:email`
- Affiche erreurs (token invalide, expire, deja utilise)

**SignupPage** (`/signup`) — nouveau

- Accessible uniquement avec `?token=` en query param
- Email pre-rempli et non-editable (provient du token)
- Champs : email (readonly), username, password, confirm password
- Apres signup : redirige vers `/events/:eventId`

**LoginPage** (`/login`) — modifie

- Si `?token=` present : affiche info invitation, passe le token au login
- `identifier` au lieu de `email` (accepte email ou username)
- Apres login avec token : redirige vers `/events/:eventId`
- Apres login sans token : redirige vers `/`

### 3.3 Routes

| Path             | Page                  | Acces               |
| ---------------- | --------------------- | ------------------- |
| `/invite/:token` | InvitationLandingPage | Public              |
| `/signup`        | SignupPage            | Public (avec token) |
| `/login`         | LoginPage             | Public              |
| `/`              | HomePage              | Public              |

---

## 4. Edge cases

| Situation                                  | Comportement            |
| ------------------------------------------ | ----------------------- |
| Token expire                               | 410 Gone                |
| Token deja utilise (ACCEPTED)              | 409 Conflict            |
| Token pour email X, connecte en tant que Y | 403, message explicite  |
| User deja participant de l'event           | Succes idempotent       |
| User soft-deleted                          | 403, "Compte desactive" |
| Signup sans token                          | 400                     |
| Login normal (sans token)                  | Fonctionne normalement  |

---

## 5. Tests attendus

### Backend (integration)

- Creation invitation (admin only, validation email)
- Token validation (valide, expire, utilise, introuvable)
- Signup avec token (happy path, token invalide, email mismatch)
- Login avec token (happy path, deja participant)
- Signup sans token -> 400
- Resend invitation (EXPIRED -> OK, PENDING -> 409)

### Frontend

- InvitationLandingPage : rendu + logique de redirection
- SignupPage : validation formulaire
