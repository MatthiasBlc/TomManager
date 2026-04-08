# Prochaines etapes - TomManager

Phases terminees : 1-8 (auth, events, planning, board games, real-time, notifications, UI, robustesse) + 10 (monitoring) + 11 (E2E) + 12 (perf DB) + 15a (Discord OAuth) + 15b (Bot Discord).

Phase 9 (Emails) intentionnellement ignoree — remplacee par le systeme Discord (Phase 15).

Ci-dessous les prochaines phases restantes, classees par priorite.

---

## Phase 8 : Robustesse & Validation ✅ COMPLETE

**Objectif** : Securiser les entrees, ameliorer la gestion d'erreurs, rendre l'app resiliente.

### 8.1 Validation des entrees avec Zod ✅ COMPLETE

- [x] Middleware generique `validateBody(schema)` reutilisable (`backend/src/middleware/validateBody.ts`)
- [x] Middleware `validateUUID(...params)` pour les params de route
- [x] Schema Zod pour `POST /api/auth/signup` et `POST /api/auth/login`
- [x] Schema Zod pour `POST /api/events` et `PATCH /api/events/:eventId`
- [x] Schema Zod pour `POST` et `PATCH /api/events/:eventId/tables`
- [x] Schema Zod pour `POST /api/events/:eventId/invitations`
- [x] Schema Zod pour `POST /api/boardgames` et `POST /api/boardgames/from-bgg`
- [x] Validation UUID sur les params de route (`:eventId`, `:tableId`, `:userId`, `:boardGameId`, `:invitationId`)
- [x] Tests : 20 cas de rejet 400 sur donnees invalides (188 tests total)

Note : `POST /api/events/:eventId/boardgames` (boardGameId) non encore schema-valide — a faire si besoin.

### 8.2 Error Boundary & pages d'erreur (Frontend) ✅ COMPLETE

- [x] Composant `ErrorBoundary` React — catch errors, fallback "Erreur inattendue" + bouton recharger (`frontend/src/components/common/ErrorBoundary.tsx`)
- [x] Page `NotFoundPage` pour les routes invalides (route `*` dans AppRoutes) (`frontend/src/pages/NotFoundPage.tsx`)
- [x] Gestion du 401 global : intercepteur Axios redirige vers `/login` (sauf routes `/api/auth/`)
- [x] Gestion du 403 : toast "Acces refuse"
- [x] `ErrorBoundary` wrappe `AppContent` dans `App.tsx`
- [x] Tests : 3 cas (fallback defaut, fallback custom, rendu normal sans erreur)

Non fait : retry automatique sur GET (deprioritise).

### 8.3 Rate limiting etendu ✅ COMPLETE

- [x] Rate limiter global : 100 req/min par IP sur toutes les routes `/api`
- [x] Rate limiter ecritures : 30 req/min par IP sur POST/PATCH/DELETE
- [x] Headers `RateLimit-*` inclus via `standardHeaders: "draft-7"` (express-rate-limit)
- [x] Les deux limiters sont desactives en environnement de test

---

## Phase 10 : Monitoring & Observabilite ✅ COMPLETE

**Objectif** : Savoir ce qui se passe en production.

### 10.1 Error tracking ✅ COMPLETE

- [x] Sentry backend (`@sentry/node`) — actif uniquement si `SENTRY_DSN` est defini en env (`backend/src/util/sentry.ts`)
- [x] Sentry frontend (`@sentry/react`) — actif uniquement si `VITE_SENTRY_DSN` est defini, uniquement en `PROD`
- [x] Capture des erreurs 5xx dans `errorHandler` avec contexte userId (sans email) et requestId
- [x] `tracesSampleRate: 0.2` pour limiter le volume

Non fait : source maps uploadees (necessite config CI Sentry — a faire si besoin).

### 10.2 Logging structure ✅ COMPLETE

- [x] Niveaux par environnement : `debug` en dev, `warn` en prod, `silent` en test
- [x] Redaction des donnees sensibles : `body.password`, `body.invitationToken`, `req.headers.authorization`, `req.headers.cookie`
- [x] Request ID : genere par pino-http, utilise le header `X-Request-ID` si present (Traefik), sinon `crypto.randomUUID()`

Non fait : correlation Socket.io ↔ HTTP (deprioritise, complexite elevee pour la valeur).

