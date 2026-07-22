-- CreateTable
CREATE TABLE "AssistantSwapRequest" (
    "id" TEXT NOT NULL,
    "eventKitchenId" TEXT NOT NULL,
    "requesterMealId" TEXT NOT NULL,
    "targetMealId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "accepterUserId" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "AssistantSwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantSwapRequest_eventKitchenId_status_idx" ON "AssistantSwapRequest"("eventKitchenId", "status");

-- CreateIndex
CREATE INDEX "AssistantSwapRequest_targetMealId_status_idx" ON "AssistantSwapRequest"("targetMealId", "status");

-- CreateIndex
CREATE INDEX "AssistantSwapRequest_requesterUserId_status_idx" ON "AssistantSwapRequest"("requesterUserId", "status");

-- AddForeignKey
ALTER TABLE "AssistantSwapRequest" ADD CONSTRAINT "AssistantSwapRequest_eventKitchenId_fkey" FOREIGN KEY ("eventKitchenId") REFERENCES "EventKitchen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSwapRequest" ADD CONSTRAINT "AssistantSwapRequest_requesterMealId_fkey" FOREIGN KEY ("requesterMealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSwapRequest" ADD CONSTRAINT "AssistantSwapRequest_targetMealId_fkey" FOREIGN KEY ("targetMealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSwapRequest" ADD CONSTRAINT "AssistantSwapRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantSwapRequest" ADD CONSTRAINT "AssistantSwapRequest_accepterUserId_fkey" FOREIGN KEY ("accepterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
