import prisma from "../../util/db";
import { afterEach, afterAll } from "vitest";

afterEach(async () => {
  await prisma.gameTableParticipant.deleteMany();
  await prisma.gameTableTag.deleteMany();
  await prisma.gameTable.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.eventParticipation.deleteMany();
  await prisma.eventInvitation.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.session.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
