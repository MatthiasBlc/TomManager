# TomManager - Roadmap de Developpement

> Roadmap phasee pour le developpement complet de TomManager. Chaque phase est autonome et deployable.

---

## Phase 1 : Auth Rework (Inscription par invitation)

**Objectif :** Supprimer l'auto-inscription, implementer le flow d'invitation par token.

### DB (Migration Prisma)

- Ajouter model `Event` (id, name, startDateTime, endDateTime, createdBy, timestamps)
- Ajouter model `EventInvitation` (id, eventId, email, invitedBy, token, expiresAt, status, createdAt)
- Ajouter model `EventParticipation` (id, eventId, userId, status, timestamps)
- Ajouter enum `InvitationStatus` (PENDING, ACCEPTED, EXPIRED)
- Ajouter relations : User -> Event (createdBy), User -> EventInvitation (invitedBy)
- Contraintes : unique(email, eventId), unique(token), unique(eventId, userId)

### Backend

| Endpoint | Description |
|----------|-------------|
| `POST /api/events` | Creation event minimale (necessaire pour le flow invitation) |
| `POST /api/events/:eventId/invitations` | Envoyer une invitation |
| `GET /api/invitations/:token` | Valider un token |
| `POST /api/invitations/:token/accept` | Accepter une invitation |

**Modifications :**
- `POST /api/auth/signup` : rendre `invitationToken` obligatoire. Flow : valider token -> creer user -> accepter invitation -> creer participation -> set session
- `POST /api/auth/login` : ajouter `invitationToken` optionnel. Si present : login + accepter invitation + creer participation

**Fichiers concernes :**
- `backend/prisma/schema.prisma` (nouveaux models)
- `backend/src/services/auth.ts` (rework signup/login)
- `backend/src/controllers/auth.ts` (adapter)
- `backend/src/routes/auth.ts` (adapter)
- `backend/src/services/invitation.ts` (nouveau)
- `backend/src/controllers/invitation.ts` (nouveau)
- `backend/src/routes/invitation.ts` (nouveau)
- `backend/src/services/event.ts` (nouveau, creation minimale)
- `backend/src/middleware/auth.ts` (ajouter requireAdmin)

### Frontend

| Composant/Page | Description |
|----------------|-------------|
| `InvitationLandingPage` | `/invite/:token` — valide token, route vers signup ou login |
| `SignupPage` | Nouveau — accessible uniquement via invitation, email pre-rempli |
| `LoginPage` | Modifier — accepter contexte token, afficher info invitation |
| `AuthContext` / `AuthProvider` | Store etat utilisateur, gestion redirections |

**Fichiers concernes :**
- `frontend/src/pages/InvitationLandingPage.tsx` (nouveau)
- `frontend/src/pages/SignupPage.tsx` (nouveau)
- `frontend/src/pages/LoginPage.tsx` (modifier)
- `frontend/src/contexts/AuthContext.tsx` (nouveau)
- `frontend/src/routes/AppRoutes.tsx` (nouvelles routes)

### Tests

**Backend (integration) :**
- Creation invitation (admin only, validation email)
- Token validation (valide, expire, utilise, introuvable)
- Signup avec token (happy path, token invalide, email mismatch)
- Login avec token (happy path, deja participant)
- Signup sans token -> 400
- Resend invitation (EXPIRED -> OK, PENDING -> 409)

**Frontend :**
- InvitationLandingPage : rendu + logique de redirection
- SignupPage : validation formulaire

---

## Phase 2 : Event Management

**Objectif :** CRUD complet des events, gestion des participants et invitations.

### DB (Migration Prisma)

- Pas de nouveaux models (crees en Phase 1)
- Ajouter indexes si necessaire : EventParticipation(eventId, userId)

### Backend

| Endpoint | Description |
|----------|-------------|
| `GET /api/events` | Lister mes events (USER: mes participations, ADMIN: tous) |
| `GET /api/events/:eventId` | Detail event avec participants et stats |
| `PATCH /api/events/:eventId` | Modifier event (sans cascade dates, Phase 3) |
| `DELETE /api/events/:eventId` | Supprimer event + cascade |
| `GET /api/events/:eventId/invitations` | Lister invitations |
| `GET /api/events/:eventId/participants` | Lister participants |
| `DELETE /api/events/:eventId/participants/:userId` | Retirer participant (basique, cascade etendue Phase 3) |
| `DELETE /api/events/:eventId/participants/me` | Quitter event |

