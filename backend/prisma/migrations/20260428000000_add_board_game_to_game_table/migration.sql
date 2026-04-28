-- Liaison optionnelle GameTable <-> BoardGame (sous-feature A jds-rework)
ALTER TABLE "GameTable" ADD COLUMN "boardGameId" TEXT;

ALTER TABLE "GameTable" ADD CONSTRAINT "GameTable_boardGameId_fkey"
  FOREIGN KEY ("boardGameId") REFERENCES "BoardGame"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "GameTable_boardGameId_idx" ON "GameTable"("boardGameId");
