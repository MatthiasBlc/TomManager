import prisma from "../util/db";
import createError from "http-errors";
import { findOrCreateTags } from "./tag";

interface CreateTableData {
  title: string;
  pitch?: string;
  triggers?: string;
  comments?: string;
  maxPlayers: number;
  startDateTime: string;
  endDateTime: string;
  tags?: string[];
}

export async function createTable(
  eventId: string,
  userId: string,
  data: CreateTableData
) {
  // Validate title
  const title = data.title?.trim();
  if (!title || title.length === 0 || title.length > 150) {
    throw createError(400, "Title must be between 1 and 150 characters");
  }

  // Validate optional text fields
  if (data.pitch && data.pitch.length > 2000) {
    throw createError(400, "Pitch must not exceed 2000 characters");
  }
  if (data.triggers && data.triggers.length > 1000) {
    throw createError(400, "Triggers must not exceed 1000 characters");
  }
  if (data.comments && data.comments.length > 1000) {
    throw createError(400, "Comments must not exceed 1000 characters");
  }

  // Validate maxPlayers
  if (!Number.isInteger(data.maxPlayers) || data.maxPlayers < 1 || data.maxPlayers > 20) {
    throw createError(400, "maxPlayers must be an integer between 1 and 20");
  }

  // Validate dates
  const start = new Date(data.startDateTime);
  const end = new Date(data.endDateTime);
  if (isNaN(start.getTime())) {
    throw createError(400, "Invalid startDateTime");
  }
  if (isNaN(end.getTime())) {
    throw createError(400, "Invalid endDateTime");
  }
  if (end <= start) {
    throw createError(400, "endDateTime must be after startDateTime");
  }

  // Validate dates within event bounds
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw createError(404, "Event not found");
  }
  if (start < event.startDateTime) {
    throw createError(400, "Table startDateTime must be within event bounds");
  }
  if (end > event.endDateTime) {
    throw createError(400, "Table endDateTime must be within event bounds");
  }

  const table = await prisma.$transaction(async (tx) => {
    const created = await tx.gameTable.create({
      data: {
        eventId,
        createdBy: userId,
        title,
        pitch: data.pitch || null,
        triggers: data.triggers || null,
        comments: data.comments || null,
        maxPlayers: data.maxPlayers,
        startDateTime: start,
        endDateTime: end,
      },
    });

    // Handle tags
    if (data.tags && data.tags.length > 0) {
      const tags = await findOrCreateTags(data.tags, tx);
      await Promise.all(
        tags.map((tag) =>
          tx.gameTableTag.create({
            data: { gameTableId: created.id, tagId: tag.id },
          })
        )
      );
    }

    return tx.gameTable.findUnique({
      where: { id: created.id },
      include: {
        tags: { include: { tag: true } },
        creator: { select: { id: true, username: true } },
      },
    });
  });

  return {
    ...table!,
    tags: table!.tags.map((gt) => gt.tag),
  };
}

export async function listTables(eventId: string, currentUserId: string) {
  const tables = await prisma.gameTable.findMany({
    where: { eventId },
    include: {
      creator: { select: { id: true, username: true } },
      tags: { include: { tag: true } },
      participants: {
        select: { userId: true, status: true },
      },
    },
    orderBy: { startDateTime: "asc" },
  });

  return tables.map((t) => {
    const confirmedCount = t.participants.filter((p) => p.status === "CONFIRMED").length;
    const waitlistCount = t.participants.filter((p) => p.status === "WAITLIST").length;
    const currentUserParticipant = t.participants.find((p) => p.userId === currentUserId);

    return {
      id: t.id,
      eventId: t.eventId,
      title: t.title,
      pitch: t.pitch,
      maxPlayers: t.maxPlayers,
      startDateTime: t.startDateTime,
      endDateTime: t.endDateTime,
      createdAt: t.createdAt,
      creator: t.creator,
      tags: t.tags.map((gt) => gt.tag),
      confirmedCount,
      waitlistCount,
      currentUserStatus: currentUserParticipant?.status || null,
      isGM: t.createdBy === currentUserId,
    };
  });
}

export async function getTable(tableId: string) {
  const table = await prisma.gameTable.findUnique({
    where: { id: tableId },
    include: {
      creator: { select: { id: true, username: true } },
      tags: { include: { tag: true } },
      participants: {
        include: {
          user: { select: { id: true, username: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!table) {
    throw createError(404, "Table not found");
  }

  return {
    id: table.id,
    eventId: table.eventId,
    createdBy: table.createdBy,
    title: table.title,
    pitch: table.pitch,
    triggers: table.triggers,
    comments: table.comments,
    maxPlayers: table.maxPlayers,
    startDateTime: table.startDateTime,
    endDateTime: table.endDateTime,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
    creator: table.creator,
    tags: table.tags.map((gt) => gt.tag),
    participants: table.participants.map((p) => ({
      userId: p.user.id,
      username: p.user.username,
      status: p.status,
      joinedAt: p.joinedAt,
    })),
  };
}
