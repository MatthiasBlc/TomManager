-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MealSwapRequest" (
    "id" TEXT NOT NULL,
    "eventKitchenId" TEXT NOT NULL,
    "requesterMealId" TEXT NOT NULL,
    "targetMealId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "MealSwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealSwapRequest_eventKitchenId_status_idx" ON "MealSwapRequest"("eventKitchenId", "status");

-- CreateIndex
CREATE INDEX "MealSwapRequest_targetMealId_status_idx" ON "MealSwapRequest"("targetMealId", "status");

-- AddForeignKey
ALTER TABLE "MealSwapRequest" ADD CONSTRAINT "MealSwapRequest_eventKitchenId_fkey" FOREIGN KEY ("eventKitchenId") REFERENCES "EventKitchen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSwapRequest" ADD CONSTRAINT "MealSwapRequest_requesterMealId_fkey" FOREIGN KEY ("requesterMealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSwapRequest" ADD CONSTRAINT "MealSwapRequest_targetMealId_fkey" FOREIGN KEY ("targetMealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSwapRequest" ADD CONSTRAINT "MealSwapRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSwapRequest" ADD CONSTRAINT "MealSwapRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