### 10.3 Health check enrichi ✅ COMPLETE

- [x] `GET /health` retourne `{ status, version, uptime, db }` avec connectivity check DB
- [x] `GET /health/ready` readiness probe — 200 si DB ok, 503 sinon
- [x] Tests : 2 cas couverts

---

## Phase 11 : Tests E2E ✅ COMPLETE

**Objectif** : Tester les flux complets utilisateur.

### 11.1 Setup Playwright ✅ COMPLETE

- [x] `@playwright/test` installe a la racine, config dans `playwright.config.ts`
- [x] Projets : `chromium` (desktop) + `mobile-chrome` (Pixel 5)
- [x] Scripts : `npm run test:e2e`, `test:e2e:ui`, `test:e2e:report`
- [x] Fixtures (`e2e/fixtures/seed.ts`) : seedAdmin, seedEvent, seedInvitation via API REST
- [x] Endpoint `/api/test/seed-admin` cote backend (disponible uniquement en `NODE_ENV=test`)
- [x] Job CI `test-e2e` dans `deploy.yml` — lance apres test-backend et test-frontend, bloque le build si echec

### 11.2 Scenarios E2E ✅ COMPLETE (scenarios realistes)

- [x] Flow inscription : invitation → lien → signup form → redirection event (`e2e/auth.spec.ts`)
- [x] Login avec compte existant + logout (`e2e/auth.spec.ts`)
- [x] Creer une table via le bouton (`e2e/planning.spec.ts`)
- [x] Rejoindre puis quitter une table (`e2e/planning.spec.ts`)
- [x] Creation de table via clic sur un creneau calendrier (`e2e/planning.spec.ts`)
- [x] Navigation mobile : bottom tab bar, FAB, page 404 (`e2e/mobile.spec.ts`)

Non implemente :

- BGG : API cassee (Phase 14 prerequis)
- Notifications temps reel 2 browsers : complexite elevee, valeur faible pour CI

---

## Phase 12 : Optimisations DB & Performance ✅ COMPLETE

**Objectif** : Preparer l'app pour un usage plus intensif.

### 12.1 Index manquants ✅ COMPLETE

- [x] `EventParticipation(eventId)` — migration `20260403074201_add_missing_indexes`
- [x] `Event(createdBy)` — idem
- [x] `GameTableParticipant(userId)` — idem
- Note : `Notification(userId, createdAt)` etait deja couvert par `@@index([userId, read, createdAt(sort: Desc)])`

### 12.2 Performance ✅ COMPLETE (sauf Redis)

- [x] Prisma query logging en dev : `log: [{ emit: 'event', level: 'query' }]` dans `util/db.ts`, logs via pino debug
- [x] Pagination cursor-based sur `GET /api/events/:eventId/participants` (`?limit=&cursor=`, max 100, default 50)
- [x] Pagination cursor-based sur `GET /api/events/:eventId/invitations` (meme pattern)
- [x] Compression gzip : package `compression` monte avant helmet dans `app.ts`
- [ ] Cache Redis pour les sessions (Prisma session store reste en place — necessite Redis service, a faire si la charge le justifie)

---

## Phase 13 : Documentation & DX (Priorite basse)

**Objectif** : Faciliter l'onboarding et la maintenance.

- [ ] README.md a la racine (presentation, setup, commandes)
- [ ] Guide de contribution (CONTRIBUTING.md)
- [ ] Diagramme d'architecture (composants, flux de donnees)
- [ ] CHANGELOG.md
- [ ] Guide de deploiement (etapes manuelles documentees)

---

## Phase 14 : Migration API BoardGameGeek (Priorite haute)

**Contexte** : Depuis juillet 2025, BGG exige un Bearer Token sur toutes les requetes `boardgamegeek.com/xmlapi2/*`.
La structure XML v2 est inchangee — seule l'auth est nouvelle. La recherche BGG est actuellement silencieusement cassee (retourne `[]`).

Spec complete : `docs/features/bgg-migration/SPEC_BGG_MIGRATION.md`
Roadmap detaillee : `docs/features/bgg-migration/ROADMAP.md`

**Prerequis bloquant** : Enregistrer TomManager sur `https://boardgamegeek.com/applications/create` et obtenir le Bearer Token.

**Objectif** : Refactorer `services/bgg.ts` pour ajouter l'auth + gestion des cas specifiques BGG.

