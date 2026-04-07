-- AlterTable: make email and passwordHash nullable on User
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable: add Discord fields to User
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
ALTER TABLE "User" ADD COLUMN "discordUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

-- CreateIndex: discordId unique
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- AlterTable: add discordRoleId to Event
ALTER TABLE "Event" ADD COLUMN "discordRoleId" TEXT;

-- CreateIndex: discordRoleId unique
CREATE UNIQUE INDEX "Event_discordRoleId_key" ON "Event"("discordRoleId");
