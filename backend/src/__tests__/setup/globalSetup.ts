import prisma from "../../util/db";
import { beforeEach, afterEach, afterAll } from "vitest";

async function cleanupDb() {
  if (!prisma.notification) return;
  try {
    await prisma.notification.deleteMany();
    await prisma.eventBoardGame.deleteMany();
    await prisma.boardGame.deleteMany();
    await prisma.gameTableParticipant.deleteMany();
    await prisma.gameTableTag.deleteMany();
    await prisma.gameTable.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.eventParticipation.deleteMany();
    await prisma.event.deleteMany();
    await prisma.userPreference.deleteMany();
    await prisma.user.deleteMany();
    await prisma.session.deleteMany();
  } catch (e) {
    console.error("[globalSetup] cleanup failed:", e);
  }
}

beforeEach(cleanupDb);
afterEach(cleanupDb);

afterAll(async () => {
  if (!prisma.$disconnect) return;
  await prisma.$disconnect();
});
