# Spec - Polish audit (juillet 2026)

Audit complet de l'application realise le 2026-07-16 sur la branche `Developement`.
Ce document detaille chaque point restant : probleme, fichiers concernes, solution
proposee, criteres de validation et recommandation modele/effort.

Deja traites (merges le 2026-07-16) :

- Nettoyage config themes (references `coffee`/`winter` obsoletes, theme sombre `ToM`
  par defaut, `theme-color` et manifest alignes sur `#232323`)
- Correction CLAUDE.md : duree de session (10 jours rolling, pas 1h)

---

## P1 - Impact fort

### 1. Remplacer les `confirm()` natifs par un ConfirmModal

**Probleme.** 9 usages de `window.confirm()` : dialogue navigateur non themable,
moche en PWA standalone, affiche l'origine ("localhost:3000 indique..."), UX
incoherente avec le reste de l'app.

**Fichiers concernes.**

- `frontend/src/pages/EventDetailPage.tsx:64` (suppression event)
- `frontend/src/components/planning/TableDetailModal.tsx:156,269,282` (quitter, retirer joueur, supprimer table)
- `frontend/src/components/planning/EditTableModal.tsx:187`
- `frontend/src/components/events/EditEventModal.tsx:60` (purge)
- `frontend/src/components/events/ParticipantList.tsx:39` (retirer participant)
- `frontend/src/pages/ProfilePage.tsx:76,112` (master toggle, delier Discord)

**Solution proposee.**

1. Creer `frontend/src/components/common/ConfirmModal.tsx` base sur `ResponsiveModal`
   (sheet sur mobile, modal DaisyUI sur desktop) : props `open`, `title`, `message`,
   `confirmLabel` (defaut "Confirmer"), `cancelLabel` (defaut "Annuler"),
   `variant: "danger" | "warning" | "neutral"` (bouton `btn-error` / `btn-warning` / `btn-primary`),
   `onConfirm`, `onClose`.
2. Les call sites actuels sont imperatifs (`if (!confirm(...)) return;`). Pour un
   remplacement 1:1 sans restructurer chaque handler, ajouter un hook
   `useConfirm()` adosse a un provider (monte dans `App.tsx`) qui expose
   `const ok = await confirmDialog({ title, message, variant })`. Le provider rend
   un seul `ConfirmModal` et resout la promesse au clic.
3. Remplacer les 9 occurrences. Textes : reprendre les libelles existants
   (accents corrects, deja le cas).

**Validation.**

- `grep -rn "confirm(" frontend/src --include="*.tsx"` ne retourne plus que le hook.
- Test composant : ouverture, confirm resout `true`, cancel/backdrop/Echap resout `false`.
- Verification manuelle mobile (sheet + swipe-down = annuler) et desktop.

**Reco : Sonnet 5 | 1-2h**

---

### 2. Erreurs backend affichees en anglais brut

**Probleme.** Le front affiche `err.response.data.error.message` directement dans
les toasts. Les services backend renvoient des messages techniques en anglais
("Table not found", "maxPlayers must be an integer between 1 and 20",
"endDateTime must be after startDateTime"). Un utilisateur peut les voir (table
pleine, conflit d'horaire, bornes d'event...).

**Fichiers concernes.**

- Backend : `services/gameTable.ts`, `services/event.ts`, `services/boardGame.ts`,
  `services/participant.ts`, `services/discordAuth.ts`, `middleware/errorHandler.ts`
- Frontend : tous les call sites qui extraient `err.response.data.error.message`
  (~10 occurrences : TableDetailModal, CreateTableModal, EditTableModal,
  CreateEventModal, EditEventModal, ProfilePage, ParticipantList...)

**Solution recommandee : codes d'erreur + mapping cote front.**

1. Backend : ajouter un champ `code` stable aux erreurs metier atteignables via
   l'UI : `createError(409, "Table is full", { code: "TABLE_FULL" })`.
   Recenser d'abord les erreurs declenchables par un utilisateur (liste a etablir
   en debut de tache : table pleine, deja inscrit, hors bornes event, fin avant
   debut, jeu introuvable, droits insuffisants, discord deja lie...).
