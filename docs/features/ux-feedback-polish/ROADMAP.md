# Roadmap : Polish feedback utilisateur

## Statut : Complete

Chantier issu de l'audit UX large (voir `SPEC_UX_FEEDBACK_POLISH.md`), execute
apres le rattrapage mobile/formulaires (`feature/mobile-forms-ux`).

## Etapes

- [x] Convention unique de wording pour les toasts. Verifie a l'usage : la
      ponctuation des succes (`!` uniquement sur creation/mise a jour/liaison)
      etait deja coherente sur tout le code existant. Seul l'idiome des erreurs
      divergeait par endroits ("Erreur lors de...", "Impossible de...") — 5
      messages ramenes a "Echec de ..." dans `TableDetailModal.tsx`,
      `BoardGameSelector.tsx`, `AdminBoardGamePanel.tsx`.
- [x] Loading state `ProfilePage.tsx` : **verifie non applicable**. La page ne
      fait aucun fetch propre (le seul fetch async, `/api/auth/me`, vit dans
      `AuthContext` et est deja gate par le spinner de `PrivateRoute` avant meme
      le montage de la page). Les hooks `usePdfExport`/`useGameDbManagement`
      sont purement synchrones (localStorage). Rien a corriger.
- [x] `EventDetailPage.tsx` : nouveau `SkeletonEventDetail` (dans `Skeleton.tsx`)
      remplace le spinner plein-page.
- [x] Indicateur de chargement pendant la recherche debouncee de `TagInput.tsx`
      (etat "Recherche..." dans le dropdown). `BoardGameSearchInput.tsx` en
      avait deja un (spinner pres du champ) — verifie, rien a faire.
- [x] Empty state "Aucun resultat" dans `AdminBoardGamePanel.tsx` (reprend
      `EmptyState`, meme pattern que la sous-liste de fusion).
- [x] Affordance "aucun resultat" : `TagInput.tsx` (message + hint de creation)
      et `BoardGameSearchInput.tsx` (dropdown ouvert avec "Aucun resultat" au
      lieu de rester ferme).
- [x] Signal visible sur `ConnectionStatus.tsx` : toast au disconnect
      ("Connexion perdue...") et au reconnect ("Connexion retablie", jamais au
      tout premier connect).
- [x] Refetch a la reconnexion : `useEventSocket` expose un callback
      `onReconnected` (branche sur `PlanningTab`/`TableDetailModal`) et
      `useNotifications` refetch directement. Fix connexe plus important que
      prevu : le `join:event` initial etait perdu cote serveur apres toute
      reconnexion (le client ne rejoignait la room qu'une fois, jamais apres un
      drop) — sans ce fix, les evenements temps reel pouvaient rester muets
      indefiniment apres la moindre coupure reseau.
- [x] Erreurs silencieuses corrigees : `EventListPage.tsx` (etat d'erreur
      distinct de l'etat vide + bouton Reessayer), `useNotifications.ts` (toast
      sur chaque catch), `TagInput.tsx` (message distinct recherche/erreur vs
      aucun resultat).

## Fichiers modifies

- `frontend/src/pages/EventDetailPage.tsx`, `EventListPage.tsx`
- `frontend/src/components/common/Skeleton.tsx` (SkeletonEventDetail),
  `ConnectionStatus.tsx`
- `frontend/src/components/planning/TagInput.tsx`, `TableDetailModal.tsx`,
  `BoardGameSelector.tsx`
- `frontend/src/components/boardgames/BoardGameSearchInput.tsx`
- `frontend/src/components/admin/AdminBoardGamePanel.tsx`
- `frontend/src/hooks/useNotifications.ts`, `useEventSocket.ts`
- `frontend/src/components/planning/PlanningTab.tsx` (branchement onReconnected)
- Tests : `EventDetailPage`, `EventListPage`, `TagInput`, `BoardGameSearchInput`,
  `AdminBoardGamePanel`, `ConnectionStatus` (etendus) ; `useNotifications`,
  `useEventSocket` (nouveaux)

## Hors scope (non traite)

- Le refactor transverse des branches `isMobile ? (...) : (...)` dupliquees
  (note architecturale de l'audit initial, deja documentee ailleurs).