- [ ] Enregistrer l'app BGG et obtenir le Bearer Token
- [ ] Ajouter `BGG_API_TOKEN` en variable d'environnement (env.ts, .env, docker-compose.yml x3, GitHub Secrets)
- [ ] Refactorer `bgg.ts` : Bearer header, retry sur 202, backoff sur 429, log sur 401
- [ ] Installer `he` et sanitiser les descriptions HTML de BGG avant stockage
- [ ] Normaliser les imageUrl `//cdn...` → `https://cdn...`
- [ ] Warning au demarrage si `BGG_API_TOKEN` absent (degraded mode)
- [ ] Tests unitaires `bgg.test.ts` (14 scenarios avec vi.stubGlobal fetch)
- [ ] Test live manuel avec vrai token
- [ ] E2E `boardgames.spec.ts` : search + ajout via BGG

**En attendant** : utiliser "Create manually" pour ajouter des jeux.

---

## Phase 15a : Discord OAuth2 — Auth + Acces par role ✅ COMPLETE

**Objectif** : Remplacer les invitations email par Discord OAuth2. L'admin assigne un role Discord
a un membre → le membre se connecte via "Login avec Discord" → TomManager lit ses roles et cree ses
participations automatiquement. Les comptes locaux (email+password) continuent de fonctionner.

- [x] Migration DB (5 champs User + `Event.discordRoleId`)
- [x] Variables d'env : `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`, `DISCORD_REDIRECT_URI`, `DISCORD_ADMIN_ROLE_ID`
- [x] Service `discordAuth.ts` (exchange, fetch profil, fetch roles, sync participations)
- [x] Routes : `GET /api/auth/discord`, `GET /api/auth/discord/callback`, `DELETE /api/auth/discord/link`
- [x] `PATCH /api/events/:eventId` : accepte `discordRoleId`
- [x] `GET /api/auth/me` : retourne `discordId`, `discordUsername`, `avatarUrl`
- [x] Frontend : bouton Login Discord, section profil liaison, champ discordRoleId admin
- [x] Tests : mock fetch Discord, cas heureux + erreurs (state invalide, pas dans guild, compte desactive)

---

## Phase 15b : Bot Discord — Sync temps reel ✅ COMPLETE

**Vision** : complement de Phase 15a. Le bot reagit aux changements de roles en temps reel :
assignation → compte cree + participation ajoutee, retrait → participation supprimee.
L'user n'a plus besoin de se connecter pour "activer" son acces.
Phase 9 (Mailer) devient entierement obsolete.

- [x] Service Docker dedie `discord-bot/` (Node.js + discord.js)
- [x] Handler `guildMemberUpdate` : sync participations sur ajout/retrait de role
- [x] Sync au demarrage (`startupSync.ts`) : reconciliation DB au boot
- [x] Endpoint admin `POST /api/admin/discord/sync` (sync manuelle)
- [x] Tests unitaires (guildMemberUpdate, startupSync, syncParticipation)

**Ce que le bot ajoute par rapport a OAuth seul** :

| Besoin                          | OAuth seul | + Bot |
| ------------------------------- | ---------- | ----- |
| Login Discord                   | Oui        | Oui   |
| Roles → participations au login | Oui        | Oui   |
| Sync immediate sans login       | Non        | Oui   |
| Compte cree avant premier login | Non        | Oui   |
| Retrait propagé sans login      | Non        | Oui   |
| Notifications DM Discord        | Non        | Oui   |

**Infrastructure** :

- Service Docker dedie : `discord-bot/` dans le mono-repo (Node.js + discord.js)
- Partage le schema Prisma avec le backend (acces direct PostgreSQL)
- Variables supplementaires par rapport a 15a : `DISCORD_BOT_TOKEN`
- Privileged Gateway Intent requis : `Server Members Intent` (activer dans Discord Developer Portal)
- Stateless : redemarrage sans perte de donnees

**Ce que fait le bot** :

