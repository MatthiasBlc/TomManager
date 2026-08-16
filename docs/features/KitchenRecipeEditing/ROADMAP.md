# ROADMAP - Edition de la fiche recette

Spec : `SPEC_KITCHEN_RECIPE_EDITING.md`. Branche de base : `Developement` ->
`feature/kitchen-recipe-editing`.

Trois demandes utilisateur sur la meme page (fiche recette d'un repas), livrees dans
un seul lot : elles touchent les memes fichiers (`IngredientListInput`,
`MealFicheEditor`, `MealFicheDetailModal`, `services/meal.ts`) et une seule migration
les couvre.

**Rappel PROD** : il y a des utilisateurs en production.

- Migrations 100% additives, relues ligne a ligne : `ADD COLUMN` nullable
  (`Meal.recipe`), `ADD COLUMN ... DEFAULT 0` + index (`MealIngredient.position`),
  puis un `UPDATE` de backfill qui ne touche que la nouvelle colonne.
- Aucune suppression, aucun renommage, aucune contrainte ajoutee sur l'existant.
- Le backfill est **obligatoire** : sans lui, les recettes deja saisies paraissent
  melangees des que la lecture trie par `position` (toutes les lignes a 0).
- Ownership du dossier de migration aligne sur ses voisins (le `docker exec` le cree
  en root).
- Jamais `prisma migrate` directement contre la prod : les fichiers partent par le
  pipeline habituel.

## Modele par lot

| Lot                        | Modele    | Effort |
| -------------------------- | --------- | ------ |
| A (retrait du commentaire) | Haiku 4.5 | ~30min |
| B (ordre des ingredients)  | Sonnet 5  | ~2-3h  |
| C (bloc-notes recette)     | Sonnet 5  | ~1-2h  |

Lot B au-dessus des autres : il touche le modele, les trois chemins de lecture
(fiche, tableau de bord, Courses/export) et une migration de donnees existantes.

---

## Lot A - Retirer un commentaire d'ingredient

- [x] `IngredientListInput` : bouton `✕` a cote de la zone de commentaire, vide le
      texte ET replie la zone (le bouton 💬 revient).
- [x] Tests : commentaire vide a la suppression, zone repliee au rerender parent.

## Lot B - Reorganiser l'ordre des ingredients

- [x] Migration additive `MealIngredient.position Int @default(0)` + index
      `(mealId, position)` (`20260816113124_meal_recipe_and_ingredient_position`).
- [x] Migration de backfill par `ctid`
      (`20260816120000_meal_ingredient_position_backfill`), relue : un seul `UPDATE`
      sur la nouvelle colonne.
- [x] Repercuter sur `discord-bot/prisma/schema.prisma` (schema duplique, meme base).
- [x] `services/meal.ts` : `position: index` dans `createMany`, `orderBy` dans
      `MEAL_INCLUDE`.
- [x] `services/kitchen.ts` et `services/shoppingList.ts` : `orderBy position` (la
      liste de courses et l'export Excel suivent l'ordre du chef).
- [x] `prisma/seed.js` : position = rang dans le tableau seede.
- [x] `IngredientListInput` : fleches ▲/▼ partout (clavier compris, bornes
      desactivees) + glisser-deposer a la poignee des `sm`.
- [x] Reindexation des etats locaux par rang (brouillon de quantite, commentaire
      deplie) apres deplacement ou suppression.
- [x] Tests front (fleches, bornes, commentaire qui suit sa ligne, drop) et back
      (position persistee, reorganisation, ordre relu par GET /kitchen, ordre des
      vues Courses).

## Lot C - Bloc-notes recette

- [x] Migration additive `Meal.recipe String?` (meme migration que le lot B).
- [x] Repercuter sur `discord-bot/prisma/schema.prisma`.
- [x] `updateMealSchema.recipe` (max 10000, nullable), blanc -> `null` dans
      `services/meal.ts` ; champ chef, pas manager-only.
- [x] `services/kitchen.ts` : expose dans le meme perimetre que les ingredients
      (`isFullReader`).
- [x] `MealFicheEditor` (auto-save, meme debounce que les listes) et
      `MealFicheDetailModal` (edition + lecture seule `whitespace-pre-wrap`).
- [x] Disposition deux colonnes des `lg`, empilee en dessous.
- [x] Tests front (auto-save, blanc -> `null`) et back (persistance, sauts de ligne,
      effacement, refus au-dela de 10000).
