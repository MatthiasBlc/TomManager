-- AlterTable
ALTER TABLE "Meal" ADD COLUMN     "recipe" TEXT;

-- AlterTable
ALTER TABLE "MealIngredient" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "MealIngredient_mealId_position_idx" ON "MealIngredient"("mealId", "position");