**Nouveaux middlewares :**
- `requireEventParticipant(eventId)`
- `requireEventCreator(eventId)`

**Fichiers concernes :**
- `backend/src/services/event.ts` (completer CRUD)
- `backend/src/controllers/event.ts` (nouveau)
- `backend/src/routes/event.ts` (nouveau)
- `backend/src/services/participant.ts` (nouveau)
- `backend/src/controllers/participant.ts` (nouveau)
- `backend/src/routes/participant.ts` (nouveau)
- `backend/src/middleware/auth.ts` (nouveaux middlewares)
- `backend/src/routes/index.ts` (brancher les nouvelles routes)

### Frontend

| Composant/Page | Description |
|----------------|-------------|
| `EventListPage` | `/events` — grille/liste des events |
| `EventDetailPage` | `/events/:eventId` — onglets info/participants/invitations |
| `CreateEventModal` | Modal de creation d'event |
| `EditEventModal` | Modal de modification |
| `InvitationManager` | Composant d'envoi/suivi d'invitations |
| `ParticipantList` | Liste des participants avec actions admin |
| Layout/Navigation | Navbar ou sidebar avec navigation |

**Fichiers concernes :**
- `frontend/src/pages/EventListPage.tsx` (nouveau)
- `frontend/src/pages/EventDetailPage.tsx` (nouveau)
- `frontend/src/components/events/CreateEventModal.tsx` (nouveau)
- `frontend/src/components/events/EditEventModal.tsx` (nouveau)
- `frontend/src/components/events/InvitationManager.tsx` (nouveau)
- `frontend/src/components/events/ParticipantList.tsx` (nouveau)
- `frontend/src/components/layout/Navbar.tsx` (nouveau)
- `frontend/src/routes/AppRoutes.tsx` (nouvelles routes)

### Tests

**Backend (integration) :**
- Event CRUD (create, read, update, delete)
- Autorisation (non-admin ne peut creer, non-createur ne peut editer/supprimer)
- Listing participants, retrait, depart
- Cascade suppression event (invitations, participations supprimees)

**Frontend :**
- EventListPage affiche les events
- CreateEventModal validation
- ParticipantList affichage

---

## Phase 3 : Planning System (GameTables)

**Objectif :** CRUD complet des GameTables, tags, participation avec waitlist, gestion de la concurrence, cascade dates event.

### DB (Migration Prisma)

- Ajouter model `GameTable` (id, eventId, createdBy, title, pitch, triggers, comments, maxPlayers, startDateTime, endDateTime, timestamps)
- Ajouter model `Tag` (id, name unique lowercase)
- Ajouter model `GameTableTag` (gameTableId, tagId — PK composite)
- Ajouter model `GameTableParticipant` (id, gameTableId, userId, status, joinedAt)
- Ajouter enum `TableParticipantStatus` (CONFIRMED, WAITLIST)
- Indexes : GameTable(eventId, startDateTime), GameTableParticipant(gameTableId, status)
- Contraintes : unique(gameTableId, userId)

### Backend

| Endpoint | Description |
|----------|-------------|
| `POST /api/events/:eventId/tables` | Creer une table |
| `GET /api/events/:eventId/tables` | Lister les tables (filtre par jour optionnel) |
| `GET /api/events/:eventId/tables/:tableId` | Detail table + participants |
| `PATCH /api/events/:eventId/tables/:tableId` | Modifier table (transactions maxPlayers) |
| `DELETE /api/events/:eventId/tables/:tableId` | Supprimer table |
| `POST /api/events/:eventId/tables/:tableId/join` | Rejoindre (transaction FOR UPDATE) |
| `DELETE /api/events/:eventId/tables/:tableId/leave` | Quitter (transaction promotion) |
| `DELETE /api/events/:eventId/tables/:tableId/participants/:userId` | Expulser |
| `GET /api/tags?q=` | Autocomplete tags |

**Modifications existantes :**
- `PATCH /api/events/:eventId` : ajouter la logique de cascade dates
- `DELETE /api/events/:eventId/participants/:userId` : ajouter la cascade tables

**Nouveau middleware :**
- `requireTableGMOrAdmin(tableId)`

