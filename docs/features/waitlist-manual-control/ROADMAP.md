# Roadmap : Gestion manuelle de la waitlist (GM)

**Modele : Sonnet 4.6 | Effort estime : 2-3h**

Spec complete : `SPEC_WAITLIST_MANUAL_CONTROL.md`

**STATUT : COMPLETE**

---

## Etape 1 — Service backend

**Fichier** : `backend/src/services/gameTable.ts`

- [x] Ajouter `setParticipantStatus(tableId, targetUserId, newStatus)`
- [x] WAITLIST -> CONFIRMED : verifier `confirmedCount < maxPlayers`, sinon throw 409
- [x] CONFIRMED -> WAITLIST : pas de promotion automatique du suivant
- [x] Transaction Prisma pour la mise a jour
- [x] Notification `WAITLIST_PROMOTED` ou `WAITLIST_DEMOTED` selon le sens
- [x] Emit socket `table:player:promoted` ou `table:player:demoted`

---

## Etape 2 — Controller + route

**Fichiers** : `backend/src/controllers/gameTable.ts`, `backend/src/routes/gameTable.ts`

- [x] Handler `setStatus` dans le controller
- [x] Schema Zod : `{ status: z.enum(['CONFIRMED', 'WAITLIST']) }`
- [x] Route `PATCH /:eventId/tables/:tableId/participants/:userId/status`
  - `requireAuth`
  - `validateUUID('eventId', 'tableId', 'userId')`
  - `requireTableGMOrAdmin`
  - `validateBody(setStatusSchema)`

---

## Etape 3 — Tests backend

**Fichier** : `backend/src/__tests__/integration/gameTable.test.ts`

- [x] Promote reussi (place disponible)
- [x] Promote refuse — 409 table pleine
- [x] Promote refuse — 403 non GM/admin
- [x] Promote refuse — 404 participant inexistant
- [x] Demote reussi
- [x] Demote : aucune promotion automatique du suivant en waitlist
- [x] `npm run test:backend` — tous verts (178/178)

---

## Etape 4 — Frontend : boutons dans `TableDetailModal`

**Fichier** : `frontend/src/components/planning/TableDetailModal.tsx`

- [x] Ajouter `handlePromote(userId)` et `handleDemote(userId)`
- [x] Desktop : colonne actions — bouton "Promouvoir" (vert) pour WAITLIST, "Retrograder" (orange) pour CONFIRMED
- [x] Mobile : meme logique, layout vertical, min-height 44px
- [x] Bouton "Promouvoir" desactive + tooltip si `confirmedCount >= maxPlayers`
- [x] Boutons visibles uniquement si `canEdit`
- [x] `fetchTable()` apres chaque action

---

## Etape 5 — Tests E2E

Non implementes (hors perimetre de cette session).

---

## Etape 6 — Verification qualite complete

- [x] `npm run test:backend` — 178 tests verts
- [x] `npm run test:frontend` — 162 tests verts

---

## Etape 7 — Mise a jour docs

- [x] `API_MAP.md` : ajouter `PATCH .../participants/:userId/status`
- [x] `TESTS.md` : documenter les nouveaux cas
- [x] `NEXT_STEPS.md` : marquer la feature comme complete
