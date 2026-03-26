import prisma from "../util/db";
import createError from "http-errors";
import { findOrCreateTags } from "./tag";
import { emitToEvent } from "../socket/emitter";
import { createNotification, createBulkNotifications } from "./notification";

interface UpdateTableData {
  title?: string;
  pitch?: string;
  triggers?: string;
  comments?: string;
  maxPlayers?: number;
  startDateTime?: string;
  endDateTime?: string;
  tags?: string[];
}

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

  const result = {
    ...table!,
    tags: table!.tags.map((gt) => gt.tag),
  };

  emitToEvent(eventId, "table:created", { table: result });

  return result;
}

export async function listTables(eventId: string, currentUserId: string, limit?: number) {
  const tables = await prisma.gameTable.findMany({
    where: { eventId },
    include: {
      creator: { select: { id: true, username: true } },
      tags: { include: { tag: true } },
      participants: {
        select: { userId: true, status: true },
      },
    },
    take: limit,
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

export async function updateTable(tableId: string, data: UpdateTableData, updatedByUserId: string) {
  const existing = await prisma.gameTable.findUnique({
    where: { id: tableId },
    include: { participants: true },
  });
  if (!existing) {
    throw createError(404, "Table not found");
  }

  const event = await prisma.event.findUnique({ where: { id: existing.eventId } });

  // Merge with existing values
  const title = data.title !== undefined ? data.title.trim() : existing.title;
  const pitch = data.pitch !== undefined ? data.pitch : existing.pitch;
  const triggers = data.triggers !== undefined ? data.triggers : existing.triggers;
  const comments = data.comments !== undefined ? data.comments : existing.comments;
  const maxPlayers = data.maxPlayers !== undefined ? data.maxPlayers : existing.maxPlayers;
  const start = data.startDateTime ? new Date(data.startDateTime) : existing.startDateTime;
  const end = data.endDateTime ? new Date(data.endDateTime) : existing.endDateTime;

  // Validate
  if (!title || title.length === 0 || title.length > 150) {
    throw createError(400, "Title must be between 1 and 150 characters");
  }
  if (pitch && pitch.length > 2000) {
    throw createError(400, "Pitch must not exceed 2000 characters");
  }
  if (triggers && triggers.length > 1000) {
    throw createError(400, "Triggers must not exceed 1000 characters");
  }
  if (comments && comments.length > 1000) {
    throw createError(400, "Comments must not exceed 1000 characters");
  }
  if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 20) {
    throw createError(400, "maxPlayers must be an integer between 1 and 20");
  }
  if (data.startDateTime && isNaN(start.getTime())) {
    throw createError(400, "Invalid startDateTime");
  }
  if (data.endDateTime && isNaN(end.getTime())) {
    throw createError(400, "Invalid endDateTime");
  }
  if (end <= start) {
    throw createError(400, "endDateTime must be after startDateTime");
  }
  if (start < event!.startDateTime) {
    throw createError(400, "Table startDateTime must be within event bounds");
  }
  if (end > event!.endDateTime) {
    throw createError(400, "Table endDateTime must be within event bounds");
  }

  const demotedUserIds: string[] = [];
  const promotedUserIds: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    // Handle maxPlayers change
    const confirmedCount = existing.participants.filter((p) => p.status === "CONFIRMED").length;

    if (maxPlayers < existing.maxPlayers && confirmedCount > maxPlayers) {
      // Demotion: move last confirmed players to waitlist
      const todemote = confirmedCount - maxPlayers;
      const confirmed = await tx.gameTableParticipant.findMany({
        where: { gameTableId: tableId, status: "CONFIRMED" },
        orderBy: { joinedAt: "desc" },
        take: todemote,
      });
      for (const p of confirmed) {
        await tx.gameTableParticipant.update({
          where: { id: p.id },
          data: { status: "WAITLIST" },
        });
        demotedUserIds.push(p.userId);
      }
    } else if (maxPlayers > existing.maxPlayers) {
      // Promotion: promote waitlisted players
      const availableSlots = maxPlayers - confirmedCount;
      if (availableSlots > 0) {
        const waitlisted = await tx.gameTableParticipant.findMany({
          where: { gameTableId: tableId, status: "WAITLIST" },
          orderBy: { joinedAt: "asc" },
          take: availableSlots,
        });
        for (const p of waitlisted) {
          await tx.gameTableParticipant.update({
            where: { id: p.id },
            data: { status: "CONFIRMED" },
          });
          promotedUserIds.push(p.userId);
        }
      }
    }

    // Handle tags if provided
    if (data.tags !== undefined) {
      await tx.gameTableTag.deleteMany({ where: { gameTableId: tableId } });
      if (data.tags.length > 0) {
        const tags = await findOrCreateTags(data.tags, tx);
        await Promise.all(
          tags.map((tag) =>
            tx.gameTableTag.create({
              data: { gameTableId: tableId, tagId: tag.id },
            })
          )
        );
      }
    }

    return tx.gameTable.update({
      where: { id: tableId },
      data: {
        title,
        pitch,
        triggers,
        comments,
        maxPlayers,
        startDateTime: start,
        endDateTime: end,
      },
      include: {
        tags: { include: { tag: true } },
        creator: { select: { id: true, username: true } },
      },
    });
  });

  const updated = {
    ...result,
    tags: result.tags.map((gt) => gt.tag),
  };

  emitToEvent(existing.eventId, "table:updated", { table: updated });

  // Notify participants about the update (except the updater)
  const participantUserIds = existing.participants
    .map((p) => p.userId)
    .filter((id) => id !== updatedByUserId);

  if (participantUserIds.length > 0) {
    await createBulkNotifications(
      participantUserIds.map((userId) => ({
        userId,
        type: "TABLE_UPDATED" as const,
        title: "Table modifiee",
        message: `La table "${existing.title}" a ete modifiee`,
        metadata: { eventId: existing.eventId, tableId },
      }))
    );
  }

  // Notify demoted players
  if (demotedUserIds.length > 0) {
    await createBulkNotifications(
      demotedUserIds.map((userId) => ({
        userId,
        type: "WAITLIST_DEMOTED" as const,
        title: "Place en liste d'attente",
        message: `Tu es en liste d'attente pour la table "${existing.title}"`,
        metadata: { eventId: existing.eventId, tableId },
      }))
    );
  }

  // Notify promoted players
  if (promotedUserIds.length > 0) {
    await createBulkNotifications(
      promotedUserIds.map((userId) => ({
        userId,
        type: "WAITLIST_PROMOTED" as const,
        title: "Place confirmee",
        message: `Tu es confirme pour la table "${existing.title}"`,
        metadata: { eventId: existing.eventId, tableId },
      }))
    );
  }

  return updated;
}