**Fichiers concernes :**
- `backend/prisma/schema.prisma` (nouveaux models)
- `backend/src/services/gameTable.ts` (nouveau)
- `backend/src/controllers/gameTable.ts` (nouveau)
- `backend/src/routes/gameTable.ts` (nouveau)
- `backend/src/services/tag.ts` (nouveau)
- `backend/src/controllers/tag.ts` (nouveau)
- `backend/src/routes/tag.ts` (nouveau)
- `backend/src/services/event.ts` (cascade dates)
- `backend/src/services/participant.ts` (cascade tables)
- `backend/src/middleware/auth.ts` (requireTableGMOrAdmin)

### Frontend

| Composant/Page | Description |
|----------------|-------------|
| `PlanningPage` | `/events/:eventId/planning` — vue timeline principale |
| `TimelineView` | Vue continue type Google Calendar (multi-jours) |
| `TableCard` | Carte affichee sur la timeline (titre, GM, joueurs, tags) |
| `CreateTableModal` | Formulaire avec autocomplete tags |
| `EditTableModal` | Modification de table |
| `TableDetailDrawer` | Panneau lateral avec infos completes, participants, join/leave |
| `TagInput` | Autocomplete multi-select pour tags |
| `OverlapWarning` | Indicateur visuel de chevauchement |
| `WaitlistBadge` | Badge indiquant le status WAITLIST |

**Fichiers concernes :**
- `frontend/src/pages/PlanningPage.tsx` (nouveau)
- `frontend/src/components/planning/TimelineView.tsx` (nouveau)
- `frontend/src/components/planning/TableCard.tsx` (nouveau)
- `frontend/src/components/planning/CreateTableModal.tsx` (nouveau)
- `frontend/src/components/planning/EditTableModal.tsx` (nouveau)
- `frontend/src/components/planning/TableDetailDrawer.tsx` (nouveau)
- `frontend/src/components/planning/TagInput.tsx` (nouveau)
- `frontend/src/components/planning/OverlapWarning.tsx` (nouveau)

### Tests

**Backend (integration) :**
- Table CRUD (create, read, update, delete)
- Validation dates (dans bornes event)
- Join table (confirmed vs waitlist)
- Leave table (auto-promotion)
- Join concurrent (deux users simultanement, un en waitlist)
- Reduction maxPlayers (overflow vers waitlist)
- Augmentation maxPlayers (promotion waitlist)
- Cascade changement dates event (clamp, suppression tables invalides)
- Cascade retrait participant (tables supprimees, participations retirees)
- Tag autocomplete
- GM ne peut pas rejoindre sa propre table

**Frontend :**
- PlanningPage timeline affiche les tables
- CreateTableModal validation
- Etats boutons join/leave
- Affichage warning chevauchement

---

## Phase 4 : Board Games (Jeux de societe)

**Objectif :** Integration API BGG, cache local, gestion des jeux par event.

### DB (Migration Prisma)

- Ajouter model `BoardGame` (id, name, externalSource?, externalId?, yearPublished?, minPlayers?, maxPlayers?, playingTime?, description?, imageUrl?, createdAt)
- Ajouter model `EventBoardGame` (id, eventId, boardGameId, broughtByUserId, createdAt)
- Contrainte unique partielle : BoardGame(externalSource, externalId) WHERE NOT NULL
- Contrainte unique : EventBoardGame(eventId, boardGameId, broughtByUserId)
- Index : BoardGame(name), EventBoardGame(eventId)

### Backend

| Endpoint | Description |
|----------|-------------|
| `GET /api/boardgames/search?q=` | Recherche (local + fallback BGG) |
| `GET /api/boardgames/:boardGameId` | Detail (lazy fetch BGG si stub) |
| `POST /api/boardgames` | Creation manuelle |
| `POST /api/events/:eventId/boardgames` | Ajouter un jeu a l'event |
| `GET /api/events/:eventId/boardgames` | Lister les jeux de l'event |
| `DELETE /api/events/:eventId/boardgames/:id` | Retirer un jeu de l'event |

**Nouveau service :**
- `bggService.ts` : client HTTP pour BGG XML API, parser XML -> JSON, gestion timeout/retry, logique de cache

**Modification :**
- Cascade retrait participant : inclure suppression EventBoardGame

