import prisma from "../../util/db";
import { afterEach, afterAll } from "vitest";

afterEach(async () => {
  await prisma.user.deleteMany();
  await prisma.session.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
