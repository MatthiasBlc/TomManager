# Spec — Edition de la fiche recette (retour utilisateur)

Trois demandes remontees ensemble sur la meme page : la fiche ou un chef compose la
liste d'ingredients de son repas (`IngredientListInput` dans "Mon repas" et dans la
modale details de la Gestion).

1. Retirer un commentaire d'ingredient (on ne pouvait que l'ajouter).
2. Reorganiser l'ordre des ingredients.
3. Un bloc de texte libre pour coller une recette / des instructions.

## 1. Retirer un commentaire d'ingredient

### Besoin

`KitchenRecipeNotes` a livre le commentaire par ligne (bouton 💬 -> zone de texte),
mais aucun chemin inverse : une fois la zone ouverte, un chef ne pouvait ni la
refermer ni supprimer un commentaire devenu faux. Vider le texte a la main laissait
la zone ouverte a l'ecran.

### Comportement

- Bouton `✕` a droite de la zone de commentaire, libelle
  `Retirer le commentaire sur <ingredient>`.
- Il vide le texte **et** replie la zone : une ligne sans commentaire n'affiche plus
  de zone de saisie, le bouton 💬 revient.
- Cote reseau, rien de neuf : un commentaire vide etait deja normalise en `null`
  (`note?.trim() || null` cote front, `note?.trim() || null` cote service).

## 2. Reorganiser l'ordre des ingredients

### Besoin

L'ordre d'une recette porte du sens (ordre de preparation, regroupement par rayon
pour l'equipe courses). Il n'existait aucun moyen de deplacer une ligne : il fallait
tout retaper. Pire, l'ordre affiche n'etait pas garanti — aucune requete n'avait
d'`ORDER BY` sur les ingredients, on lisait l'ordre physique des lignes.

### Modele

`MealIngredient.position Int @default(0)`, index `(mealId, position)`.

L'ordre du tableau `ingredients` recu par `PATCH /meals/:mealId` **fait foi** : les
lignes sont deja recreees en bloc a chaque appel, `position` vaut donc l'index du
tableau. Toutes les lectures trient dessus :

| Lecture                     | Fichier                    |
| --------------------------- | -------------------------- |
| Detail repas / apres PATCH  | `services/meal.ts`         |
| Tableau de bord cuisine     | `services/kitchen.ts`      |
| Vues Courses + export Excel | `services/shoppingList.ts` |

L'equipe courses lit ainsi exactement la recette telle que le chef l'a composee.

### Interaction (mobile first)

- **Fleches ▲/▼ par ligne, partout** : c'est le chemin principal. Tactile sans piege,
  utilisable au clavier, et la fleche qui sortirait la ligne de la liste est
  desactivee. Un glisser-deposer tactile fiable demande un appui long + auto-scroll,
  soit une ergonomie franchement moins bonne qu'un tap sur une fleche.
- **Glisser-deposer a partir de `sm`** (poignee ⠿, masquee en dessous) : confort
  souris. Le `draggable` n'est arme que par un appui sur la poignee, sinon le
  navigateur capture le glissement dans les champs texte et on ne peut plus
  selectionner de texte a la souris. Retour visuel : ligne saisie en demi-opacite,
  ligne survolee cerclee.
- Les etats locaux indexes par rang (brouillon de quantite en cours de frappe,
  commentaire deplie mais encore vide) sont **reindexes** apres un deplacement ou une
  suppression : sans ca, deplacer une ligne ouvrait le commentaire de sa voisine.

### Donnees existantes (production)

Migration en deux temps, 100% additive :

1. `20260816113124_meal_recipe_and_ingredient_position` : `ADD COLUMN "position"
INTEGER NOT NULL DEFAULT 0` + index (et `Meal.recipe`, cf 3).
2. `20260816120000_meal_ingredient_position_backfill` : `UPDATE` de rang par
   `ROW_NUMBER() OVER (PARTITION BY "mealId" ORDER BY ctid)`.

Le backfill n'est pas cosmetique : sans lui toutes les lignes existantes valent `0`,
et un `ORDER BY position` rendrait les egalites dans un ordre arbitraire — les
recettes deja saisies en prod paraitraient melangees. `ctid` = ordre physique = ordre
rendu jusqu'ici : on fige donc exactement ce que les chefs voient deja.

## 3. Bloc-notes recette

### Besoin

La liste d'ingredients ne dit pas comment cuisiner. Un chef veut coller sa recette,
son deroule, des remarques pour son equipe.

### Modele

`Meal.recipe String?`, max 10000 caracteres, `null` quand vide ou blanc (une seule
representation de "pas de recette").

Aucune structure imposee : pas de markdown, pas d'etapes numerotees par le systeme.
C'est un bloc-notes ; les sauts de ligne saisis sont conserves a l'affichage
(`whitespace-pre-wrap`).

### Droits

Champ d'edition **du chef** au meme titre que `name`/ingredients/ustensiles — il
n'entre pas dans les champs structurants reserves au responsable. Lecture reservee a
`isFullReader` (chef + responsable), comme les ingredients et ustensiles : un
equipier ne voit pas la recette, un admin sans `admin.kitchen` non plus.

### Placement

- `lg` et au-dela : deux colonnes, listes (ingredients + ustensiles) a gauche,
  bloc-notes a droite — on lit la recette en saisissant les ingredients.
- En dessous : une seule colonne, le bloc passe sous les ustensiles.
- Meme disposition dans les deux chemins d'edition (fiche auto-save du chef, modale
  "Modifier"/"Valider" du responsable).