export async function deleteTable(tableId: string, deletedByUserId: string) {
  const existing = await prisma.gameTable.findUnique({
    where: { id: tableId },
    include: { participants: true },
  });
  if (!existing) {
    throw createError(404, "Table not found");
  }

  // Collect participant userIds before cascade delete removes them
  const participantUserIds = existing.participants
    .map((p) => p.userId)
    .filter((id) => id !== deletedByUserId);

  // GameTableTag and GameTableParticipant have onDelete Cascade
  await prisma.gameTable.delete({ where: { id: tableId } });

  emitToEvent(existing.eventId, "table:deleted", { tableId });

  // Notify all participants (except the one who deleted)
  if (participantUserIds.length > 0) {
    await createBulkNotifications(
      participantUserIds.map((userId) => ({
        userId,
        type: "TABLE_DELETED" as const,
        title: "Table supprimee",
        message: `La table "${existing.title}" a ete supprimee`,
        metadata: { eventId: existing.eventId, tableId },
      }))
    );
  }
}

export async function joinTable(tableId: string, userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const table = await tx.gameTable.findUnique({
      where: { id: tableId },
      include: { participants: true },
    });

    if (!table) {
      throw createError(404, "Table not found");
    }

    if (table.createdBy === userId) {
      throw createError(400, "The GM cannot join their own table");
    }

    const existing = table.participants.find((p) => p.userId === userId);
    if (existing) {
      throw createError(409, "Already a participant of this table");
    }

    const confirmedCount = table.participants.filter((p) => p.status === "CONFIRMED").length;
    const status = confirmedCount < table.maxPlayers ? "CONFIRMED" : "WAITLIST";

    const participant = await tx.gameTableParticipant.create({
      data: { gameTableId: tableId, userId, status },
    });

    return { participant, status, eventId: table.eventId };
  });

  emitToEvent(result.eventId, "table:player:joined", {
    tableId,
    participant: result.participant,
  });

  return result;
}

