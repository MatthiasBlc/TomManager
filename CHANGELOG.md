# Changelog

## [Unreleased]

## [1.0.0] - 2026-04

### Phase 15b - Bot Discord

- Bot Discord avec sync des participations en temps reel (`guildMemberUpdate`)
- Sync au demarrage : reconciliation DB au boot du bot
- Endpoint admin `POST /api/admin/discord/sync` pour sync manuelle

### Phase 15a - Discord OAuth2

- Connexion via Discord OAuth2 (scopes `identify` + `guilds.members.read`)
- Sync automatique des participations aux evenements selon les roles Discord
- Liaison/deliaison d'un compte Discord depuis le profil
- Mode degrade : bouton masque si variables Discord absentes
- Champ `discordRoleId` sur les evenements (admin uniquement)

### Phase 14 - (en attente)

- Migration API BoardGameGeek (bloquee : token BGG requis)

### Phase 12 - Optimisations DB & Performance

- Index manquants sur `EventParticipation`, `Event`, `GameTableParticipant`
- Pagination cursor-based sur participants et invitations
- Compression gzip
- Prisma query logging en dev

### Phase 11 - Tests E2E

- Setup Playwright (Chromium + Chrome mobile)
- Scenarios : inscription, login/logout, tables, navigation mobile
- Job CI bloquant

### Phase 10 - Monitoring & Observabilite

- Sentry backend et frontend (actif uniquement si DSN configure)
- Logging structure avec Pino (niveaux par env, redaction donnees sensibles)
- Health check enrichi : `GET /health` et `GET /health/ready`

### Phase 8 - Robustesse & Validation

- Validation Zod sur toutes les routes d'ecriture
- Middleware `validateBody` et `validateUUID` reutilisables
- ErrorBoundary React, page 404, intercepteur 401/403 global
- Rate limiting : 100 req/min global, 30 req/min sur les ecritures

### Phase 7 - UI Mobile-First

- Design mobile-first avec bottom tab bar et FAB
- Skeletons de chargement, toasts, accessibilite

### Phase 6 - Notifications

- Systeme de notifications in-app avec marquage lu/non-lu
- Livraison temps reel via Socket.io

### Phase 5 - Real-Time

- Integration Socket.io pour les mises a jour du planning en temps reel

### Phase 4 - Jeux de Societe

- Inventaire de jeux par evenement
- Integration BoardGameGeek (recherche + import)

### Phase 3 - Planning

- Tables de jeu : creation, creneaux, GM, tags, capacite
- Inscription / desinscription des joueurs

### Phase 2 - Gestion d'Evenements

- Creation et edition d'evenements par les admins
- Invitations par lien, gestion des participations

### Phase 1 - Auth

- Inscription via invitation, connexion email/password
- Sessions avec Prisma session store
- Roles USER / ADMIN