```
guildMemberUpdate(oldMember, newMember)
  rolesAdded   = newMember.roles - oldMember.roles
  rolesRemoved = oldMember.roles - newMember.roles

  pour chaque role ajoute :
    event = Event.findOne({ discordRoleId: role.id })
    si event :
      user = User.findOrCreate({
        discordId:       newMember.id,
        username:        newMember.displayName (deduplique),
        discordUsername: newMember.user.username,
        avatarUrl:       newMember.displayAvatarURL(),
      })
      EventParticipation.upsert({ eventId: event.id, userId: user.id })

  pour chaque role retire :
    event = Event.findOne({ discordRoleId: role.id })
    user  = User.findOne({ discordId: newMember.id })
    si event && user :
      GameTableParticipant.deleteMany({ userId, gameTable.eventId: event.id })
      EventParticipation.delete({ eventId: event.id, userId: user.id })
      // compte User conserve (historique)

  // Gestion role admin (si DISCORD_ADMIN_ROLE_ID defini) :
  si roleAdded.id === DISCORD_ADMIN_ROLE_ID → User.update({ role: "ADMIN" })
  si roleRemoved.id === DISCORD_ADMIN_ROLE_ID → User.update({ role: "USER" })
```

**Gestion du crash / reconnexion** :

L'evenement `guildMemberUpdate` est perdu si le bot est down au moment de l'assignation.
Deux mecanismes de compensation :

1. Sync automatique au demarrage : le bot appelle `guild.members.fetch()` et reconcilie la DB
2. Endpoint admin manuel `POST /api/admin/discord/sync` (voir ci-dessous)

**Endpoint de sync manuelle (admin)** :

`POST /api/admin/discord/sync`

- Appelle `guild.members.fetch({ limit: 1000 })` avec pagination si > 1000 membres
- Reconcilie la DB : cree les participations manquantes, supprime les invalides
- Retourne `{ created: N, removed: N, errors: [] }`
- Requiert `requireAuth + requireAdmin`

**Notifications DM (optionnel, a decider)** :

- A l'ajout a un event : DM "Tu as ete ajoute a l'event {nom}. Connecte-toi sur TomManager."
- Au retrait : DM "Tu n'as plus acces a l'event {nom}."
- Configurable : `DISCORD_DM_NOTIFICATIONS=true/false`
- Si l'user bloque les DMs → echec silencieux (log uniquement)

**Surface de complexite** :

| Composant                    | Complexite |
| ---------------------------- | ---------- |
| Service docker discord-bot/  | Faible     |
| guildMemberUpdate handler    | Faible     |
| Sync au demarrage            | Faible     |
| Endpoint sync manuelle       | Faible     |
| Notifications DM (optionnel) | Faible     |

Total : 0.5 sprint. La logique de sync est deja dans Phase 15a, le bot ne fait que l'appeler.

---

## Phase 16 : Features avancees (Priorite basse, a discuter)

Idees de features futures, a prioriser selon les besoins :

- [ ] Bouton de purge d'event pour les admin (avec confirmation, vide le planning et les jeux)

- [ ] **Profil utilisateur** : avatar, bio, preferences
- [ ] **Calendrier** : vue calendrier des tables (au lieu de timeline)
- [ ] **Export** : export PDF du planning d'un event
- [ ] **Recherche globale** : recherche unifiee events + tables + jeux
- [ ] **Historique** : log des actions sur un event
- [ ] **PWA avancee** : service worker, cache offline, push notifications
- [ ] **Dark/Light mode** : toggle theme DaisyUI
- [ ] **i18n** : support multi-langue (FR/EN)
- [ ] **Commentaires** : commentaires sur les tables
- [ ] **Votes** : systeme de vote pour choisir les jeux/tables

---

## Etat actuel du projet

| Aspect        | Score | Detail                                                    |
| ------------- | ----- | --------------------------------------------------------- |
| CI/CD         | 9/10  | GitHub Actions, Docker, Portainer                         |
| Deploiement   | 9/10  | Traefik, SSL, multi-stage Docker                          |
| Tests auto    | 9/10  | 253 tests unitaires + 7 scenarios E2E Playwright          |
| Securite      | 9/10  | Helmet, bcrypt, sessions, rate limit global + writes, Zod |
| Frontend      | 9/10  | Mobile-first, a11y, skeletons, real-time, ErrorBoundary   |
| Backend       | 9/10  | API complete, Socket.io, notifications, validation Zod    |
| Monitoring    | 7/10  | Sentry integre, logs rediges, health check enrichi        |
| Email         | 0/10  | Non implemente                                            |
| Documentation | 7/10  | Specs + context, pas de README/Swagger                    |
