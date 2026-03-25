-- CreateTable
CREATE TABLE "BoardGame" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalSource" TEXT,
    "externalId" TEXT,
    "yearPublished" INTEGER,
    "minPlayers" INTEGER,
    "maxPlayers" INTEGER,
    "playingTime" INTEGER,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventBoardGame" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "boardGameId" TEXT NOT NULL,
    "broughtByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventBoardGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardGame_name_idx" ON "BoardGame"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BoardGame_externalSource_externalId_key" ON "BoardGame"("externalSource", "externalId");

-- CreateIndex
CREATE INDEX "EventBoardGame_eventId_idx" ON "EventBoardGame"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventBoardGame_eventId_boardGameId_broughtByUserId_key" ON "EventBoardGame"("eventId", "boardGameId", "broughtByUserId");

-- AddForeignKey
ALTER TABLE "EventBoardGame" ADD CONSTRAINT "EventBoardGame_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBoardGame" ADD CONSTRAINT "EventBoardGame_boardGameId_fkey" FOREIGN KEY ("boardGameId") REFERENCES "BoardGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBoardGame" ADD CONSTRAINT "EventBoardGame_broughtByUserId_fkey" FOREIGN KEY ("broughtByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
