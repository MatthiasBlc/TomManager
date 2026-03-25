-- CreateEnum
CREATE TYPE "TableParticipantStatus" AS ENUM ('CONFIRMED', 'WAITLIST');

-- CreateTable
CREATE TABLE "GameTable" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pitch" TEXT,
    "triggers" TEXT,
    "comments" TEXT,
    "maxPlayers" INTEGER NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameTableTag" (
    "gameTableId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "GameTableTag_pkey" PRIMARY KEY ("gameTableId","tagId")
);

-- CreateTable
CREATE TABLE "GameTableParticipant" (
    "id" TEXT NOT NULL,
    "gameTableId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TableParticipantStatus" NOT NULL DEFAULT 'CONFIRMED',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameTableParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameTable_eventId_startDateTime_idx" ON "GameTable"("eventId", "startDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "GameTableParticipant_gameTableId_status_idx" ON "GameTableParticipant"("gameTableId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GameTableParticipant_gameTableId_userId_key" ON "GameTableParticipant"("gameTableId", "userId");

-- AddForeignKey
ALTER TABLE "GameTable" ADD CONSTRAINT "GameTable_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTable" ADD CONSTRAINT "GameTable_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTableTag" ADD CONSTRAINT "GameTableTag_gameTableId_fkey" FOREIGN KEY ("gameTableId") REFERENCES "GameTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTableTag" ADD CONSTRAINT "GameTableTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTableParticipant" ADD CONSTRAINT "GameTableParticipant_gameTableId_fkey" FOREIGN KEY ("gameTableId") REFERENCES "GameTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTableParticipant" ADD CONSTRAINT "GameTableParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
