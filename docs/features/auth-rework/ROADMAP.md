# Roadmap : Auth Rework

> Chaque session est autonome et deployable. Cocher au fur et a mesure.

---

## Session 1 : Migration Prisma + Modeles

- [x] Ajouter enum `InvitationStatus` (PENDING, ACCEPTED, EXPIRED)
- [x] Ajouter model `Event` avec relations
- [x] Ajouter model `EventInvitation` avec contraintes (unique email+eventId, unique token)
- [x] Ajouter model `EventParticipation` avec contrainte unique (eventId+userId)
- [x] Ajouter relations sur `User` (createdEvents, sentInvitations, eventParticipations)
- [x] Generer et appliquer la migration
- [x] Mettre a jour `.claude/context/DB_MODELS.md`

---

## Session 2 : Middleware requireAdmin + Service Event (creation minimale)

- [x] Ajouter middleware `requireAdmin` dans `middleware/auth.ts`
- [x] Creer `services/event.ts` — fonction `createEvent(name, startDateTime, endDateTime, userId)`
- [x] Creer `controllers/event.ts` — handler POST
- [x] Creer `routes/event.ts` — route `POST /api/events`
- [x] Brancher dans `routes/index.ts`
- [x] Tests integration : creation event (admin only, validation champs, participation auto)
- [x] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 3 : Service Invitation (creation + validation token)

- [ ] Creer `services/invitation.ts` :
  - `createInvitation(eventId, email, invitedBy)` — genere token, gere resend EXPIRED
  - `validateToken(token)` — retourne info invitation + hasAccount
- [ ] Creer `controllers/invitation.ts` — handlers POST create + GET validate
- [ ] Creer `routes/invitation.ts` :
  - `POST /api/events/:eventId/invitations` (requireAuth + requireAdmin)
  - `GET /api/invitations/:token` (public)
- [ ] Brancher dans `routes/index.ts`
- [ ] Tests integration :
  - Creation invitation (happy path, PENDING existant -> 409, EXPIRED -> resend)
  - Validation token (valide, expire, utilise, introuvable)
- [ ] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 4 : Auth Rework (signup + login avec token)

- [ ] Ajouter `acceptInvitation(token, userId)` dans `services/invitation.ts`
- [ ] Modifier `services/auth.ts` :
  - `signup()` : exiger invitationToken, valider token, verifier email match, creer user, accepter invitation, creer participation
  - `login()` : accepter `identifier` (email ou username), `invitationToken` optionnel
- [ ] Adapter `controllers/auth.ts` (nouveaux champs body, eventId en reponse)
- [ ] Tests integration :
  - Signup avec token (happy path)
  - Signup sans token -> 400
  - Signup token invalide / email mismatch
  - Login avec token (happy path, deja participant -> idempotent)
  - Login par username
- [ ] Mettre a jour tests existants dans `auth.test.ts` (adapter au nouveau flow)
- [ ] Mettre a jour `.claude/context/API_MAP.md`

---

## Session 5 : Frontend — AuthContext + LoginPage rework

- [ ] Creer `contexts/AuthContext.tsx` — AuthProvider, useAuth hook
- [ ] Wrapper l'app avec AuthProvider dans `App.tsx`
- [ ] Modifier `LoginPage.tsx` :
  - `identifier` au lieu de `email`
  - Support `?token=` query param
  - Affichage info invitation si token present
  - Redirection post-login (vers event si token, vers / sinon)
- [ ] Mettre a jour `.claude/context/FILE_MAP.md`

---

## Session 6 : Frontend — InvitationLandingPage + SignupPage

- [ ] Creer `pages/InvitationLandingPage.tsx` :
  - Appel GET /api/invitations/:token
  - Redirection vers login ou signup selon hasAccount
  - Affichage erreurs (expire, utilise, introuvable)
- [ ] Creer `pages/SignupPage.tsx` :
  - Email pre-rempli (readonly) depuis query param
  - Champs : username, password, confirm password
  - Appel signup avec token
  - Redirection vers event
- [ ] Ajouter routes dans `AppRoutes.tsx` (`/invite/:token`, `/signup`)
- [ ] Tests frontend :
  - InvitationLandingPage rendu + redirection
  - SignupPage validation formulaire
- [ ] Mettre a jour `.claude/context/FILE_MAP.md`

---

## Session 7 : Polish + mise a jour docs

- [ ] Verifier tous les tests passent (backend + frontend)
- [ ] Verifier les edge cases (cf. spec section 4)
- [ ] Mettre a jour `.claude/context/PROGRESS.md` (phase 1 terminee)
- [ ] Mettre a jour `.claude/context/TESTS.md` (inventaire tests)
- [ ] Mettre a jour `.claude/context/FILE_MAP.md` (final)