2. `errorHandler.ts` : exposer `error.code` dans la reponse JSON (a cote de
   `message`, qui reste en anglais pour les logs/tests).
3. Frontend : creer `config/apiErrors.ts` avec le mapping
   `code -> message francais accentue` et un helper
   `getErrorMessage(err, fallback): string` qui : lit `error.code`, mappe vers le
   francais, sinon retourne le `fallback` fourni par le call site. **Ne jamais
   afficher le message anglais brut.**
4. Remplacer les extractions manuelles
   `(err as { response?... })?.response?.data?.error?.message || "..."` par
   `getErrorMessage(err, "...")` partout.

**Alternative rejetee** : traduire les messages backend en francais. Casse les
tests d'integration qui assertent les messages, melange logs et UI, et empeche
une future i18n.

**Validation.**

- Tests integration backend : les erreurs metier portent le bon `code`.
- Test unitaire front sur `getErrorMessage` (code connu, code inconnu, pas de reponse).
- Parcours manuel : rejoindre une table pleine, creer une table hors bornes,
  delier Discord sans email -> toasts en francais.

**Reco : Sonnet 5 | 2-3h**

---

### 3. Notifications sans accents

**Probleme.** Les titres et messages de notifications generes par le backend sont
en ASCII : "Expulse d'une table", "La table X a ete modifiee", "Tu es confirme".
C'est du texte visible utilisateur, affiche tel quel dans la cloche - incoherent
avec le reste de l'UI accentuee.

**Fichiers concernes.**

- `backend/src/services/gameTable.ts` (titres + messages, ~12 chaines)
- `backend/src/services/event.ts`, `participant.ts` (verifier les autres
  `createNotification`/bulk : EVENT_UPDATED, EVENT_DELETED, PARTICIPANT_REMOVED)
- Tests backend qui assertent ces chaines (`notification.test.ts`, `gameTable.test.ts`...)

**Solution proposee.**

1. Accentuer toutes les chaines `title`/`message` passees au service notification.
2. Mettre a jour les tests qui assertent ces chaines.
3. Mettre a jour la convention dans `CLAUDE.md` : le texte visible par
   l'utilisateur porte les accents francais **meme s'il est genere cote backend**
   (notifications, et tout futur texte destine a l'affichage).
4. Historique en base : ne pas migrer les notifications existantes (volume faible,
   duree de vie courte). A confirmer avec le proprietaire du produit.

**Validation.** Tests backend verts ; declencher une notification (modifier une
table avec un joueur inscrit) et verifier l'affichage accentue dans la cloche.

**Reco : Haiku 4.5 | 30min-1h**

---

### 4. Anti double-soumission

**Probleme.** `CreateTableModal` et `EditTableModal` n'ont ni
`disabled={isSubmitting}` ni spinner sur le bouton submit (contrairement a
`CreateEventModal` qui fait reference). `AddBoardGameModal` idem. Les boutons
d'action de `TableDetailModal` (Rejoindre, Quitter, Promouvoir, Retrograder,
Retirer, Supprimer) n'ont aucun etat pending. Un double-clic peut creer deux
tables identiques ou envoyer deux requetes concurrentes.

**Fichiers concernes.**

- `frontend/src/components/planning/CreateTableModal.tsx`
- `frontend/src/components/planning/EditTableModal.tsx`
- `frontend/src/components/boardgames/AddBoardGameModal.tsx`
- `frontend/src/components/planning/TableDetailModal.tsx`

**Solution proposee.**

1. Formulaires react-hook-form : recuperer `formState.isSubmitting` et copier le
   pattern de `CreateEventModal.tsx:140-143` (bouton `disabled` + `loading-spinner`).
