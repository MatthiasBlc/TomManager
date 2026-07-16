# Roadmap - Polish audit (juillet 2026)

Reference : `SPEC_POLISH_AUDIT.md` (details, fichiers, validation par point).

Decoupage en 4 lots + 1 optionnel. Chaque lot = une branche `feature/*` depuis
`Developement`, mergee puis poussee (workflow CLAUDE.md). Les lots sont
independants sauf indication ; l'ordre proposee maximise la valeur visible tot.

---

## Lot A - Quick wins (Haiku 4.5, ~2-3h au total)

Branche suggeree : `feature/polish-quick-wins`

| #   | Point                                          | Effort   |
| --- | ---------------------------------------------- | -------- |
| 4   | Anti double-soumission (formulaires + actions) | 30min-1h |
| 3   | Accents notifications (+ maj convention CLAUDE.md) | 30min-1h |
| 7   | Hook useModalA11y (Echap + focus trap desktop) | 30min    |
| 9   | Scroll to top a la navigation                  | 15min    |
| 10  | `lang="fr"`                                    | 5min     |
| 11  | Onglet Profil actif (NavLink)                  | 10min    |

Aucune dependance. Livrable : une passe de polish immediate, zero decision produit.

---

## Lot B - ConfirmModal + garde formulaires (Sonnet 5, ~2-3h)

Branche suggeree : `feature/confirm-modal`

| #   | Point                                            | Effort |
| --- | ------------------------------------------------ | ------ |
| 1   | ConfirmModal + useConfirm, remplacer 9 confirm() | 1-2h   |
| 8   | Garde "modifications non enregistrees"           | 1h     |

Le point 8 depend du point 1 : meme branche.

---

## Lot C - Navigation & deep-links (Sonnet 5, ~2-3h)

Branche suggeree : `feature/nav-deeplinks`

| #   | Point                                             | Effort |
| --- | ------------------------------------------------- | ------ |
| 5   | Onglet dans l'URL (?tab=) + fix BottomTabBar jeux | 1h     |
| 12  | document.title par page                           | 30min  |
| 6   | Deep-link notification -> modale table            | 1-2h   |

Le point 6 profite du pattern search-params pose par le point 5 : meme branche,
dans cet ordre.

---

## Lot D - Erreurs backend en francais (Sonnet 5, ~2-3h)

Branche suggeree : `feature/error-codes`

| #   | Point                                                | Effort |
| --- | ---------------------------------------------------- | ------ |
| 2   | Codes d'erreur backend + mapping francais cote front | 2-3h   |

Seul lot qui touche le backend (avec le point 3 du lot A). Commencer par
recenser les erreurs atteignables via l'UI avant de coder.

---

## Lot E - Optionnel / infra (a discuter)

| #   | Point                             | Effort         | Blocage eventuel            |
| --- | --------------------------------- | -------------- | --------------------------- |
| 13  | 401 avec page de retour           | 30min          | -                           |
| 14  | Redirection post-login unifiee    | 15min          | -                           |
| 15  | Sentry frontend                   | 30min-1h + infra | Creer projet Sentry + DSN |

13 et 14 peuvent s'ajouter au lot A si on veut tout solder d'un coup.
15 demande une decision (quota Sentry, DSN en CI/prod).

---

## Suivi

- [ ] Lot A - quick wins
- [ ] Lot B - ConfirmModal + garde
- [ ] Lot C - navigation & deep-links
- [ ] Lot D - erreurs backend
- [ ] Lot E - optionnel (13, 14, 15)

Apres chaque lot : maj `.claude/context/` si pertinent (FILE_MAP pour les
nouveaux composants/hooks, API_MAP si le format d'erreur change) et changelog
utilisateur au merge vers `master`.
