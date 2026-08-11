# Avancement du projet

## Phase actuelle : Commentaire par ingredient + correctif des 429 (retour prod)

Voir `docs/features/KitchenRecipeNotes/ROADMAP.md` / spec
`docs/features/KitchenRecipeNotes/SPEC_KITCHEN_RECIPE_NOTES.md`.

**A verifier apres deploiement** : disparition des 429 dans les logs prod. La cause
principale etait `TRUST_PROXY=1` pour une chaine de 2 proxys (Traefik + nginx), qui
faisait compter tous les utilisateurs dans un seul quota au lieu d'un quota par IP.

## Phase precedente : Repartition vege/carne par repas (evolution CookV1)

Lots A a F livres, voir `docs/features/KitchenDietSplit/ROADMAP.md` / spec
`docs/features/KitchenDietSplit/SPEC_KITCHEN_DIET_SPLIT.md` (section 10).

CookV1 (lots A a G) + les 7 points d'evolution post-V1 sont entierement livres, voir
`docs/features/CookV1/ROADMAP.md`.

Prochaines etapes : `docs/NEXT_STEPS.md`
Test manuel complet : `docs/MANUAL_TESTING.md`

## Resume de reprise

Si une session precedente a ete interrompue, un fichier `.claude/context/RESUME.md` peut
contenir l'etat exact du travail en cours. Verifier son existence avant de demarrer.