2. `TableDetailModal` : un state unique `actionPending: boolean`, positionne au
   debut de chaque handler async (join/leave/promote/demote/kick/delete) et
   remis a false en `finally`. Tous les boutons d'action recoivent
   `disabled={actionPending}` ; le bouton clique affiche le spinner.

**Validation.** Test composant : double-clic rapide sur "Creer" ne declenche
qu'un seul POST (mock). Verification manuelle avec le network throttling.

**Reco : Haiku 4.5 | 30min-1h**

---

## P2 - Impact moyen

### 5. Onglet actif dans l'URL (EventDetailPage)

**Probleme.** `tab` est un state local (`EventDetailPage.tsx:38`) : un refresh
ramene sur "Infos", impossible de partager un lien vers le planning ou les jeux.
Consequence visible : l'onglet "Jeux de societe" de la `BottomTabBar` pointe vers
`/events/:id`, qui ouvre... l'onglet Infos.

**Solution proposee.**

1. Remplacer le state par `useSearchParams` : `?tab=info|planning|games|participants`
   (defaut `info`, valeur inconnue -> `info`).
2. Changement d'onglet -> `setSearchParams({ tab }, { replace: true })`.
   `replace` plutot que push : le bouton retour ramene a la liste des events, pas
   a chaque onglet visite (comportement attendu sur mobile).
3. `BottomTabBar.tsx` : pointer "Jeux de societe" vers `/events/:id?tab=games` et
   adapter le calcul d'actif (`isActive` de NavLink ignore les search params :
   comparer `location.search` en plus du pathname).

**Validation.** Refresh sur chaque onglet conserve l'onglet ; lien partage ouvre
le bon onglet ; tab bar mobile "Jeux de societe" ouvre bien l'onglet jeux.

**Reco : Sonnet 5 | 1h**

---

### 6. Deep-link notification vers la table

**Probleme.** `NotificationItem.tsx:57-59` navigue vers
`/events/:id/planning` mais ignore `metadata.tableId` (present dans toutes les
notifications de table cote backend, verifie dans `gameTable.ts`). "Tu es
confirme pour la table X" devrait ouvrir la modale de la table X.

**Solution proposee.**

1. `NotificationItem` : si `metadata.tableId`, naviguer vers
   `/events/:eventId/planning?table=<tableId>`.
2. `PlanningPage`/`PlanningTab` : au montage, lire le param `table` ->
   `setSelectedTableId(tableId)` (ouvre `TableDetailModal`). A la fermeture de la
   modale, retirer le param (`setSearchParams`, replace).
3. Cas limite : table supprimee entre-temps -> `fetchTable` echoue deja avec un
   toast et ferme la modale (comportement existant, suffisant).

**Validation.** Cliquer une notification de promotion ouvre la modale de la bonne
table ; fermer la modale nettoie l'URL ; notification vers une table supprimee
affiche le toast d'echec sans crash.

**Reco : Sonnet 5 | 1-2h**

---

### 7. Modale desktop : fermeture Echap + focus trap

**Probleme.** `ResponsiveModal` (branche desktop, `ResponsiveModal.tsx:30-47`)
n'ecoute pas la touche Echap et ne piege pas le focus. `MobileSheet` fait les
deux (Escape, trap Tab, restore focus) - la logique existe deja mais n'est pas
partagee.

**Solution proposee.**

1. Extraire de `MobileSheet.tsx` un hook `useModalA11y(containerRef, open, onClose)`
   regroupant : listener Escape, focus trap Tab/Shift+Tab, auto-focus du premier
   element, restauration du focus a la fermeture.
2. L'utiliser dans `MobileSheet` (aucun changement de comportement) et dans la
   branche desktop de `ResponsiveModal`.

**Validation.** Tests existants de MobileSheet verts ; test ajoute : Echap ferme
la modale desktop, Tab boucle a l'interieur.

**Reco : Haiku 4.5 | 30min**

---

### 8. Garde "modifications non enregistrees" sur les formulaires

**Probleme.** Un clic backdrop, un swipe-down ou Echap ferme `CreateTableModal`
(gros formulaire : pitch, triggers, tags, jeu...) en perdant tout, sans
confirmation. Frustrant sur mobile ou le swipe accidentel est facile.

