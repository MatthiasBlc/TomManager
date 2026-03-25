import prisma from "../util/db";
import createError from "http-errors";

export async function addToEvent(eventId: string, boardGameId: string, userId: string) {
  // Verify board game exists
  const boardGame = await prisma.boardGame.findUnique({ where: { id: boardGameId } });
  if (!boardGame) {
    throw createError(404, "Board game not found");
  }

  // Check for duplicate
  const existing = await prisma.eventBoardGame.findUnique({
    where: {
      eventId_boardGameId_broughtByUserId: { eventId, boardGameId, broughtByUserId: userId },
    },
  });
  if (existing) {
    throw createError(409, "You already added this board game to this event");
  }

  return prisma.eventBoardGame.create({
    data: { eventId, boardGameId, broughtByUserId: userId },
    include: {
      boardGame: true,
      broughtBy: { select: { id: true, username: true } },
    },
  });
}

export async function listByEvent(eventId: string) {
  return prisma.eventBoardGame.findMany({
    where: { eventId },
    include: {
      boardGame: true,
      broughtBy: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function removeFromEvent(id: string, userId: string, userRole: string) {
  const entry = await prisma.eventBoardGame.findUnique({ where: { id } });
  if (!entry) {
    throw createError(404, "Board game entry not found");
  }

  if (entry.broughtByUserId !== userId && userRole !== "ADMIN") {
    throw createError(403, "Only the owner or an admin can remove this board game");
  }

  await prisma.eventBoardGame.delete({ where: { id } });
}