**Fichiers concernes :**
- `backend/prisma/schema.prisma` (nouveaux models)
- `backend/src/services/boardGame.ts` (nouveau)
- `backend/src/services/bgg.ts` (nouveau — client BGG API)
- `backend/src/controllers/boardGame.ts` (nouveau)
- `backend/src/routes/boardGame.ts` (nouveau)
- `backend/src/services/eventBoardGame.ts` (nouveau)
- `backend/src/controllers/eventBoardGame.ts` (nouveau)
- `backend/src/routes/eventBoardGame.ts` (nouveau)
- `backend/src/services/participant.ts` (cascade boardgames)
- `backend/package.json` (ajouter dep XML parser si necessaire)

### Frontend

| Composant/Page | Description |
|----------------|-------------|
| `BoardGameTab` | Onglet sur EventDetailPage — liste des jeux |
| `BoardGameSearchInput` | Autocomplete, cherche local puis BGG |
| `BoardGameCard` | Carte jeu (image, nom, annee, joueurs) |
| `BoardGameList` | Liste groupee par jeu, montre qui l'amene |
| `AddBoardGameModal` | Modal d'ajout de jeu a l'event |
| `ManualBoardGameForm` | Formulaire creation manuelle |

**Fichiers concernes :**
- `frontend/src/components/boardgames/BoardGameTab.tsx` (nouveau)
- `frontend/src/components/boardgames/BoardGameSearchInput.tsx` (nouveau)
- `frontend/src/components/boardgames/BoardGameCard.tsx` (nouveau)
- `frontend/src/components/boardgames/BoardGameList.tsx` (nouveau)
- `frontend/src/components/boardgames/AddBoardGameModal.tsx` (nouveau)
- `frontend/src/components/boardgames/ManualBoardGameForm.tsx` (nouveau)

### Tests

**Backend (integration) :**
- Recherche board game (resultats locaux, fallback BGG, cache)
- Creation manuelle
- Ajout a l'event (happy path, doublon -> 409, non-participant -> 403)
- Retrait (owner, admin, non-owner -> 403)
- Parsing XML BGG (mock API responses)
- Cascade retrait participant inclut board games

**Frontend :**
- BoardGameSearchInput autocomplete
- BoardGameList affichage et groupement

---

## Phase 5 : Real-Time (Socket.io)

**Objectif :** Mises a jour en direct du planning via WebSocket.

### DB

Aucun changement.

### Backend

**Setup :**
- Installation Socket.io : `npm install socket.io`
- Attacher Socket.io au serveur HTTP Express dans `server.ts`
- Middleware d'authentification session pour handshake WebSocket
- Gestion des rooms : `event:{eventId}` et `user:{userId}`

**Integration :**
- Emettre les events depuis tous les services existants :
  - `gameTable.ts` : table:created, table:updated, table:deleted
  - `gameTableParticipant` : table:player:joined, table:player:left, table:player:promoted, table:player:demoted
  - `participant.ts` : participant:joined, participant:removed
  - `eventBoardGame.ts` : boardgame:added, boardgame:removed

**Fichiers concernes :**
- `backend/src/server.ts` (attacher Socket.io)
- `backend/src/socket/index.ts` (nouveau — setup, auth middleware, rooms)
- `backend/src/socket/events.ts` (nouveau — handlers join:event, leave:event)
- Tous les services existants (ajouter emit Socket.io)
- `backend/package.json` (ajouter socket.io)

### Frontend

| Composant/Hook | Description |
|----------------|-------------|
| `useSocket` | Hook — connexion/deconnexion lifecycle |
| `useEventSocket(eventId)` | Hook — join/leave room, ecoute events |
| `ConnectionStatus` | Indicateur de connexion WebSocket |

**Integration :**
- PlanningPage : utiliser donnees temps reel (UI optimiste + reconciliation serveur)
- TableDetailDrawer : changements participants en direct
- BoardGameList : ajouts/suppressions en direct

**Fichiers concernes :**
- `frontend/src/hooks/useSocket.ts` (nouveau)
- `frontend/src/hooks/useEventSocket.ts` (nouveau)
- `frontend/src/components/common/ConnectionStatus.tsx` (nouveau)
- `frontend/src/pages/PlanningPage.tsx` (adapter)
- `frontend/src/components/planning/TableDetailDrawer.tsx` (adapter)
- `frontend/src/components/boardgames/BoardGameTab.tsx` (adapter)
- `frontend/package.json` (ajouter socket.io-client)

### Tests

**Backend (integration) :**
- Connexion WebSocket avec session valide
- Rejet sans session
- Join/leave room
- Reception table:created quand un autre utilisateur cree une table
- Reception player:joined/left

