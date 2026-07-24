-- AlterTable
ALTER TABLE "MealUtensil" ADD COLUMN     "utensilId" TEXT;

-- CreateTable
CREATE TABLE "Utensil" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Utensil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utensil_name_key" ON "Utensil"("name");

-- AddForeignKey
ALTER TABLE "MealUtensil" ADD CONSTRAINT "MealUtensil_utensilId_fkey" FOREIGN KEY ("utensilId") REFERENCES "Utensil"("id") ON DELETE SET NULL ON UPDATE CASCADE;
