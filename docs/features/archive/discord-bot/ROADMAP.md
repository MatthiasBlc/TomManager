# Roadmap : Discord OAuth2 (Phase 15a)

Spec complete : `docs/features/discord-bot/SPEC_DISCORD_OAUTH.md`

---

## Etape 1 — Prerequis Discord (hors code)

- [ ] Creer l'application sur https://discord.com/developers/applications
- [ ] Copier Client ID et generer Client Secret
- [ ] Ajouter Redirect URIs : dev + prod
- [ ] Creer le bot (onglet Bot), l'inviter sur le serveur (permission minimale `bot`)
- [ ] Recuperer le DISCORD_GUILD_ID (clic droit sur le serveur > "Copier l'identifiant")
- [ ] Recuperer le DISCORD_ADMIN_ROLE_ID si applicable
- [ ] Remplir `.env` local avec les 4-5 variables Discord

## Etape 2 — Migration DB ✅

- [x] Schema Prisma mis a jour :
  - `User.email` → nullable
  - `User.passwordHash` → nullable
  - `User.discordId` String? UNIQUE
  - `User.discordUsername` String?
  - `User.avatarUrl` String?
  - `Event.discordRoleId` String? UNIQUE
- [ ] `npx prisma migrate dev --name add_discord_fields` (a lancer avec Docker)
- [ ] Mettre a jour `.claude/context/DB_MODELS.md`

## Etape 3 — Backend : env + types ✅

- [x] Variables Discord dans `backend/src/config/env.ts`
- [x] `express-session.d.ts` etendu : `oauthState`, `oauthReturnTo`, `oauthAction`

## Etape 4 — Service Discord OAuth ✅

- [x] `backend/src/services/discordAuth.ts`
  - `isDiscordConfigured()`, `generateState()`, `buildAuthorizeUrl()`
  - `exchangeCode(code)` → access_token
  - `fetchDiscordUser(token)` → profil
  - `fetchGuildMember(token)` → roles (null si pas dans le guild)
  - `buildAvatarUrl(id, hash)` → URL CDN
  - `generateUniqueUsername(candidate, discordId)` → username deduplique
  - `syncDiscordParticipations(userId, roles)` → upsert/delete participations

## Etape 5 — Routes et controllers ✅

- [x] `backend/src/routes/auth.ts` : `GET /discord`, `GET /discord/callback`, `DELETE /discord/link`
- [x] `backend/src/controllers/discordAuth.ts` : `initiateLogin`, `handleCallback`, `unlinkDiscord`
- [x] `backend/src/schemas/event.ts` : `discordRoleId` dans le schema PATCH (regex Snowflake)
- [x] `backend/src/controllers/event.ts` : passer `discordRoleId` au service
- [x] `backend/src/services/event.ts` : valider unicite `discordRoleId` sur PATCH (409)

## Etape 6 — `GET /api/auth/me` etendu ✅

- [x] `backend/src/services/auth.ts` : `getMe()` retourne `discordId`, `discordUsername`, `avatarUrl`
- [x] `login()` : verifier `passwordHash !== null` avant `bcrypt.compare`

## Etape 7 — Frontend ✅

- [x] `frontend/src/contexts/AuthContext.tsx` : User type etendu, `initiateDiscordLogin()`, `unlinkDiscord()`, `refreshUser()`
- [x] `frontend/src/pages/LoginPage.tsx` : bouton "Login avec Discord" + divider + gestion erreurs query params
- [x] `frontend/src/pages/ProfilePage.tsx` : section liaison Discord (avatar, handle, bouton link/unlink)
- [x] `frontend/src/routes/AppRoutes.tsx` : route `/profile` ajoutee
- [x] `frontend/src/components/layout/Navbar.tsx` : avatar Discord dans la navbar + lien profil
- [x] `frontend/src/components/events/EditEventModal.tsx` : champ `discordRoleId` (admin uniquement)

## Etape 8 — Tests ✅

- [x] `backend/src/__tests__/unit/discordAuth.test.ts` : generateState, buildAuthorizeUrl, buildAvatarUrl, isDiscordConfigured (7 tests)
- [x] `backend/src/__tests__/unit/discordParticipation.test.ts` : syncDiscordParticipations (5 tests)
- [x] `backend/src/__tests__/integration/discordAuth.test.ts` : state CSRF, 503, unlink 401, Zod discordRoleId
- [x] `prisma db push` + client regenere — 207/207 tests verts
- [x] Migration SQL creee : `20260403120000_add_discord_fields`

## Etape 9 — Documentation & config ✅

- [x] Variables Discord dans `.env.example`
- [x] Variables Discord dans `docker-compose.yml`
- [ ] GitHub Secrets a ajouter manuellement : DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI (prod)
- [ ] `docs/MANUAL_TESTING.md` : scenarios Discord (hors scope code — a faire manuellement)
- [x] `.claude/context/API_MAP.md` : 3 nouveaux endpoints documentes
- [x] `.claude/context/DB_MODELS.md` : User et Event mis a jour

---

## Pour la Phase 15b (Bot Discord) — voir NEXT_STEPS.md
