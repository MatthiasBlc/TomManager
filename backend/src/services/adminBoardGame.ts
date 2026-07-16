import prisma from "../util/db";
import createError from "http-errors";

const BOARD_GAME_WITH_COUNTS = {
  id: true,
  name: true,
  externalSource: true,
  externalId: true,
  yearPublished: true,
  minPlayers: true,
  maxPlayers: true,
  playingTime: true,
  imageUrl: true,
  createdAt: true,
  _count: { select: { eventBoardGames: true, gameTables: true } },
} as const;

export async function listBoardGames(
  search?: string,
  page = 1,
  limit = 20
): Promise<{
  games: {
    id: string;
    name: string;
    externalSource: string | null;
    externalId: string | null;
    yearPublished: number | null;
    minPlayers: number | null;
    maxPlayers: number | null;
    playingTime: number | null;
    imageUrl: string | null;
    createdAt: Date;
    _count: { eventBoardGames: number; gameTables: number };
  }[];
  total: number;
  page: number;
  limit: number;
}> {
  const where = search ? { name: { contains: search, mode: "insensitive" as const } } : {};

  const [total, games] = await Promise.all([
    prisma.boardGame.count({ where }),
    prisma.boardGame.findMany({
      where,
      select: BOARD_GAME_WITH_COUNTS,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
  ]);

  return { games, total, page, limit };
}

export async function updateBoardGame(
  id: string,
  data: {
    name?: string;
    yearPublished?: number | null;
    minPlayers?: number | null;
    maxPlayers?: number | null;
    playingTime?: number | null;
    imageUrl?: string | null;
  }
) {
  const game = await prisma.boardGame.findUnique({ where: { id } });
  if (!game) throw createError(404, "Board game not found", { code: "BOARD_GAME_NOT_FOUND" });

  return prisma.boardGame.update({
    where: { id },
    data,
    select: BOARD_GAME_WITH_COUNTS,
  });
}

export async function deleteBoardGame(id: string) {
  const game = await prisma.boardGame.findUnique({
    where: { id },
    include: {
      _count: { select: { eventBoardGames: true, gameTables: true } },
    },
  });
  if (!game) throw createError(404, "Board game not found", { code: "BOARD_GAME_NOT_FOUND" });

  // EventBoardGame has no onDelete cascade — delete manually first
  await prisma.eventBoardGame.deleteMany({ where: { boardGameId: id } });

  // GameTable.boardGameId has onDelete: SetNull — handled by Prisma
  await prisma.boardGame.delete({ where: { id } });
}

type FieldPick = "source" | "target";

export interface MergeFieldPicks {
  name?: FieldPick;
  yearPublished?: FieldPick;
  minPlayers?: FieldPick;
  maxPlayers?: FieldPick;
  playingTime?: FieldPick;
  imageUrl?: FieldPick;
  externalRef?: FieldPick;
}

export async function mergeBoardGames(
  sourceId: string,
  targetId: string,
  fieldPicks?: MergeFieldPicks
) {
  if (sourceId === targetId) throw createError(400, "Cannot merge a game into itself", { code: "CANNOT_MERGE_SELF" });

  const [source, target] = await Promise.all([
    prisma.boardGame.findUnique({ where: { id: sourceId } }),
    prisma.boardGame.findUnique({ where: { id: targetId } }),
  ]);
  if (!source) throw createError(404, "Source board game not found", { code: "BOARD_GAME_NOT_FOUND" });
  if (!target) throw createError(404, "Target board game not found", { code: "BOARD_GAME_NOT_FOUND" });

  // Apply field picks — update target with values from source where requested
  if (fieldPicks) {
    const upd: Record<string, unknown> = {};
    if (fieldPicks.name === "source") upd.name = source.name;
    if (fieldPicks.yearPublished === "source") upd.yearPublished = source.yearPublished;
    if (fieldPicks.minPlayers === "source") upd.minPlayers = source.minPlayers;
    if (fieldPicks.maxPlayers === "source") upd.maxPlayers = source.maxPlayers;
    if (fieldPicks.playingTime === "source") upd.playingTime = source.playingTime;
    if (fieldPicks.imageUrl === "source") upd.imageUrl = source.imageUrl;
    if (fieldPicks.externalRef === "source") {
      upd.externalSource = source.externalSource;
      upd.externalId = source.externalId;
    }
    if (Object.keys(upd).length > 0) {
      await prisma.boardGame.update({ where: { id: targetId }, data: upd });
    }
  }

  // Re-link GameTable entries
  await prisma.gameTable.updateMany({
    where: { boardGameId: sourceId },
    data: { boardGameId: targetId },
  });

  // Re-link EventBoardGame entries — skip duplicates (unique constraint)
  const entries = await prisma.eventBoardGame.findMany({
    where: { boardGameId: sourceId },
  });

  for (const entry of entries) {
    const duplicate = await prisma.eventBoardGame.findUnique({
      where: {
        eventId_boardGameId_broughtByUserId: {
          eventId: entry.eventId,
          boardGameId: targetId,
          broughtByUserId: entry.broughtByUserId,
        },
      },
    });

    if (duplicate) {
      await prisma.eventBoardGame.delete({ where: { id: entry.id } });
    } else {
      await prisma.eventBoardGame.update({
        where: { id: entry.id },
        data: { boardGameId: targetId },
      });
    }
  }

  await prisma.boardGame.delete({ where: { id: sourceId } });

  return prisma.boardGame.findUnique({
    where: { id: targetId },
    select: BOARD_GAME_WITH_COUNTS,
  });
}
