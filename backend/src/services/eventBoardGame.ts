import prisma from "../util/db";
import createError from "http-errors";
import { emitToEvent } from "../socket/emitter";

export async function addToEvent(eventId: string, boardGameId: string, userId: string) {
  // Verify board game exists
  const boardGame = await prisma.boardGame.findUnique({
    where: { id: boardGameId },
  });
  if (!boardGame) {
    throw createError(404, "Board game not found");
  }

  // Check for duplicate
  const existing = await prisma.eventBoardGame.findUnique({
    where: {
      eventId_boardGameId_broughtByUserId: {
        eventId,
        boardGameId,
        broughtByUserId: userId,
      },
    },
  });
  if (existing) {
    throw createError(409, "You already added this board game to this event");
  }

  const entry = await prisma.eventBoardGame.create({
    data: { eventId, boardGameId, broughtByUserId: userId },
    include: {
      boardGame: true,
      broughtBy: { select: { id: true, username: true, displayName: true } },
    },
  });

  emitToEvent(eventId, "boardgame:added", { entry });

  return entry;
}

export async function listByEvent(eventId: string, limit?: number) {
  const entries = await prisma.eventBoardGame.findMany({
    where: { eventId },
    include: {
      boardGame: true,
      broughtBy: { select: { id: true, username: true, displayName: true } },
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  const boardGameIds = [...new Set(entries.map((e) => e.boardGameId))];

  const linkedTablesRaw = await prisma.gameTable.findMany({
    where: { boardGameId: { in: boardGameIds }, eventId },
    select: { id: true, title: true, boardGameId: true },
  });

  const linkedTablesByGame: Record<string, { id: string; title: string }[]> = {};
  for (const t of linkedTablesRaw) {
    if (!t.boardGameId) continue;
    if (!linkedTablesByGame[t.boardGameId]) linkedTablesByGame[t.boardGameId] = [];
    linkedTablesByGame[t.boardGameId].push({ id: t.id, title: t.title });
  }

  return entries.map((e) => ({
    ...e,
    linkedTables: linkedTablesByGame[e.boardGameId] ?? [],
  }));
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

  emitToEvent(entry.eventId, "boardgame:removed", { entryId: id });
}
