import prisma from "../util/db";
import createError from "http-errors";
import { searchBGG, fetchBGGThing } from "./bgg";

interface CreateBoardGameData {
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  description?: string;
  imageUrl?: string;
}

export async function searchBoardGames(query: string) {
  const q = query.trim();
  if (!q) return [];

  // Recherche locale
  const localResults = await prisma.boardGame.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    take: 10,
    orderBy: { name: "asc" },
  });

  // Si suffisamment de resultats locaux, pas besoin de BGG
  if (localResults.length >= 10) {
    return localResults.slice(0, 20);
  }

  // Fallback BGG
  const bggResults = await searchBGG(q);

  // Dedup par externalId : les locaux sont prioritaires
  const localExternalIds = new Set(
    localResults.filter((bg) => bg.externalId).map((bg) => bg.externalId)
  );

  const newFromBGG = bggResults
    .filter((r) => !localExternalIds.has(r.bggId))
    .map((r) => ({
      id: null as unknown as string, // Pas encore en DB
      name: r.name,
      externalSource: "BGG" as const,
      externalId: r.bggId,
      yearPublished: r.yearPublished ?? null,
      minPlayers: null as number | null,
      maxPlayers: null as number | null,
      playingTime: null as number | null,
      description: null as string | null,
      imageUrl: null as string | null,
      createdAt: null as unknown as Date,
    }));

  const merged = [...localResults, ...newFromBGG];
  return merged.slice(0, 20);
}

export async function getBoardGame(boardGameId: string) {
  const boardGame = await prisma.boardGame.findUnique({
    where: { id: boardGameId },
  });

  if (!boardGame) {
    throw createError(404, "Board game not found", { code: "BOARD_GAME_NOT_FOUND" });
  }

  // Lazy fetch : si c'est un stub BGG (description NULL), enrichir
  if (
    boardGame.externalSource === "BGG" &&
    boardGame.externalId &&
    boardGame.description === null
  ) {
    const detail = await fetchBGGThing(boardGame.externalId);
    if (detail) {
      const updated = await prisma.boardGame.update({
        where: { id: boardGame.id },
        data: {
          yearPublished: detail.yearPublished ?? boardGame.yearPublished,
          minPlayers: detail.minPlayers ?? boardGame.minPlayers,
          maxPlayers: detail.maxPlayers ?? boardGame.maxPlayers,
          playingTime: detail.playingTime ?? boardGame.playingTime,
          description: detail.description ?? boardGame.description,
          imageUrl: detail.imageUrl ?? boardGame.imageUrl,
        },
      });
      return updated;
    }
  }

  return boardGame;
}

export async function createBoardGame(data: CreateBoardGameData) {
  const name = data.name?.trim();
  if (!name) {
    throw createError(400, "Name is required", { code: "NAME_REQUIRED" });
  }

  return prisma.boardGame.create({
    data: {
      name,
      yearPublished: data.yearPublished,
      minPlayers: data.minPlayers,
      maxPlayers: data.maxPlayers,
      playingTime: data.playingTime,
      description: data.description,
      imageUrl: data.imageUrl,
    },
  });
}

/**
 * Find or create a BoardGame from a BGG search result.
 * Used when adding a BGG game to an event.
 */
export async function findOrCreateFromBGG(
  bggId: string,
  data: {
    name: string;
    yearPublished?: number;
    minPlayers?: number;
    maxPlayers?: number;
    playingTime?: number;
    description?: string;
    imageUrl?: string;
  }
) {
  const existing = await prisma.boardGame.findFirst({
    where: { externalSource: "BGG", externalId: bggId },
  });

  if (existing) {
    // Enrichir si des champs manquent encore
    const needsUpdate =
      (data.description && !existing.description) ||
      (data.imageUrl && !existing.imageUrl) ||
      (data.minPlayers && !existing.minPlayers) ||
      (data.maxPlayers && !existing.maxPlayers) ||
      (data.playingTime && !existing.playingTime);

    if (needsUpdate) {
      return prisma.boardGame.update({
        where: { id: existing.id },
        data: {
          description: existing.description ?? data.description,
          imageUrl: existing.imageUrl ?? data.imageUrl,
          minPlayers: existing.minPlayers ?? data.minPlayers,
          maxPlayers: existing.maxPlayers ?? data.maxPlayers,
          playingTime: existing.playingTime ?? data.playingTime,
        },
      });
    }

    return existing;
  }

  return prisma.boardGame.create({
    data: {
      name: data.name,
      externalSource: "BGG",
      externalId: bggId,
      yearPublished: data.yearPublished ?? null,
      minPlayers: data.minPlayers ?? null,
      maxPlayers: data.maxPlayers ?? null,
      playingTime: data.playingTime ?? null,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
    },
  });
}
