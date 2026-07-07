# Spec : Polish feedback utilisateur (toasts, chargement, vide, socket, erreurs)

## Origine

Issu d'un audit UX large de l'app (mobile-first), mene en 3 volets : formulaires/
modales, navigation/mobile/responsive, feedback (chargement/vide/erreurs/socket).
Les volets formulaires et mobile ont ete traites immediatement (voir
`docs/features/reserved-seats/ROADMAP.md` et l'historique git de la branche
`feature/reserved-seats-ux` pour le detail des fixes mobiles/formulaires).

Ce document couvre le troisieme volet, delibérement laisse en backlog : il
touche des fichiers deja modifies par les deux autres chantiers, et melanger
les trois aurait cree une PR trop large a relire et un risque de conflits
internes. C'est du polish (rien de casse pour l'utilisateur aujourd'hui), pas
des bugs bloquants — d'ou la priorite plus basse.

## Objectif

Rendre le retour donne a l'utilisateur (succes, erreur, chargement, absence de
donnees, perte de connexion) coherent et jamais silencieux, partout dans l'app.

## Perimetre

### 1. Convention de wording pour les toasts

**Constat** : 3 idiomes francais coexistent pour les erreurs sans regle de choix :
- "Echec de..." (ex. `PlanningTab.tsx` — "Echec du chargement des tables")
- "Erreur lors de..." (ex. `TableDetailModal.tsx` — "Erreur lors du passage en liste d'attente")
- "Impossible de..." (ex. `BoardGameSelector.tsx` — "Impossible d'ajouter ce jeu BGG")

La ponctuation des succes est egalement incoherente : certains se terminent par
`!` (creation : "Table creee !", "Jeu ajoute !", "Evenement cree !"), d'autres non
(suppression/retrait : "Jeu retire", "Table supprimee", "Participant retire").

**A faire** : choisir une convention unique (recommandation : "Echec de..." pour
toutes les erreurs generiques ; `!` reserve aux actions de creation, jamais aux
suppressions/retraits) et relire tous les `toast.success`/`toast.error` de l'app
pour s'y conformer.

### 2. Etats de chargement manquants

- `frontend/src/pages/ProfilePage.tsx` : aucun state `loading` — l'ecran est vide
  jusqu'a la resolution du fetch (flash / saut de layout).
- `frontend/src/pages/EventDetailPage.tsx` : spinner plein-page uniquement
  (`loading loading-spinner loading-lg`), alors que d'autres pages listes
  utilisent un `Skeleton` (`frontend/src/components/common/Skeleton.tsx`) —
  incoherence visuelle entre pages.
- Recherche debouncee (`frontend/src/components/planning/TagInput.tsx`, et la
  recherche de tags dans `TableDetailModal`) : aucun indicateur pendant l'attente
  de la reponse, le dropdown reste simplement vide jusqu'au resultat.

**A faire** : ajouter un `loading` state a `ProfilePage`, remplacer le spinner de
`EventDetailPage` par un `Skeleton` coherent avec le reste de l'app, ajouter un
petit indicateur (spinner inline ou skeleton de ligne) dans les dropdowns de
recherche pendant le debounce.

### 3. Empty states manquants

`frontend/src/components/common/EmptyState.tsx` existe et est deja utilise dans
5 endroits (`TableDetailModal`, `TimelineView`, `BoardGameList`, `EventListPage`,
`ParticipantList`) mais pas ici :
- `frontend/src/components/admin/AdminBoardGamePanel.tsx` : une recherche sans
  resultat n'affiche rien (juste le compteur "0 jeu au total" au-dessus) — la
  sous-liste de fusion, elle, affiche bien "Aucun resultat" (ligne ~552), a
  reprendre comme modele pour la liste principale.
- `frontend/src/components/planning/TagInput.tsx` /
  `frontend/src/components/boardgames/BoardGameSearchInput.tsx` : un resultat de
  recherche vide n'ouvre simplement pas de dropdown, indistinguable d'une
  recherche pas encore lancee.

**A faire** : reutiliser `EmptyState` (ou une version compacte inline pour les
dropdowns) partout ou une liste/recherche peut legitimement etre vide.

### 4. UX de perte de connexion socket

**Constat** : `frontend/src/components/common/ConnectionStatus.tsx` n'affiche
qu'un point colore discret (`badge-xs`) dans le header, avec juste un `title`
("Connecte"/"Deconnecte") — facile a manquer. Les vues qui dependent du temps
reel (`PlanningTab.tsx`, `TableDetailModal.tsx`, `useNotifications.ts`) comptent
entierement sur les evenements socket (`useEventSocket.ts`) pour se rafraichir :
si le socket tombe, rien n'avertit explicitement l'utilisateur que la liste de
participants/places affichee peut etre perimee, et rien ne force un refetch a
la reconnexion.

C'est particulierement sensible pour une app mobile-first : les reseaux mobiles
coupent plus souvent qu'une connexion filaire.

**A faire** : ajouter un signal plus visible (toast ou bandeau, pas juste un
point de couleur) au disconnect/reconnect, et declencher un refetch des donnees
actives (table courante, liste de notifications) a la reconnexion plutot que de
compter sur le prochain evenement socket qui pourrait ne jamais arriver si rien
n'a change pendant la coupure.

### 5. Erreurs silencieuses

Des `catch` avalent l'erreur sans aucun retour utilisateur :
- `frontend/src/pages/EventListPage.tsx` (fetch liste d'evenements) — un fetch
  qui echoue rend une liste vide, indistinguable d'une liste reellement vide.
- `frontend/src/hooks/useNotifications.ts` — tous les catch (fetch, markAsRead,
  delete, markAllAsRead) sont silencieux.
- `frontend/src/components/planning/TagInput.tsx` — un echec de recherche de
  tags vide juste les suggestions, sans distinction avec "aucun tag ne correspond".

**A faire** : au minimum un `toast.error` (ou un etat d'erreur inline pour les
listes) sur chaque `catch` actuellement vide, pour que l'utilisateur sache
qu'une action a echoue plutot que de supposer que "rien ne s'est passe" = "tout
va bien".

## Hors scope

- Le refactor des branches `isMobile ? (...) : (...)` dupliquees (note
  architecturale identifiee pendant l'audit, cause profonde de plusieurs bugs
  mobiles distincts, deja traites separement) — sujet a part, plus large qu'un
  simple polish de feedback.
- Tout ce qui a deja ete traite dans le rattrapage mobile/formulaires (voir
  git log de `feature/reserved-seats-ux` et les commits suivants) : bandeau
  hors-connexion, FAB, scroll body des sheets imbriquees, debordement de texte,
  cibles tactiles, double-submit, confirmations, validation croisee des dates,
  stepper sur `ManualBoardGameForm`.