**Frontend :**
- useSocket hook lifecycle
- MAJ temps reel des tables rendues correctement

---

## Phase 6 : Notifications In-App

**Objectif :** Notifications persistantes avec delivery temps reel.

### DB (Migration Prisma)

- Ajouter model `Notification` (id, userId, type, title, message, data JSON?, readAt?, createdAt)
- Ajouter enum `NotificationType` (TABLE_DELETED, TABLE_DATE_CLAMPED, WAITLIST_PROMOTED, WAITLIST_DEMOTED, PLAYER_KICKED, PARTICIPANT_REMOVED, EVENT_UPDATED)
- Index : Notification(userId, readAt)

### Backend

| Endpoint | Description |
|----------|-------------|
| `GET /api/notifications` | Lister (pagine, filtre unread) |
| `PATCH /api/notifications/:id/read` | Marquer comme lue |
| `POST /api/notifications/read-all` | Marquer toutes comme lues |
| `GET /api/notifications/unread-count` | Compteur |

**Nouveau service :**
- `notificationService.ts` : `createNotification()` qui persiste en DB + emet via Socket.io sur `user:{userId}`

**Integration :** ajouter creation de notification dans :
- Suppression de table -> TABLE_DELETED pour tous les participants
- Clamp dates table -> TABLE_DATE_CLAMPED pour le GM
- Promotion waitlist -> WAITLIST_PROMOTED
- Demotion waitlist -> WAITLIST_DEMOTED
- Expulsion joueur -> PLAYER_KICKED
- Retrait participant -> PARTICIPANT_REMOVED
- Modification event -> EVENT_UPDATED

**Fichiers concernes :**
- `backend/prisma/schema.prisma` (nouveau model)
- `backend/src/services/notification.ts` (nouveau)
- `backend/src/controllers/notification.ts` (nouveau)
- `backend/src/routes/notification.ts` (nouveau)
- `backend/src/routes/index.ts` (brancher)
- Tous les services concernes (ajouter appels notification)

### Frontend

| Composant/Hook | Description |
|----------------|-------------|
| `NotificationBell` | Icone dans la navbar avec badge compteur |
| `NotificationDropdown` | Panel deroulant avec liste des notifications |
| `NotificationItem` | Element cliquable, lien vers page concernee |
| `useNotifications` | Hook — compteur + liste temps reel |

**Fichiers concernes :**
- `frontend/src/components/notifications/NotificationBell.tsx` (nouveau)
- `frontend/src/components/notifications/NotificationDropdown.tsx` (nouveau)
- `frontend/src/components/notifications/NotificationItem.tsx` (nouveau)
- `frontend/src/hooks/useNotifications.ts` (nouveau)
- `frontend/src/components/layout/Navbar.tsx` (integrer NotificationBell)

### Tests

**Backend (integration) :**
- Notification creee a la suppression de table
- Notification creee a la promotion waitlist
- Liste notifications (pagination, filtre unread)
- Mark read, mark all read
- Delivery temps reel via Socket.io

**Frontend :**
- NotificationBell badge compteur
- NotificationDropdown affiche les items
- Clic notification -> navigation vers page concernee

---

## Phase 7 : UI Polish & Mobile-First

**Objectif :** Design responsive, ameliorations UX, accessibilite.

### DB

Aucun changement.

### Backend

- Pagination sur tous les endpoints de liste
- Rate limiting middleware (express-rate-limit deja installe)
- Audit standardisation des reponses d'erreur

### Frontend

**Responsive mobile-first :**
- Redesign responsive de toutes les pages
- Timeline mobile : scroll vertical au lieu d'horizontal
- Interactions tactiles (taille des cibles, swipe)

**UX :**
- Loading skeletons pour tout le contenu async
- Empty states pour toutes les listes
- Error boundaries
- Validation formulaire UX (erreurs inline, inputs debounces)

**DaisyUI :**
- Customisation du theme
- Coherence des composants

**Accessibilite :**
- Labels ARIA
- Navigation clavier
- Gestion du focus

**PWA basique :**
- Manifest
- Indicateur offline (pas de support offline complet)

### Tests

**Frontend :**
- Tests de rendu responsive (viewports mobile/tablet/desktop)
- Audit accessibilite (integration axe-core)

**E2E :**
- Flow complet : invitation -> signup -> rejoindre event -> creer table -> rejoindre table -> ajouter jeu

**Performance :**
- Benchmarks temps de reponse API
