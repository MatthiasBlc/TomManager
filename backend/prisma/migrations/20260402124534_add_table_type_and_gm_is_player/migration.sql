-- CreateEnum
CREATE TYPE "TableType" AS ENUM ('JDR', 'JDS');

-- AlterTable
ALTER TABLE "GameTable" ADD COLUMN     "gmIsPlayer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" "TableType" NOT NULL DEFAULT 'JDR';
