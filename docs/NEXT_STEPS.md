# Prochaines etapes - TomManager

Les phases 1-7 sont terminees. Le coeur fonctionnel est complet :
auth, events, planning, board games, real-time, notifications, UI mobile-first.

Ci-dessous les prochaines phases possibles, classees par priorite.

---

## Phase 8 : Robustesse & Validation (Priorite haute)

**Objectif** : Securiser les entrees, ameliorer la gestion d'erreurs, rendre l'app resiliente.

### 8.1 Validation des entrees avec Zod

Zod est installe (`package.json`) mais jamais utilise. Tous les controllers font des validations manuelles dans les services. Migrer vers des schemas Zod dans les controllers.

- [ ] Schema Zod pour `POST /api/auth/signup` (email, username, password, invitationToken)
- [ ] Schema Zod pour `POST /api/auth/login` (identifier, password, invitationToken?)
- [ ] Schema Zod pour `POST /api/events` (name, startDateTime, endDateTime)
- [ ] Schema Zod pour `PATCH /api/events/:eventId` (partial)
- [ ] Schema Zod pour `POST /api/events/:eventId/tables` (title, maxPlayers, dates, etc.)
- [ ] Schema Zod pour `PATCH /api/events/:eventId/tables/:tableId` (partial)
- [ ] Schema Zod pour `POST /api/events/:eventId/invitations` (email)
- [ ] Schema Zod pour `POST /api/boardgames` (name, optionals)
- [ ] Schema Zod pour `POST /api/boardgames/from-bgg` (bggId, name)
- [ ] Schema Zod pour `POST /api/events/:eventId/boardgames` (boardGameId)
- [ ] Middleware generique `validateBody(schema)` reutilisable
- [ ] Validation UUID sur les params de route (`:eventId`, `:tableId`, etc.)
- [ ] Tests : chaque endpoint rejette les donnees invalides avec 400

### 8.2 Error Boundary & pages d'erreur (Frontend)

- [ ] Composant `ErrorBoundary` React (catch errors, affiche fallback)
- [ ] Page `NotFoundPage` pour les routes invalides (`*` dans AppRoutes)
- [ ] Page d'erreur generique (500, network error)
- [ ] Gestion du 401 global : intercepteur Axios qui redirige vers `/login`
- [ ] Gestion du 403 : message "Acces refuse" au lieu d'un ecran blanc
- [ ] Retry automatique sur les requetes GET echouees (1 retry apres 2s)
- [ ] Tests : ErrorBoundary affiche le fallback

### 8.3 Rate limiting etendu

Actuellement seul `/api/auth/login` et `/signup` sont limites.

- [ ] Rate limiter global sur toutes les routes API (100 req/min par IP)
- [ ] Rate limiter specifique sur les ecritures (POST/PATCH/DELETE : 30 req/min)
- [ ] Headers `RateLimit-*` documentes dans l'API

---

## Phase 9 : Emails (Priorite haute)

**Objectif** : Envoyer les invitations par email au lieu de partager des liens manuellement.

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

| Aspect | Score | Detail |
|--------|-------|--------|
| CI/CD | 9/10 | GitHub Actions, Docker, Portainer |
| Deploiement | 9/10 | Traefik, SSL, multi-stage Docker |
| Tests auto | 7/10 | 225 tests, pas d'E2E |
| Securite | 7/10 | Helmet, bcrypt, sessions, rate limit auth. Manque Zod |
| Frontend | 9/10 | Mobile-first, a11y, skeletons, real-time |
| Backend | 8/10 | API complete, Socket.io, notifications. Manque validation Zod |
| Monitoring | 3/10 | Pino basique, pas de Sentry/APM |
| Email | 0/10 | Non implemente |
| Documentation | 7/10 | Specs + context, pas de README/Swagger |
