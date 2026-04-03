# Prochaines etapes - TomManager

Les phases 1-7 sont terminees. Le coeur fonctionnel est complet :
auth, events, planning, board games, real-time, notifications, UI mobile-first.

La phase 8 (Robustesse) est en cours — 8.1 et 8.2 terminees.

Ci-dessous les prochaines phases possibles, classees par priorite.

---

## Phase 8 : Robustesse & Validation ✅ 8.1 + 8.2 terminees

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

### 8.3 Rate limiting etendu

Actuellement seul `/api/auth/login` et `/signup` sont limites.

- [ ] Rate limiter global sur toutes les routes API (100 req/min par IP)
- [ ] Rate limiter specifique sur les ecritures (POST/PATCH/DELETE : 30 req/min)
- [ ] Headers `RateLimit-*` documentes dans l'API

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

## Phase 10 : Monitoring & Observabilite (Priorite moyenne)

**Objectif** : Savoir ce qui se passe en production.

### 10.1 Error tracking

- [ ] Integrer Sentry (backend + frontend)
- [ ] Capturer les erreurs non catchees
- [ ] Source maps uploadees pour le frontend
- [ ] Contexte utilisateur dans les erreurs (userId, sans PII)

### 10.2 Logging structure

- [ ] Niveaux de log par environnement (debug en dev, warn en prod)
- [ ] Redaction des donnees sensibles dans les logs (password, tokens)
- [ ] Request ID dans chaque log (tracabilite)
- [ ] Correlation Socket.io events ↔ HTTP requests

### 10.3 Health check enrichi

- [ ] `GET /health` retourne aussi : version, uptime, DB connectivity
- [ ] Endpoint `/health/ready` (readiness probe pour Kubernetes/Portainer)

---

## Phase 11 : Tests E2E (Priorite moyenne)

**Objectif** : Tester les flux complets utilisateur.

### 11.1 Setup Playwright

- [ ] Installer Playwright
- [ ] Config CI : run E2E apres les tests unitaires
- [ ] Fixtures : seed DB avec admin + event + invitations

### 11.2 Scenarios E2E

- [ ] Flow complet inscription : invitation → signup → acces event
- [ ] Flow complet login avec token : login → event rejoint
- [ ] Creer un event → inviter → participant rejoint
- [ ] Creer une table → rejoindre → quitter → promotion waitlist
- [ ] Ajouter un jeu (recherche BGG) → retirer
- [ ] Verifier les notifications en temps reel (2 browsers)
- [ ] Navigation mobile : bottom tab bar, bottom sheets, FAB

---

## Phase 12 : Optimisations DB & Performance (Priorite moyenne)

**Objectif** : Preparer l'app pour un usage plus intensif.

### 12.1 Index manquants

- [ ] `EventParticipation(eventId)` - utilise dans les requetes de liste
- [ ] `Event(createdBy)` - pour les events d'un user
- [ ] `GameTableParticipant(userId)` - pour les tables d'un user
- [ ] `Notification(userId, createdAt)` - pour la pagination

### 12.2 Performance

- [ ] Audit des requetes N+1 (Prisma query logging)
- [ ] Pagination sur les endpoints qui n'en ont pas (participants, invitations)
- [ ] Cache Redis pour les sessions (remplacer Prisma session store)
- [ ] Compression gzip sur les reponses API

---

## Phase 13 : Documentation & DX (Priorite basse)

**Objectif** : Faciliter l'onboarding et la maintenance.

- [ ] README.md a la racine (presentation, setup, commandes)
- [ ] OpenAPI/Swagger genere depuis les schemas Zod
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

| Aspect        | Score | Detail                                                        |
| ------------- | ----- | ------------------------------------------------------------- |
| CI/CD         | 9/10  | GitHub Actions, Docker, Portainer                             |
| Deploiement   | 9/10  | Traefik, SSL, multi-stage Docker                              |
| Tests auto    | 8/10  | 252 tests (backend 188 + frontend 61), pas d'E2E              |
| Securite      | 8/10  | Helmet, bcrypt, sessions, rate limit auth, Zod validation     |
| Frontend      | 9/10  | Mobile-first, a11y, skeletons, real-time, ErrorBoundary       |
| Backend       | 9/10  | API complete, Socket.io, notifications, validation Zod        |
| Monitoring    | 3/10  | Pino basique, pas de Sentry/APM                               |
| Email         | 0/10  | Non implemente                                                |
| Documentation | 7/10  | Specs + context, pas de README/Swagger                        |
