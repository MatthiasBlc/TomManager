import prisma from "../util/db";

export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function lockMealRow(tx: TxClient, mealId: string) {
  await tx.$queryRaw`SELECT id FROM "Meal" WHERE id = ${mealId} FOR UPDATE`;
}

// Verrouille deux fiches dans un ordre deterministe (tri des ids) pour eviter les
// deadlocks croises entre transactions concurrentes portant sur des paires de repas
// qui se chevauchent.
export async function lockMealRowsSorted(tx: TxClient, mealIdA: string, mealIdB: string) {
  const [first, second] = [mealIdA, mealIdB].sort();
  await lockMealRow(tx, first);
  await lockMealRow(tx, second);
}

// Transfert a sens unique de la recette (ingredients + ustensiles) de `fromMealId`
// vers `toMealId`. Capture des PK AVANT le mouvement, jamais un filtre par mealId
// apres coup (pour ne pas re-attraper des lignes deja deplacees par un appel voisin).
export async function moveRecipeByPk(tx: TxClient, fromMealId: string, toMealId: string) {
  const [ingredients, utensils] = await Promise.all([
    tx.mealIngredient.findMany({ where: { mealId: fromMealId }, select: { id: true } }),
    tx.mealUtensil.findMany({ where: { mealId: fromMealId }, select: { id: true } }),
  ]);
  await tx.mealIngredient.updateMany({
    where: { id: { in: ingredients.map((i) => i.id) } },
    data: { mealId: toMealId },
  });
  await tx.mealUtensil.updateMany({
    where: { id: { in: utensils.map((u) => u.id) } },
    data: { mealId: toMealId },
  });
}

// Echange croise de recettes entre deux repas. Capture les PK des DEUX cotes AVANT
// tout mouvement (sinon le 2e deplacement re-attrape les lignes du 1er).
export async function swapRecipesByPk(tx: TxClient, mealIdA: string, mealIdB: string) {
  const [aIngredients, bIngredients, aUtensils, bUtensils] = await Promise.all([
    tx.mealIngredient.findMany({ where: { mealId: mealIdA }, select: { id: true } }),
    tx.mealIngredient.findMany({ where: { mealId: mealIdB }, select: { id: true } }),
    tx.mealUtensil.findMany({ where: { mealId: mealIdA }, select: { id: true } }),
    tx.mealUtensil.findMany({ where: { mealId: mealIdB }, select: { id: true } }),
  ]);
  await tx.mealIngredient.updateMany({
    where: { id: { in: aIngredients.map((i) => i.id) } },
    data: { mealId: mealIdB },
  });
  await tx.mealIngredient.updateMany({
    where: { id: { in: bIngredients.map((i) => i.id) } },
    data: { mealId: mealIdA },
  });
  await tx.mealUtensil.updateMany({
    where: { id: { in: aUtensils.map((u) => u.id) } },
    data: { mealId: mealIdB },
  });
  await tx.mealUtensil.updateMany({
    where: { id: { in: bUtensils.map((u) => u.id) } },
    data: { mealId: mealIdA },
  });
}