export async function leaveTable(tableId: string, userId: string) {
  const table = await prisma.gameTable.findUnique({ where: { id: tableId } });

  let promotedUserId: string | null = null;
  await prisma.$transaction(async (tx) => {
    const participant = await tx.gameTableParticipant.findUnique({
      where: { gameTableId_userId: { gameTableId: tableId, userId } },
    });

    if (!participant) {
      throw createError(404, "Not a participant of this table");
    }

    await tx.gameTableParticipant.delete({ where: { id: participant.id } });

    // If was confirmed and there's a waitlisted player, promote them
    if (participant.status === "CONFIRMED") {
      const firstWaitlisted = await tx.gameTableParticipant.findFirst({
        where: { gameTableId: tableId, status: "WAITLIST" },
        orderBy: { joinedAt: "asc" },
      });
      if (firstWaitlisted) {
        await tx.gameTableParticipant.update({
          where: { id: firstWaitlisted.id },
          data: { status: "CONFIRMED" },
        });
        promotedUserId = firstWaitlisted.userId;
      }
    }
  });

  if (table) {
    emitToEvent(table.eventId, "table:player:left", { tableId, userId });
    if (promotedUserId) {
      emitToEvent(table.eventId, "table:player:promoted", { tableId, userId: promotedUserId });
      await createNotification({
        userId: promotedUserId,
        type: "WAITLIST_PROMOTED",
        title: "Place confirmee",
        message: `Tu es confirme pour la table "${table.title}"`,
        metadata: { eventId: table.eventId, tableId },
      });
    }
  }
}

export async function kickPlayer(tableId: string, userId: string) {
  const table = await prisma.gameTable.findUnique({ where: { id: tableId } });

  let promotedUserId: string | null = null;
  await prisma.$transaction(async (tx) => {
    const participant = await tx.gameTableParticipant.findUnique({
      where: { gameTableId_userId: { gameTableId: tableId, userId } },
    });

    if (!participant) {
      throw createError(404, "Not a participant of this table");
    }

    await tx.gameTableParticipant.delete({ where: { id: participant.id } });

    if (participant.status === "CONFIRMED") {
      const firstWaitlisted = await tx.gameTableParticipant.findFirst({
        where: { gameTableId: tableId, status: "WAITLIST" },
        orderBy: { joinedAt: "asc" },
      });
      if (firstWaitlisted) {
        await tx.gameTableParticipant.update({
          where: { id: firstWaitlisted.id },
          data: { status: "CONFIRMED" },
        });
        promotedUserId = firstWaitlisted.userId;
      }
    }
  });

  if (table) {
    emitToEvent(table.eventId, "table:player:kicked", { tableId, userId });
    await createNotification({
      userId,
      type: "PLAYER_KICKED",
      title: "Expulse d'une table",
      message: `Tu as ete expulse de la table "${table.title}"`,
      metadata: { eventId: table.eventId, tableId },
    });
    if (promotedUserId) {
      emitToEvent(table.eventId, "table:player:promoted", { tableId, userId: promotedUserId });
      await createNotification({
        userId: promotedUserId,
        type: "WAITLIST_PROMOTED",
        title: "Place confirmee",
        message: `Tu es confirme pour la table "${table.title}"`,
        metadata: { eventId: table.eventId, tableId },
      });
    }
  }
}
