# Prochaines etapes - TomManager

Phases terminees : 1-8 (auth, events, planning, board games, real-time, notifications, UI, robustesse) + 10 (monitoring).

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

## Phase 9 : Emails (Priorite haute)

**Objectif** : Envoyer les invitations par email au lieu de partager des liens manuellement.
On va peut être ignorer cette étape pour le moment. Voir le système auth plus optimisé avec Discord plus bas.

### 9.1 Infrastructure email

- [ ] Choisir un provider (Resend, SendGrid, ou SMTP generique via nodemailer)
- [ ] Service `email.ts` avec methode `sendEmail(to, subject, html)`
- [ ] Templates HTML pour les emails (inline CSS)
- [ ] Config env : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
- [ ] Mode dev : log les emails dans la console (pas d'envoi reel)

### 9.2 Emails d'invitation

- [ ] A la creation d'une invitation → email envoye au destinataire
- [ ] Template : nom de l'event, lien d'invitation, nom de l'invitant
- [ ] Bouton CTA "Rejoindre l'evenement" dans l'email
- [ ] Gestion des erreurs d'envoi (log + ne pas bloquer la creation)

### 9.3 Emails de notification (optionnel)

- [ ] Email a l'expulsion d'un joueur
- [ ] Email quand un event est modifie (dates)
- [ ] Preference utilisateur : activer/desactiver les emails
- [ ] Tests : mock du service email, verification des appels

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

**Contexte** : L'API XML v2 de BGG (`boardgamegeek.com/xmlapi2`) retourne desormais `Unauthorized` sur les requetes serveur-a-serveur. La recherche BGG est donc non fonctionnelle.
Doc : https://boardgamegeek.com/wiki/page/BGG_XML_API2

**Objectif** : Migrer vers l'API officielle BGG (avec authentification).

- [ ] Creer un compte BGG et obtenir des credentials API
- [ ] Remplacer `services/bgg.ts` pour utiliser l'API officielle BGG (OAuth ou cle API selon ce que BGG propose)
- [ ] Mettre les credentials dans les variables d'environnement (`BGG_API_KEY` ou similaire)
- [ ] Tester la recherche et le fetch des details d'un jeu
- [ ] Mettre a jour les tests qui mockent BGG

**En attendant** : utiliser "Create manually" pour ajouter des jeux.

---

## Phase 15 : Features avancees (Priorite basse, a discuter)

Idees de features futures, a prioriser selon les besoins :

- [ ] **Bot Discord** : acces aux events via roles Discord (remplace les invitations email, voir detail ci-dessous)
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

### Detail : Bot Discord — auth + acces par role (Phase 15+)

**Vision finale arretee**

Discord est le point d'entree unique : authentification, creation de compte ET acces aux events.
Le bot lit les roles des membres (lecture seule, zero permission d'ecriture sur Discord).
Phase 9 (Mailer) devient entierement obsolete.

---

**Flux complet**

```
Creation de compte (automatique, sans action de l'user)
  1. L'admin cree l'event "Hiver 2028" dans TomManager
  2. L'admin saisit l'ID du role Discord dans TomManager
  3. Sur Discord, l'admin assigne le role "Hiver 2028" au membre
  4. Le bot detecte l'assignation (guildMemberUpdate)
     → Si aucun User avec ce discordId : CREE le compte (discordId, username, avatar depuis Discord)
     → Cree EventParticipation
  5. L'user a un compte TomManager et l'acces a l'event sans avoir rien fait

Premiere connexion (session)
  6. L'user clique "Se connecter avec Discord" sur TomManager
  7. OAuth2 Discord → on recupere le discordId
  8. User.findOne({ discordId }) → compte existe deja (cree par le bot)
  9. Session TomManager creee — pas de creation de compte ici, juste une auth

Retrait d'acces
  10. L'admin retire le role Discord au membre
  11. Le bot detecte le retrait → supprime EventParticipation (cascade propre)
      Note : le compte User est conserve (historique des tables, etc.)
```

---

**Gestion des admins TomManager**

Les admins TomManager sont les membres Discord ayant le role "admin" sur le serveur. L'ID du role est configure via la variable d'environnement `DISCORD_ADMIN_ROLE_ID`.

- Lors de l'assignation du role admin Discord → le bot passe le `User.role` a `ADMIN` dans la DB
- Lors du retrait du role → le bot repasse le `User.role` a `USER`
- Permet de gerer les droits admin directement depuis Discord, sans interface TomManager dediee

```
guildMemberUpdate — complement pour le role admin :
  si DISCORD_ADMIN_ROLE_ID est defini :
    si roleAdded.id === DISCORD_ADMIN_ROLE_ID → User.update({ role: "ADMIN" })
    si roleRemoved.id === DISCORD_ADMIN_ROLE_ID → User.update({ role: "USER" })
```

**Permissions du bot (minimales)**

| Permission Discord      | Raison                                                   |
| ----------------------- | -------------------------------------------------------- |
| `Server Members Intent` | Lire les membres et leurs roles                          |
| Aucune autre            | Le bot ne cree, ne modifie, ne supprime rien sur Discord |

---

**Modele de donnees (migrations)**

```
User  +-- discordId      : String?  UNIQUE  -- Snowflake Discord
      +-- discordUsername : String?          -- Affichage (rafraichi a chaque login)
      +-- avatarUrl       : String?          -- CDN Discord

      passwordHash devient nullable (les users Discord n'ont pas de mot de passe local)

Event +-- discordRoleId  : String?           -- ID du role Discord lie a cet event
```

---

**Auth : coexistence Discord OAuth + comptes locaux**

- Les comptes existants (email/password) continuent de fonctionner → pas de migration forcee
- Un compte local peut etre lie a Discord ulterieurement (bouton dans le profil)
- L'admin conserve un compte local (fallback si Discord est indisponible)
- A terme : Discord OAuth devient le flux par defaut, comptes locaux reserves aux admins

---

**Ce que fait le bot**

```
guildMemberUpdate(oldMember, newMember)
  rolesAdded   = newMember.roles - oldMember.roles
  rolesRemoved = oldMember.roles - newMember.roles

  pour chaque role ajoute :
    event = Event.findOne({ discordRoleId: role.id })
    si event :
      user = User.findOne({ discordId: newMember.id })
      si !user :
        // Creation automatique du compte
        user = User.create({
          discordId:       newMember.id,
          username:        newMember.displayName,
          discordUsername: newMember.user.username,
          avatarUrl:       newMember.displayAvatarURL(),
          role:            "USER",
        })
      EventParticipation.upsert({ eventId: event.id, userId: user.id })

  pour chaque role retire :
    event = Event.findOne({ discordRoleId: role.id })
    user  = User.findOne({ discordId: newMember.id })
    si event && user :
      EventParticipation.delete({ eventId: event.id, userId: user.id })
      // cascade : participations aux tables de l'event supprimees aussi
      // le compte User est conserve
```

---

**Endpoint de sync manuelle (admin)**

`POST /api/admin/discord/sync`

- Appelle `guild.members.fetch()` pour recuperer tous les membres et leurs roles actuels
- Reconcilie avec la DB : cree les participations manquantes, supprime les invalides
- Utile apres un redemarrage du bot ou pour corriger un ecart

---

**Infrastructure**

- Service Docker dedie : `discord-bot/` dans le mono-repo
- Acces direct a PostgreSQL via Prisma (schema partage avec le backend)
- Variables : `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_ADMIN_ROLE_ID`
- Le bot est stateless : redemarrage sans perte de donnees

---

**Surface de complexite**

| Composant                          | Complexite |
| ---------------------------------- | ---------- |
| Migration DB (4 champs)            | Faible     |
| OAuth2 Discord (login/signup)      | Moyenne    |
| Bot guildMemberUpdate              | Faible     |
| Endpoint sync manuelle             | Faible     |
| Coexistence comptes locaux/Discord | Faible     |
| Liaison compte local → Discord     | Faible     |

Total : 1-2 sprints. Le seul vrai travail est l'OAuth2 Discord cote backend.

---

**OAuth2 Discord — fonctionnement et securite**

```
Browser                    TomManager Backend           Discord
  |                               |                        |
  |-- clic "Login Discord" ------>|                        |
  |                               |-- genere state (CSRF)  |
  |<-- redirect authorize URL ----|                        |
  |                                                        |
  |-------- redirect vers discord.com/oauth2/authorize --->|
  |<-- consent screen Discord ------------------------------|
  |    "TomManager veut acceder a votre profil"            |
  |                                                        |
  |-- user clique "Autoriser" ---------------------------->|
  |<-- redirect /auth/discord/callback?code=XXX&state=YYY--|
  |                                                        |
  |-- GET /auth/discord/callback?code=XXX --------------->|
  |                               |-- POST /oauth2/token ->|
  |                               |   (code + client_secret)
  |                               |<-- access_token -------|
  |                               |-- GET /users/@me ----->|
  |                               |<-- { id, username... } |
  |                               |-- User.findOrCreate()  |
  |                               |-- session creee        |
  |<-- redirect /events -----------|                        |
```

_Securite cote TomManager_

- **Code ephemere a usage unique** : valable ~5 min, inutilisable une seconde fois
- **Echange serveur a serveur** : le `client_secret` ne quitte jamais le backend,
  le browser ne voit jamais le `access_token` Discord
- **Protection CSRF via `state`** : token aleatoire genere avant la redirection,
  verifie au retour du callback — empeche de forcer la liaison d'un compte tiers
- **Aucun token Discord stocke** : apres recuperation du profil, le `access_token` est jete.
  TomManager n'a pas besoin de rappeler l'API Discord ensuite
- **Session inchangee** : cookie `connect.sid` httpOnly + secure + SameSite,
  meme mecanique que l'auth email/password existante

_Securite cote compte Discord_

- **Scope minimal `identify` uniquement** : donne acces a `id`, `username`, `avatar` — rien d'autre
- TomManager ne peut pas : lire/envoyer des messages, voir les serveurs,
  acceder a l'email Discord, modifier quoi que ce soit
- **Consentement explicite** : Discord affiche un ecran listant exactement ce qui est demande
- **Revocable** : l'utilisateur peut revoquer l'acces depuis Discord > Parametres > Applis autorisees.
  Note : cela invalide le token OAuth mais pas la session TomManager en cours
  (comportement OAuth2 standard — a gerer avec une duree de session raisonnable)

_Ce qu'on evite deliberement_

| Evite                     | Raison                                      |
| ------------------------- | ------------------------------------------- |
| Stocker le `access_token` | Inutile, surface d'attaque supplementaire   |
| Scope `email`             | Non necessaire                              |
| Scope `guilds`            | Le bot lit les roles avec son propre token  |
| PKCE                      | Non requis, client confidentiel avec secret |

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
