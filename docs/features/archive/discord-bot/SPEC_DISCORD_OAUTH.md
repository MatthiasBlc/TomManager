# Spec : Discord OAuth2 — Auth + Acces par role

Phase 15a. Le bot Discord (sync temps reel, DM) est hors scope — voir Phase 15b dans NEXT_STEPS.

---

## Vision

Discord remplace le systeme d'invitation par email. L'admin assigne un role Discord a un membre
→ ce membre se connecte via "Login avec Discord" → TomManager lit ses roles → ses participations
aux events sont synchronisees automatiquement.

Les comptes locaux (email+password) continuent de fonctionner. Les deux systemes coexistent.

---

## Perimetre de cette phase

| Inclus                                           | Hors scope              |
| ------------------------------------------------ | ----------------------- |
| Login / creation de compte via Discord OAuth2    | Bot Discord             |
| Sync roles → EventParticipation au login         | Sync temps reel         |
| Liaison compte local existant ↔ Discord          | Notifications DM        |
| Role admin Discord → User.role = ADMIN           | Multi-serveur Discord   |
| Champ `discordRoleId` sur Event (admin UI + API) | Revocation OAuth active |

---

## Migration base de donnees

### Table `User` — champs modifies

| Champ             | Avant    | Apres     | Notes                                    |
| ----------------- | -------- | --------- | ---------------------------------------- |
| `email`           | `String` | `String?` | Nullable : comptes Discord sans email    |
| `passwordHash`    | `String` | `String?` | Nullable : comptes Discord sans password |
| `discordId`       | —        | `String?` | Snowflake Discord, UNIQUE                |
| `discordUsername` | —        | `String?` | Handle global Discord (ex: `tomdu35`)    |
| `avatarUrl`       | —        | `String?` | URL CDN Discord, mise a jour au login    |

**Note sur `email` UNIQUE + nullable** : PostgreSQL traite les NULLs comme distincts dans une
contrainte UNIQUE. Plusieurs comptes Discord sans email ne generent pas de conflit. La contrainte
reste en place.

**Contrainte applicative** : le signup local valide toujours `email` comme requis via Zod.
Seul le flux OAuth cree des comptes avec `email = null`.

**Invariant** : un `User` a soit `(email + passwordHash)` soit `discordId`, soit les deux
(compte hybride). Jamais ni l'un ni l'autre.

### Table `Event` — champ ajoute

| Champ           | Type      | Notes                                      |
| --------------- | --------- | ------------------------------------------ |
| `discordRoleId` | `String?` | ID du role Discord lie a cet event, UNIQUE |

Contrainte UNIQUE : un role Discord = au plus un event. Nullable : la plupart des events existants
n'ont pas de role Discord.

---

## Variables d'environnement

| Variable                | Requis | Notes                                                      |
| ----------------------- | ------ | ---------------------------------------------------------- |
| `DISCORD_CLIENT_ID`     | Oui    | ID de l'application Discord Developer Portal               |
| `DISCORD_CLIENT_SECRET` | Oui    | Secret OAuth2, ne quitte jamais le backend                 |
| `DISCORD_GUILD_ID`      | Oui    | ID du serveur Discord (Snowflake)                          |
| `DISCORD_REDIRECT_URI`  | Oui    | URL de callback backend (env-dependante, voir ci-dessous)  |
| `DISCORD_ADMIN_ROLE_ID` | Non    | Si defini, les porteurs de ce role ont `User.role = ADMIN` |

**Valeurs selon l'environnement** :

| Env        | `DISCORD_REDIRECT_URI`                                     |
| ---------- | ---------------------------------------------------------- |
| Dev        | `http://localhost:3001/api/auth/discord/callback`          |
| Production | `https://tommanager.example.com/api/auth/discord/callback` |

Le callback est toujours cote **backend**. Le frontend ne voit jamais le `code` OAuth ni
l'`access_token` Discord.

Les deux URLs doivent etre enregistrees dans Discord Developer Portal > OAuth2 > Redirects.

