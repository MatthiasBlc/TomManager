-- Backfill de MealIngredient.position pour les recettes deja saisies.
--
-- La migration precedente ajoute la colonne avec DEFAULT 0 : toutes les lignes
-- existantes valent donc 0, et un ORDER BY position les rendrait dans un ordre
-- arbitraire (egalites) — les recettes deja en base paraitraient melangees aux
-- chefs et a l'equipe courses.
--
-- `ctid` est l'ordre physique des lignes, c'est-a-dire exactement l'ordre rendu
-- jusqu'ici (aucune requete n'avait d'ORDER BY sur les ingredients). On fige donc
-- l'ordre que les utilisateurs voient deja, sans rien perdre ni reordonner.
--
-- Purement correctif sur des donnees existantes : aucune suppression, la colonne
-- n'est encore lue par personne au moment ou cette migration passe.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "mealId" ORDER BY ctid) - 1 AS pos
  FROM "MealIngredient"
)
UPDATE "MealIngredient" AS mi
SET "position" = ranked.pos
FROM ranked
WHERE mi.id = ranked.id
  AND mi."position" IS DISTINCT FROM ranked.pos;
