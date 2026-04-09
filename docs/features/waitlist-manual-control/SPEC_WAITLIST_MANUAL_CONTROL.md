# Spec : Gestion manuelle de la waitlist par le GM

## Contexte

Actuellement, la promotion de la waitlist vers CONFIRMED est entierement automatique :
quand un joueur quitte ou est exclu, le premier en waitlist est promu.

Le GM n'a aucun levier pour reorganiser sa table finement. Or, la composition
d'un groupe de jeu est souvent une decision humaine (compatibilite des joueurs,
equilibre d'experience, etc.).

**Exemple concret** : une table a 3 places, CONFIRMED : 1, 2, 3 — WAITLIST : 4, 5, 6.
Le GM souhaite composer le groupe 1, 3, 6 et proposer une seconde table avec 2, 4, 5.
Il doit pouvoir retrograder 2 puis promouvoir 6 — sans que le systeme interfere.

---

## Perimetre

- Le GM (createur de la table) et les admins peuvent promouvoir ou retrograder
  manuellement n'importe quel participant.
- La promotion est bloquee si `confirmedCount >= maxPlayers` (table pleine).
- La retroградation ne declenche **pas** de promotion automatique du suivant en
  waitlist — c'est une action deliberee du GM, qui garde la main.
- Le joueur concerne est notifie dans les deux cas.

---

## Comportement attendu

### Promote (WAITLIST -> CONFIRMED)

- Disponible uniquement si `confirmedCount < maxPlayers`
- Si table pleine : bouton desactive avec tooltip "Table pleine — retrogradez un joueur d'abord"
- Notifie le joueur promu (`WAITLIST_PROMOTED`)
- Emet l'evenement socket `table:player:promoted`

### Demote (CONFIRMED -> WAITLIST)

- Toujours disponible pour le GM
- **Pas de promotion automatique** du suivant en waitlist (contrairement au kick/leave)
- Notifie le joueur retro grade (`WAITLIST_DEMOTED`)
- Emet l'evenement socket `table:player:demoted`

---

## Backend

### Nouvel endpoint

```
PATCH /api/events/:eventId/tables/:tableId/participants/:userId/status
```

| Champ | Detail                                  |
| ----- | --------------------------------------- |
| Auth  | `requireAuth` + `requireTableGMOrAdmin` |
| Body  | `{ status: 'CONFIRMED' \| 'WAITLIST' }` |
| 200   | `{ data: { userId, status } }`          |
| 409   | Table pleine (promote impossible)       |
| 404   | Participant introuvable                 |

Validation Zod : `status` enum `['CONFIRMED', 'WAITLIST']`.

### Nouvelle fonction service

```typescript
setParticipantStatus(tableId: string, targetUserId: string, newStatus: 'CONFIRMED' | 'WAITLIST')
```

Logique :

```
Si WAITLIST -> CONFIRMED :
  Verifier confirmedCount < maxPlayers, sinon 409
  Mettre a jour le statut
  Notifier le joueur (WAITLIST_PROMOTED)
  Emettre table:player:promoted

Si CONFIRMED -> WAITLIST :
  Mettre a jour le statut (PAS de promotion automatique du suivant)
  Notifier le joueur (WAITLIST_DEMOTED)
  Emettre table:player:demoted
```

Les deux operations se font dans une transaction Prisma.

### Fichiers backend touches

| Fichier                                               | Changement               |
| ----------------------------------------------------- | ------------------------ |
| `backend/src/services/gameTable.ts`                   | + `setParticipantStatus` |
| `backend/src/controllers/gameTable.ts`                | + handler `setStatus`    |
| `backend/src/routes/gameTable.ts`                     | + route PATCH            |
| `backend/src/__tests__/integration/gameTable.test.ts` | + cas promote/demote     |

---

## Frontend

### Composant : `TableDetailModal.tsx`

Dans la liste des participants (mobile et desktop), ajouter des boutons
promote/demote visibles uniquement pour `canEdit` (GM ou admin) :

| Statut joueur | Bouton promote      | Bouton demote          | Bouton retirer |
| ------------- | ------------------- | ---------------------- | -------------- |
| CONFIRMED     | Non affiche         | "Retrograder" (orange) | Toujours dispo |
| WAITLIST      | "Promouvoir" (vert) | Non affiche            | Toujours dispo |

Le bouton "Promouvoir" est desactive (+ tooltip) si `confirmedCount >= maxPlayers`.

### UX mobile

Meme logique, layout vertical. Taille minimale des boutons : 44px (touch target).

### Fichiers frontend touches

| Fichier                                                 | Changement               |
| ------------------------------------------------------- | ------------------------ |
| `frontend/src/components/planning/TableDetailModal.tsx` | + boutons promote/demote |

---

## Notifications

Reutilise les types existants :

| Type                | Declencheur    | Message                                         |
| ------------------- | -------------- | ----------------------------------------------- |
| `WAITLIST_PROMOTED` | Promote manuel | "Tu es confirme pour la table '...'"            |
| `WAITLIST_DEMOTED`  | Demote manuel  | "Tu as ete place en liste d'attente pour '...'" |

---

## Tests

**Tous les indicateurs de qualite doivent etre au vert avant merge :**

- Tests backend (vitest integration)
- Tests frontend (vitest + RTL)
- Lint (eslint) sans erreur ni warning
- Prettier : aucun fichier mal formate
- Tests E2E Playwright

### Tests backend — `gameTable.test.ts`

- Promote reussi : WAITLIST -> CONFIRMED quand place disponible
- Promote refuse : 409 si `confirmedCount >= maxPlayers`
- Promote refuse : 403 si non GM/admin
- Promote refuse : 404 si participant inexistant
- Demote reussi : CONFIRMED -> WAITLIST
- Demote : **le suivant en waitlist n'est pas promu automatiquement**
- Demote refuse : 403 si non GM/admin
- Notifications envoyees dans les deux cas

### Tests E2E — `e2e/planning.spec.ts` ou nouveau `e2e/waitlist.spec.ts`

- GM voit les boutons promote/demote, un joueur lambda non
- Promote d'un joueur en waitlist quand place disponible -> statut passe a CONFIRMED
- Bouton promote desactive quand table pleine
- Demote d'un joueur confirme -> statut passe a WAITLIST, le suivant en waitlist reste WAITLIST

---

## Definition of done

- [ ] `PATCH .../participants/:userId/status` implemente et teste
- [ ] Promote bloque si table pleine (409 backend, bouton desactive frontend)
- [ ] Demote ne declenche pas de promotion automatique
- [ ] Joueur notifie dans les deux cas
- [ ] Socket `table:player:promoted` / `table:player:demoted` emis
- [ ] Boutons promote/demote visibles uniquement pour GM/admin
- [ ] UX mobile correcte (touch targets >= 44px)
- [ ] Tests backend : tous les cas couverts, tous verts
- [ ] Tests frontend : composant TableDetailModal couvert
- [ ] Lint : 0 erreur, 0 warning
- [ ] Prettier : aucune difference detectee
- [ ] E2E : scenarios promote et demote passent
- [ ] `API_MAP.md` mis a jour
- [ ] `TESTS.md` mis a jour
