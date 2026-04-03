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

## Etape 2 — Migration DB

- [ ] `npx prisma migrate dev --name add_discord_fields`
  - `User.email` → nullable
  - `User.passwordHash` → nullable
  - `User.discordId` String? UNIQUE
  - `User.discordUsername` String?
  - `User.avatarUrl` String?
  - `Event.discordRoleId` String? UNIQUE
- [ ] Mettre a jour `.claude/context/DB_MODELS.md`

## Etape 3 — Backend : env + types

- [ ] Ajouter variables Discord dans `backend/src/config/env.ts` (optionelles sauf CLIENT_ID/SECRET/GUILD_ID/REDIRECT_URI)
- [ ] Etendre `express-session.d.ts` : `oauthState`, `oauthReturnTo`, `oauthAction`
- [ ] Mettre a jour les types TypeScript si besoin (Prisma regenere apres migration)

## Etape 4 — Service Discord OAuth

- [ ] `backend/src/services/discordAuth.ts`
  - `exchangeCode(code)` → access_token
  - `fetchDiscordUser(token)` → profil
  - `fetchGuildMember(token)` → roles
  - `buildAvatarUrl(id, hash)` → URL CDN
  - `generateUniqueUsername(candidate, discordId)` → username deduplique
  - `syncDiscordParticipations(userId, roles)` → upsert/delete participations

## Etape 5 — Routes et controllers

- [ ] `backend/src/routes/auth.ts` : ajouter `GET /discord` et `GET /discord/callback` et `DELETE /discord/link`
- [ ] `backend/src/controllers/discordAuth.ts` :
  - `initiateDiscordLogin` : genere state, construit URL, retourne `{ url }`
  - `handleDiscordCallback` : echange code, sync, session, redirect
  - `unlinkDiscord` : validation + update
- [ ] `backend/src/schemas/event.ts` : ajouter `discordRoleId` dans le schema PATCH
- [ ] `backend/src/controllers/event.ts` : passer `discordRoleId` au service
- [ ] `backend/src/services/event.ts` : valider unicite `discordRoleId` sur PATCH

## Etape 6 — `GET /api/auth/me` etendu

- [ ] `backend/src/services/auth.ts` : `getMe()` retourne aussi `discordId`, `discordUsername`, `avatarUrl`
- [ ] `login()` : verifier `passwordHash !== null` avant `bcrypt.compare`

## Etape 7 — Frontend

- [ ] `frontend/src/api/auth.ts` : ajouter `initiateDiscordLogin()`, `unlinkDiscord()`
- [ ] `frontend/src/pages/LoginPage.tsx` : bouton "Login avec Discord" + divider
- [ ] `frontend/src/pages/ProfilePage.tsx` : section liaison Discord (avatar, handle, bouton)
- [ ] `frontend/src/types/user.ts` : etendre le type User avec les champs Discord
- [ ] `frontend/src/components/layout/Header.tsx` : afficher avatar Discord si present
- [ ] Champ `discordRoleId` dans le formulaire d'edition d'event (admin only)

## Etape 8 — Tests

- [ ] `backend/src/__tests__/unit/discordAuth.test.ts` : fonctions utilitaires
- [ ] `backend/src/__tests__/unit/discordParticipation.test.ts` : syncDiscordParticipations
- [ ] `backend/src/__tests__/integration/auth.test.ts` : ajouter cas Discord (mock fetch)
- [ ] Mettre a jour le compte de tests dans NEXT_STEPS.md

## Etape 9 — Documentation & config

- [ ] Ajouter variables Discord dans `.env.example`, `docker-compose.yml` (dev + prod)
- [ ] GitHub Secrets : DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI
- [ ] `docs/MANUAL_TESTING.md` : scenarios Discord (login, liaison, sync roles)
- [ ] `.claude/context/API_MAP.md` : ajouter les 3 nouveaux endpoints
- [ ] `.claude/context/DB_MODELS.md` : mettre a jour User et Event
- [ ] `.claude/context/FILE_MAP.md` : ajouter discordAuth.ts (service + controller)

---

## Pour la Phase 15b (Bot Discord) — voir NEXT_STEPS.md
