# Roadmap : Polish feedback utilisateur

## Statut : Backlog (non demarre)

Chantier separe, volontairement reporte apres le rattrapage mobile/formulaires
issu du meme audit UX (voir `SPEC_UX_FEEDBACK_POLISH.md` pour le detail et les
raisons du report).

## Etapes

- [ ] Convention unique de wording pour les toasts (succes + erreurs) et
      passage en revue de tous les `toast.success`/`toast.error` de l'app
- [ ] Loading state sur `ProfilePage.tsx` (actuellement absent)
- [ ] Remplacer le spinner plein-page de `EventDetailPage.tsx` par un `Skeleton`
      coherent avec le reste de l'app
- [ ] Indicateur de chargement pendant les recherches debouncees (`TagInput`,
      recherche de tags dans `TableDetailModal`)
- [ ] Empty state sur la recherche sans resultat dans `AdminBoardGamePanel.tsx`
- [ ] Affordance "aucun resultat" dans les dropdowns `TagInput` /
      `BoardGameSearchInput`
- [ ] Signal visible (toast/bandeau) au disconnect/reconnect socket, au lieu du
      seul point colore de `ConnectionStatus.tsx`
- [ ] Refetch force des donnees actives (table courante, notifications) a la
      reconnexion socket
- [ ] Remplacer les `catch` silencieux par un retour utilisateur explicite :
      `EventListPage.tsx`, `useNotifications.ts`, `TagInput.tsx`

## Fichiers concernes (previsionnel)

- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/EventDetailPage.tsx`
- `frontend/src/pages/EventListPage.tsx`
- `frontend/src/components/planning/TagInput.tsx`
- `frontend/src/components/boardgames/BoardGameSearchInput.tsx`
- `frontend/src/components/admin/AdminBoardGamePanel.tsx`
- `frontend/src/components/common/ConnectionStatus.tsx`
- `frontend/src/hooks/useNotifications.ts`
- `frontend/src/hooks/useEventSocket.ts`
- Passage en revue transverse de tous les fichiers utilisant `toast.success`/`toast.error`
