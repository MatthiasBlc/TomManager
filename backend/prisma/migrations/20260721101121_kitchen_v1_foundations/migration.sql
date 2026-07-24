-- CreateEnum
CREATE TYPE "ChefSource" AS ENUM ('ROLE', 'MANUAL');

-- CreateEnum
CREATE TYPE "MealService" AS ENUM ('LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('G', 'KG', 'ML', 'CL', 'L', 'CAS', 'CAC', 'PIECE');

-- CreateTable
CREATE TABLE "EventKitchen" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "chefRoleId" TEXT,
    "allergiesNotes" TEXT,
    "equipierPlanningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventKitchen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenChef" (
    "id" TEXT NOT NULL,
    "eventKitchenId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ChefSource" NOT NULL,

    CONSTRAINT "KitchenChef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenCoursesMember" (
    "id" TEXT NOT NULL,
    "eventKitchenId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "KitchenCoursesMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "eventKitchenId" TEXT NOT NULL,
    "chefUserId" TEXT,
    "name" TEXT NOT NULL,
    "service" "MealService" NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "maxAssistants" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealIngredient" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "Unit" NOT NULL,

    CONSTRAINT "MealIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealUtensil" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MealUtensil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealAssistant" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "eventKitchenId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealAssistant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventKitchen_eventId_key" ON "EventKitchen"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenChef_eventKitchenId_userId_key" ON "KitchenChef"("eventKitchenId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenCoursesMember_eventKitchenId_userId_key" ON "KitchenCoursesMember"("eventKitchenId", "userId");

-- CreateIndex
CREATE INDEX "Meal_eventKitchenId_startDateTime_idx" ON "Meal"("eventKitchenId", "startDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "Meal_eventKitchenId_chefUserId_key" ON "Meal"("eventKitchenId", "chefUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MealAssistant_mealId_userId_key" ON "MealAssistant"("mealId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MealAssistant_eventKitchenId_userId_key" ON "MealAssistant"("eventKitchenId", "userId");

-- AddForeignKey
ALTER TABLE "EventKitchen" ADD CONSTRAINT "EventKitchen_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenChef" ADD CONSTRAINT "KitchenChef_eventKitchenId_fkey" FOREIGN KEY ("eventKitchenId") REFERENCES "EventKitchen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenChef" ADD CONSTRAINT "KitchenChef_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenCoursesMember" ADD CONSTRAINT "KitchenCoursesMember_eventKitchenId_fkey" FOREIGN KEY ("eventKitchenId") REFERENCES "EventKitchen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenCoursesMember" ADD CONSTRAINT "KitchenCoursesMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_eventKitchenId_fkey" FOREIGN KEY ("eventKitchenId") REFERENCES "EventKitchen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_chefUserId_fkey" FOREIGN KEY ("chefUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealIngredient" ADD CONSTRAINT "MealIngredient_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealIngredient" ADD CONSTRAINT "MealIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealUtensil" ADD CONSTRAINT "MealUtensil_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealAssistant" ADD CONSTRAINT "MealAssistant_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealAssistant" ADD CONSTRAINT "MealAssistant_eventKitchenId_fkey" FOREIGN KEY ("eventKitchenId") REFERENCES "EventKitchen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealAssistant" ADD CONSTRAINT "MealAssistant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