**Depend du point 1 (ConfirmModal).**

**Solution proposee.**

1. Dans `CreateTableModal`, `EditTableModal`, `CreateEventModal`, `EditEventModal` :
   intercepter `onClose`. Si `formState.isDirty` (ou tags/jeu selectionne modifies
   pour les tables), demander confirmation via `useConfirm` ("Abandonner les
   modifications ?"), sinon fermer directement.
2. Le submit reussi ferme sans garde (le `reset()` remet `isDirty` a false avant
   `onClose`).

**Validation.** Fermer un formulaire vierge = direct ; fermer apres saisie =
confirmation ; confirmer abandonne et reset ; annuler garde la saisie.

**Reco : Sonnet 5 | 1h**

---

### 9. Scroll to top a la navigation

**Probleme.** Aucun `scrollTo`/`ScrollRestoration` : arriver sur une page apres
avoir scrolle la precedente laisse la vue au milieu.

**Solution proposee.** Composant `ScrollToTop` (dans `components/common/`) :
`useLocation()` + `useEffect` -> `window.scrollTo(0, 0)` quand **pathname** change
(pas les search params, sinon le point 5 ferait scroller a chaque changement
d'onglet). Monte dans `App.tsx` sous le router.

**Reco : Haiku 4.5 | 15min**

---

## P3 - Finitions

### 10. `lang="fr"` sur `<html>`

`frontend/index.html:2` : `lang="en"` alors que l'app est 100% francaise
(lecteurs d'ecran, correcteurs, traduction auto). Passer a `lang="fr"`.
**Reco : Haiku 4.5 | 5min**

### 11. Onglet Profil jamais actif dans la BottomTabBar

`BottomTabBar.tsx:78-84` : c'est un `button` + `navigate()`, pas un `NavLink` -
il ne passe jamais en `text-primary` sur `/profile`. Le convertir en `NavLink`
comme les autres onglets.
**Reco : Haiku 4.5 | 10min**

### 12. `document.title` par page

Toujours "TomManager", genant avec plusieurs onglets navigateur. Creer un hook
`usePageTitle(title?: string)` qui pose `title ? `${title} - TomManager` :
"TomManager"` et restaure au demontage. A poser dans chaque page ;
`EventDetailPage` passe le nom de l'event une fois charge.
**Reco : Haiku 4.5 | 30min**

### 13. 401 : conserver la page de retour

`config/api.ts:30` : `window.location.href = "/login"` perd la page courante.
Rediriger vers `/login?from=<pathname>` et lire ce param dans `LoginPage` (en
plus du `location.state.from` existant). Rare depuis la confirmation session
10 jours, mais trivial.
**Reco : Haiku 4.5 | 30min**

### 14. Unifier la redirection post-login

`HomePage` utilise `/api/events?mine=true` pour le raccourci "un seul event ->
detail", `LoginPage` utilise `/api/events` (tous). Extraire un helper commun
(`redirectAfterLogin` dans un util partage) base sur `?mine=true` (comportement
le plus pertinent).
**Reco : Haiku 4.5 | 15min**

### 15. Sentry frontend

Le backend a Sentry, pas le front : les erreurs prod du front (dont celles
attrapees par l'ErrorBoundary) sont invisibles. Ajouter `@sentry/react`, init
dans `main.tsx` conditionnee a `import.meta.env.VITE_SENTRY_DSN` (prod
uniquement), brancher l'ErrorBoundary existant (`Sentry.captureException` dans
`componentDidCatch`). Necessite : creer le projet Sentry front et injecter le
DSN au build (CI + docker-compose prod).
**Reco : Haiku 4.5 | 30min-1h (+ config infra)**

---

## Hors scope de cet audit

Deja liste dans `docs/NEXT_STEPS.md` : export PDF v2, remplacement de
FullCalendar, PWA avancee (service worker, push), historique des actions.