**Mode degrade** : si `DISCORD_CLIENT_ID` ou `DISCORD_CLIENT_SECRET` sont absents au demarrage,
le backend log un warning et desactive les routes Discord. Le frontend masque le bouton
"Login avec Discord". L'auth locale continue de fonctionner normalement.

---

## Prerequis Discord

1. Creer une application sur https://discord.com/developers/applications
2. Onglet OAuth2 : noter Client ID et generer un Client Secret
3. Ajouter les Redirect URIs (dev + prod)
4. Onglet Bot : creer un bot (necessaire pour `guilds.members.read` — le bot doit etre dans
   le guild, mais n'a pas besoin de tourner activement pour cette phase)
5. Inviter le bot sur le serveur avec permission minimale `bot` (zero permission supplementaire)
6. Aucun Privileged Gateway Intent requis pour cette phase

---

## Scopes OAuth2

| Scope                 | Raison                                                          |
| --------------------- | --------------------------------------------------------------- |
| `identify`            | id, username, avatar de l'utilisateur                           |
| `guilds.members.read` | Roles du membre sur le serveur — necessite le bot dans le guild |

Scopes explicitement exclus : `email`, `guilds`, `messages.read`, `bot`.

---

## Nouveaux endpoints

### `GET /api/auth/discord`

Initie le flux OAuth.

**Comportement** :

1. Genere un token `state` aleatoire (16 bytes hex via `crypto.randomBytes`)
2. Stocke dans la session : `req.session.oauthState = state`
3. Si query param `returnTo` present et valide (URL relative) : `req.session.oauthReturnTo = returnTo`
4. Si `req.session.userId` defini (user deja connecte) : `req.session.oauthAction = 'link'`
5. Construit l'URL Discord :
   ```
   https://discord.com/oauth2/authorize
     ?client_id=DISCORD_CLIENT_ID
     &redirect_uri=DISCORD_REDIRECT_URI (encode)
     &response_type=code
     &scope=identify%20guilds.members.read
     &state=<state>
   ```
6. Retourne `{ url }` (le frontend effectue la redirection)

**Pourquoi retourner l'URL plutot que redirect direct ?** : evite les complications CORS entre
le frontend Vite (port 5173) et le backend (port 3001) en dev. Le frontend effectue
`window.location.href = url`.

---

### `GET /api/auth/discord/callback`

Gere le retour d'autorisation Discord.

**Parametres query** : `code`, `state`, optionnellement `error`.

**Etapes** :

```
1. Si error present → redirect frontend /login?error=discord_denied

2. Verifier state CSRF :
   state_recu !== req.session.oauthState → redirect /login?error=invalid_state
   Supprimer req.session.oauthState apres verification (usage unique)

3. Echanger code contre access_token (POST discord.com/oauth2/token) :
   body: { client_id, client_secret, grant_type: "authorization_code", code, redirect_uri }
   En-tete: Content-Type: application/x-www-form-urlencoded
   En cas d'echec → redirect /login?error=discord_token_exchange

4. GET discord.com/api/users/@me (Bearer access_token) :
   → { id, username, global_name, avatar }

5. GET discord.com/api/users/@me/guilds/{DISCORD_GUILD_ID}/member (Bearer access_token) :
   → { nick, roles: string[], ... }
   Si 404 (user pas dans le guild) → jeter access_token, redirect /login?error=not_in_guild

6. Jeter l'access_token (inutile apres cette etape, ne pas stocker)

7. Construire avatarUrl :
   Si avatar present : https://cdn.discordapp.com/avatars/{id}/{avatar}.png?size=256
   Sinon : https://cdn.discordapp.com/embed/avatars/{discriminator % 5}.png

8. Detecter le cas de figure :
   A. req.session.oauthAction === 'link' → flux Liaison (voir ci-dessous)
   B. Sinon → flux Login/Creation

9. Flux Login/Creation :
   user = User.findFirst({ discordId: id, deletedAt: null })

   Si user && deletedAt !== null → redirect /login?error=account_disabled

   Si user existe :
     Mettre a jour : discordUsername, avatarUrl
     Sync participations (voir section dedie)
     req.session.userId = user.id
     Redirect vers oauthReturnTo ?? /events

   Si user n'existe pas :
     Generer un username unique (voir section dedie)
     Creer User {
       discordId:       id,
       discordUsername: username (handle global Discord),
       avatarUrl,
       username:        <genere>,
       email:           null,
       passwordHash:    null,
       role:            USER,
     }
     Sync participations
     req.session.userId = user.id
     Redirect vers oauthReturnTo ?? /events

10. Supprimer req.session.oauthReturnTo et req.session.oauthAction apres usage
```

---

### `POST /api/auth/discord/link`

Non utilise directement — la liaison passe par `GET /api/auth/discord` avec session active,
puis par le callback qui detecte `oauthAction = 'link'`.

**Flux Liaison (dans le callback)** :

```
user_session = User.findFirst({ id: req.session.userId })
discord_user = User.findFirst({ discordId: discordId_discord })

Si discord_user existe et discord_user.id !== user_session.id :
  → redirect /profile?error=discord_already_linked
  (ce discordId est deja associe a un autre compte)

Si discord_user.id === user_session.id :
  → Rien a faire, deja lie, redirect /profile

Sinon (pas de collision) :
  User.update(user_session.id, { discordId, discordUsername, avatarUrl })
  Sync participations
  redirect /profile?success=discord_linked
```

---

### `DELETE /api/auth/discord/link`

Dissocie le compte Discord du compte local. Requiert `requireAuth`.

**Validation** : le User doit avoir `passwordHash !== null` (sinon il ne pourrait plus se connecter).
Si `passwordHash === null` → 400 "Cannot unlink Discord from a Discord-only account".

**Action** : `User.update({ discordId: null, discordUsername: null, avatarUrl: null })`.
Les EventParticipation liees a des discordRoleId sont conservees (l'admin devra les supprimer manuellement).

---

### `PATCH /api/events/:eventId` — champ ajoute

Accepte desormais `discordRoleId` (optionnel) dans le body.

**Validation Zod** :

- `discordRoleId` : `z.string().regex(/^\d{17,20}$/).nullable().optional()`
  (Discord Snowflake : 17 a 20 chiffres)

**Contrainte** : si `discordRoleId` est fourni et deja utilise par un autre event → 409
"Discord role already linked to another event".

---

## Sync des participations (logique centrale)

Fonction `syncDiscordParticipations(userId, memberRoles: string[])`.

Appelee a chaque login Discord reussi.

```
1. Recuperer tous les Events avec discordRoleId non null
2. Partager en deux groupes :
   - eventsGranted  : Event dont discordRoleId est dans memberRoles
   - eventsRevoked  : Event dont discordRoleId n'est PAS dans memberRoles

3. Pour eventsGranted :
   EventParticipation.upsert({ userId, eventId, status: "CONFIRMED" })
   (idempotent, pas d'erreur si deja present)

4. Pour eventsRevoked :
   participation = EventParticipation.findFirst({ userId, eventId })
   Si participation existe :
     // Supprimer les participations aux tables de cet event
     GameTableParticipant.deleteMany({
       userId,
       gameTable: { eventId }
     })
     EventParticipation.delete({ userId, eventId })
```

**Comportement si l'user n'est plus dans le guild** : `guilds.members.read` retourne 404.
Dans ce cas, on considere memberRoles = [] → tous les events Discord-gated sont revoques.

**Participations non-Discord preservees** : seules les participations liees a des events avec
`discordRoleId` sont affectees. Les participations d'events sans `discordRoleId` (invitations
classiques) ne sont jamais touchees par cette fonction.

---

## Gestion du role Admin

Si `DISCORD_ADMIN_ROLE_ID` est defini :

```
Si DISCORD_ADMIN_ROLE_ID est dans memberRoles → User.update({ role: 'ADMIN' })
Si DISCORD_ADMIN_ROLE_ID n'est PAS dans memberRoles ET user.role === 'ADMIN' :
  Ne PAS repasser a USER automatiquement.
```

**Pourquoi ne pas repasser automatiquement ?** L'admin peut avoir le role ADMIN sur son compte
local independamment de Discord. Repasser automatiquement casserait ce cas. La degradation du
role admin via Discord est reservee a la Phase 15b (bot).

Exception : si l'user est un compte purement Discord (pas de compte local), la degradation
automatique est acceptable mais hors scope de cette phase.

---

## Generation du username unique

Pour un nouveau compte Discord, le username est construit ainsi :

```
candidat = nick ?? global_name ?? username  (discord global handle)
candidat = candidat.slice(0, 30)            (limite du schema User)
candidat = candidat.replace(/[^a-zA-Z0-9_-]/g, '_')  (ASCII only, convention projet)

Si User.findFirst({ username: candidat }) existe :
  candidat = candidat.slice(0, 24) + '_' + discordId.slice(-5)
  (ex: "Tom_a8b3f")
  Si toujours collision (extremement rare) : candidat + '_' + crypto.randomBytes(3).hex()
```

---

## Coexistence comptes locaux / Discord

| Scenario                               | Comportement                                         |
| -------------------------------------- | ---------------------------------------------------- |
| Compte local, pas de Discord           | Inchange. Login email+password.                      |
| Compte Discord only                    | Login Discord uniquement. Pas de mot de passe local. |
| Compte hybride (local + Discord)       | Les deux methodes fonctionnent.                      |
| Tentative login local sur Discord-only | `passwordHash === null` → 401 "Invalid credentials"  |
| Compte soft-deleted, login Discord     | 401 "Account disabled"                               |

**Fallback admin** : l'admin doit toujours avoir `email + passwordHash`. Si Discord est
indisponible, il peut toujours se connecter. Recommandation documentee : ne pas supprimer
le mot de passe local du compte admin.

---

## Securite OAuth2

| Mecanisme               | Implementation                                                             |
| ----------------------- | -------------------------------------------------------------------------- |
| CSRF via `state`        | 16 bytes aleatoires, stockes en session, usage unique, verifie au callback |
| Echange serveur→serveur | `client_secret` jamais expose au browser, code echange cote backend        |
| `access_token` ephemere | Jete apres recuperation du profil, jamais stocke en DB ni en session       |
| Scope minimal           | `identify` + `guilds.members.read` uniquement                              |
| Session inchangee       | Cookie `connect.sid` httpOnly + secure + SameSite, duree 1h                |
| `returnTo` valide       | Accepte uniquement les chemins relatifs (`/...`), rejette URLs absolues    |

---

## Flux complet diagramme

```
Browser                  TomManager Backend              Discord API
  |                             |                             |
  |-- clic "Login Discord" ---->|                             |
  |  GET /api/auth/discord      |-- genere state ------------>|
  |<-- { url: discord_url } ----|                             |
  |                             |                             |
  |-- window.location = url ----------------------------------->|
  |<--- ecran consentement -----------------------------------|
  |    "TomManager : identify + guilds.members.read"         |
  |                             |                             |
  |-- clic "Autoriser" ---------------------------------------->|
  |<--- redirect /api/auth/discord/callback?code=X&state=Y --|
  |                             |                             |
  |  GET /api/auth/discord/callback                          |
  |                             |-- POST /oauth2/token ------>|
  |                             |   (code + client_secret)    |
  |                             |<-- { access_token } --------|
  |                             |-- GET /users/@me ----------->|
  |                             |<-- { id, username, avatar } |
  |                             |-- GET /guilds/GID/member -->|
  |                             |<-- { nick, roles[] } -------|
  |                             |-- Jeter access_token        |
  |                             |-- findOrCreate User         |
  |                             |-- syncParticipations        |
  |                             |-- session.userId = id       |
  |<-- redirect /events --------|                             |
```

---

## Frontend

### Bouton "Login avec Discord"

Affiche sur la page `/login` sous le formulaire local, separe par un divider "ou".
Appelle `GET /api/auth/discord` → recoit `{ url }` → `window.location.href = url`.

Masque si le backend repond 503 sur `/api/auth/discord` (mode degrade).

### Bouton "Lier mon compte Discord" / "Dissocier"

Page `/profile` :

- Si `user.discordId === null` : bouton "Lier mon compte Discord"
  → `GET /api/auth/discord?returnTo=/profile&action=link`
- Si `user.discordId !== null` : afficher le handle Discord + avatar + bouton "Dissocier"
  → `DELETE /api/auth/discord/link`
  → desactive si `passwordHash === null` (tooltip "Impossible : pas de mot de passe local")

### Champ `discordRoleId` sur Event (admin)

Formulaire de creation/edition d'event (admin uniquement) :

- Champ texte optionnel "ID Role Discord"
- Placeholder : "Ex: 1234567890123456789"
- Validation frontend : regex `^\d{17,20}$` ou vide
- Envoye dans `PATCH /api/events/:eventId` uniquement si modifie

### Avatar

`GET /api/auth/me` retourne desormais `avatarUrl`. L'avatar Discord s'affiche dans le header
et le profil. Fallback : initiales si `avatarUrl === null`.

### `GET /api/auth/me` — response etendue

```json
{
  "id": "uuid",
  "email": "tom@mail.com", // null pour comptes Discord-only
  "username": "Tom",
  "role": "USER",
  "discordId": "123456789", // null si non lie
  "discordUsername": "tomdu35", // null si non lie
  "avatarUrl": "https://cdn.discordapp.com/..." // null si absent
}
```

---

## Tests

### Tests unitaires (backend)

| Fichier                        | Cas                                                            |
| ------------------------------ | -------------------------------------------------------------- |
| `auth.discord.test.ts`         | generateState, validateState, buildAvatarUrl, generateUsername |
| `discordParticipation.test.ts` | syncDiscordParticipations : ajout, suppression, idempotence    |

Mocking : `vi.stubGlobal('fetch', ...)` pour mocker les appels Discord API.

### Tests integration (backend)

| Scenario                            | Assertion                                      |
| ----------------------------------- | ---------------------------------------------- |
| Callback valide → nouveau compte    | User cree, session, redirect /events           |
| Callback valide → compte existant   | User mis a jour, session creee                 |
| State invalide                      | redirect /login?error=invalid_state            |
| User pas dans le guild              | redirect /login?error=not_in_guild             |
| Compte soft-deleted                 | redirect /login?error=account_disabled         |
| Liaison avec discordId deja utilise | redirect /profile?error=discord_already_linked |
| Dissociation sans passwordHash      | 400                                            |
| Login local sur compte Discord-only | 401                                            |
| discordRoleId invalide sur Event    | 422                                            |
| discordRoleId deja pris             | 409                                            |

### Tests E2E (Playwright)

Hors scope CI (necessite un vrai compte Discord). Tests manuels documentes dans MANUAL_TESTING.md.

---

## Surface de complexite

| Composant                            | Complexite | Notes                                    |
| ------------------------------------ | ---------- | ---------------------------------------- |
| Migration DB (5 champs + 1 event)    | Faible     | Champs nullable, pas de donnees a migrer |
| Route GET /api/auth/discord          | Faible     | Generation URL + state                   |
| Route GET /api/auth/discord/callback | Moyenne    | 3 appels HTTP Discord, 3 cas de figure   |
| syncDiscordParticipations            | Faible     | Logique set-difference simple            |
| DELETE /api/auth/discord/link        | Faible     | Validation + update                      |
| PATCH Event discordRoleId            | Faible     | Zod + contrainte unique                  |
| Frontend bouton login                | Faible     | Un appel GET + redirect                  |
| Frontend page profil liaison         | Faible     | Affichage conditionnel + 2 boutons       |
| Frontend champ discordRoleId         | Faible     | Champ texte avec validation regex        |

**Total : 1 sprint.** Le vrai travail est le callback OAuth (echange de code, appels Discord,
sync participations). Tout le reste est trivial.

---

## Variables a ajouter

Fichiers a mettre a jour :

- `backend/src/config/env.ts` : 4 nouvelles variables (5 avec DISCORD_ADMIN_ROLE_ID optionnel)
- `.env` (local dev)
- `.env.example`
- `docker-compose.yml` (dev + test + prod)
- `docs/MANUAL_TESTING.md` : scenarios Discord
- GitHub Secrets : DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI (prod)

---

## Roadmap detaillee

Voir `docs/features/discord-bot/ROADMAP.md`.
