import prisma from "../util/db";
import createError from "http-errors";
import { findOrCreateTags } from "./tag";
import { emitToEvent } from "../socket/emitter";
import { createNotification, createBulkNotifications } from "./notification";

const BOARD_GAME_SELECT = {
  id: true,
  name: true,
  yearPublished: true,
  minPlayers: true,
  maxPlayers: true,
  playingTime: true,
  imageUrl: true,
  description: true,
} as const;

interface UpdateTableData {
  title?: string;
  gmIsPlayer?: boolean;
  pitch?: string | null;
  triggers?: string | null;
  comments?: string | null;
  maxPlayers?: number;
  reservedSeats?: number;
  startDateTime?: string;
  endDateTime?: string;
  tags?: string[];
  boardGameId?: string | null;
}

interface CreateTableData {
  title: string;
  type?: "JDR" | "JDS";
  gmIsPlayer?: boolean;
  pitch?: string;
  triggers?: string;
  comments?: string;
  maxPlayers: number;
  reservedSeats?: number;
  startDateTime: string;
  endDateTime: string;
  tags?: string[];
  boardGameId?: string | null;
}

export async function createTable(eventId: string, userId: string, data: CreateTableData) {
  const title = data.title?.trim();
  if (!title || title.length === 0 || title.length > 150) {
    throw createError(400, "Title must be between 1 and 150 characters");
  }

  if (data.pitch && data.pitch.length > 2000) {
    throw createError(400, "Pitch must not exceed 2000 characters");
  }
  if (data.triggers && data.triggers.length > 1000) {
    throw createError(400, "Triggers must not exceed 1000 characters");
  }
  if (data.comments && data.comments.length > 1000) {
    throw createError(400, "Comments must not exceed 1000 characters");
  }

  if (!Number.isInteger(data.maxPlayers) || data.maxPlayers < 1 || data.maxPlayers > 20) {
    throw createError(400, "maxPlayers must be an integer between 1 and 20");
  }

  const tableType = data.type ?? "JDR";
  const gmIsPlayer = tableType === "JDR" ? (data.gmIsPlayer ?? false) : false;
  const gmTakesASeat = tableType === "JDS" || gmIsPlayer;

  const reservedSeats = data.reservedSeats ?? 0;
  const maxReserved = gmTakesASeat ? data.maxPlayers - 1 : data.maxPlayers;
  if (!Number.isInteger(reservedSeats) || reservedSeats < 0 || reservedSeats > maxReserved) {
    throw createError(400, `reservedSeats must be between 0 and ${maxReserved}`);
  }

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

  if (data.boardGameId) {
    const game = await prisma.boardGame.findUnique({
      where: { id: data.boardGameId },
    });
    if (!game) throw createError(400, "Board game not found");
  }

  const table = await prisma.$transaction(async (tx) => {
    const created = await tx.gameTable.create({
      data: {
        eventId,
        createdBy: userId,
        title,
        type: tableType,
        gmIsPlayer,
        pitch: data.pitch || null,
        triggers: data.triggers || null,
        comments: data.comments || null,
        maxPlayers: data.maxPlayers,
        reservedSeats,
        startDateTime: start,
        endDateTime: end,
        boardGameId: data.boardGameId ?? null,
      },
    });

    if (gmTakesASeat) {
      await tx.gameTableParticipant.create({
        data: { gameTableId: created.id, userId, status: "CONFIRMED" },
      });
    }

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
        boardGame: { select: BOARD_GAME_SELECT },
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
        select: {
          userId: true,
          status: true,
          isOnReservedSeat: true,
          user: { select: { id: true, username: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      boardGame: { select: BOARD_GAME_SELECT },
    },
    take: limit,
    orderBy: { startDateTime: "asc" },
  });

  const confirmedTablesByUser = new Map<string, number[]>();
  tables.forEach((t, idx) => {
    if (!confirmedTablesByUser.has(t.createdBy)) confirmedTablesByUser.set(t.createdBy, []);
    confirmedTablesByUser.get(t.createdBy)!.push(idx);

    t.participants
      .filter((p) => p.status === "CONFIRMED")
      .forEach((p) => {
        if (p.userId === t.createdBy) return;
        if (!confirmedTablesByUser.has(p.userId)) confirmedTablesByUser.set(p.userId, []);
        confirmedTablesByUser.get(p.userId)!.push(idx);
      });
  });

  const conflictedUsersInTable = new Map<number, Set<string>>();
  for (const [userId, indices] of confirmedTablesByUser) {
    if (indices.length < 2) continue;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const a = tables[indices[i]];
        const b = tables[indices[j]];
        if (a.startDateTime < b.endDateTime && a.endDateTime > b.startDateTime) {
          if (!conflictedUsersInTable.has(indices[i]))
            conflictedUsersInTable.set(indices[i], new Set());
          if (!conflictedUsersInTable.has(indices[j]))
            conflictedUsersInTable.set(indices[j], new Set());
          conflictedUsersInTable.get(indices[i])!.add(userId);
          conflictedUsersInTable.get(indices[j])!.add(userId);
        }
      }
    }
  }

  return tables.map((t, idx) => {
    const confirmedCount = t.participants.filter((p) => p.status === "CONFIRMED").length;
    const waitlistCount = t.participants.filter((p) => p.status === "WAITLIST").length;
    const confirmedOnReserved = t.participants.filter(
      (p) => p.status === "CONFIRMED" && p.isOnReservedSeat
    ).length;
    const currentUserParticipant = t.participants.find((p) => p.userId === currentUserId);
    const conflictedUsers = conflictedUsersInTable.get(idx) ?? new Set<string>();

    return {
      id: t.id,
      eventId: t.eventId,
      title: t.title,
      type: t.type,
      gmIsPlayer: t.gmIsPlayer,
      pitch: t.pitch,
      maxPlayers: t.maxPlayers,
      reservedSeats: t.reservedSeats,
      startDateTime: t.startDateTime,
      endDateTime: t.endDateTime,
      createdAt: t.createdAt,
      creator: t.creator,
      tags: t.tags.map((gt) => gt.tag),
      players: t.participants
        .filter((p) => p.status === "CONFIRMED")
        .map((p) => ({
          id: p.user.id,
          username: p.user.username,
          isOnReservedSeat: p.isOnReservedSeat,
        })),
      confirmedCount,
      waitlistCount,
      confirmedOnReserved,
      currentUserStatus: currentUserParticipant?.status || null,
      isGM: t.createdBy === currentUserId,
      currentUserConflict: conflictedUsers.has(currentUserId),
      conflictingPlayerCount: conflictedUsers.size,
      boardGame: t.boardGame ?? null,
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
      boardGame: { select: BOARD_GAME_SELECT },
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
    type: table.type,
    gmIsPlayer: table.gmIsPlayer,
    pitch: table.pitch,
    triggers: table.triggers,
    comments: table.comments,
    maxPlayers: table.maxPlayers,
    reservedSeats: table.reservedSeats,
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
      isOnReservedSeat: p.isOnReservedSeat,
      joinedAt: p.joinedAt,
    })),
    boardGame: table.boardGame ?? null,
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

  const event = await prisma.event.findUnique({
    where: { id: existing.eventId },
  });

  if (data.boardGameId) {
    const game = await prisma.boardGame.findUnique({
      where: { id: data.boardGameId },
    });
    if (!game) throw createError(400, "Board game not found");
  }

  const title = data.title !== undefined ? data.title.trim() : existing.title;
  const pitch = data.pitch !== undefined ? data.pitch : existing.pitch;
  const triggers = data.triggers !== undefined ? data.triggers : existing.triggers;
  const comments = data.comments !== undefined ? data.comments : existing.comments;
  const newMaxPlayers = data.maxPlayers !== undefined ? data.maxPlayers : existing.maxPlayers;
  const start = data.startDateTime ? new Date(data.startDateTime) : existing.startDateTime;
  const end = data.endDateTime ? new Date(data.endDateTime) : existing.endDateTime;
  const boardGameId = data.boardGameId !== undefined ? data.boardGameId : existing.boardGameId;

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
  if (!Number.isInteger(newMaxPlayers) || newMaxPlayers < 1 || newMaxPlayers > 20) {
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

  // Calcul des reservedSeats finaux en tenant compte de maxPlayers et de la demande
  let newReservedSeats = existing.reservedSeats;
  if (data.reservedSeats !== undefined) {
    newReservedSeats = Math.min(data.reservedSeats, newMaxPlayers);
    if (!Number.isInteger(data.reservedSeats) || data.reservedSeats < 0) {
      throw createError(400, "reservedSeats must be a non-negative integer");
    }
  }
  // Si maxPlayers diminue, les reservedSeats sont cappees a newMaxPlayers
  newReservedSeats = Math.min(newReservedSeats, newMaxPlayers);

  const confirmedParticipants = existing.participants.filter((p) => p.status === "CONFIRMED");
  const confirmedCount = confirmedParticipants.length;

  // Combien de places confirmees peuvent tenir compte tenu de newMaxPlayers et newReservedSeats
  const targetConfirmed = Math.max(0, newMaxPlayers - newReservedSeats);
  const toDemoteCount = Math.max(0, confirmedCount - targetConfirmed);

  const demotedUserIds: string[] = [];
  const promotedUserIds: string[] = [];
  let finalReservedSeats = newReservedSeats;

  const gmIsPlayerChanged =
    existing.type === "JDR" &&
    data.gmIsPlayer !== undefined &&
    data.gmIsPlayer !== existing.gmIsPlayer;

  const result = await prisma.$transaction(async (tx) => {
    // Demotion due au changement de maxPlayers ou reservedSeats
    // Ordre : non-reserved d'abord (les plus recents), puis reserved si necessaire
    if (toDemoteCount > 0) {
      const nonReserved = confirmedParticipants
        .filter((p) => !p.isOnReservedSeat)
        .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
      const reserved = confirmedParticipants
        .filter((p) => p.isOnReservedSeat)
        .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());

      const todemote = [...nonReserved, ...reserved].slice(0, toDemoteCount);

      for (const p of todemote) {
        await tx.gameTableParticipant.update({
          where: { id: p.id },
          data: { status: "WAITLIST", isOnReservedSeat: false },
        });
        // Si ce joueur etait sur une reserved seat qui disparait, on n'a pas besoin
        // d'incrementer reservedSeats car on fixe la valeur finale directement
        demotedUserIds.push(p.userId);
      }
    }

    // Pas d'auto-promotion quand maxPlayers augmente ou reservedSeats diminue (decision B)

    // Toggle gmIsPlayer (JDR uniquement)
    if (gmIsPlayerChanged) {
      const gmId = existing.createdBy;
      const gmParticipant = existing.participants.find((p) => p.userId === gmId);

      if (data.gmIsPlayer && !gmParticipant) {
        const currentConfirmed = await tx.gameTableParticipant.count({
          where: { gameTableId: tableId, status: "CONFIRMED" },
        });
        const openSeats = newMaxPlayers - currentConfirmed - finalReservedSeats;
        const gmStatus = openSeats > 0 ? "CONFIRMED" : "WAITLIST";
        await tx.gameTableParticipant.create({
          data: { gameTableId: tableId, userId: gmId, status: gmStatus },
        });
      } else if (!data.gmIsPlayer && gmParticipant) {
        await tx.gameTableParticipant.delete({
          where: { id: gmParticipant.id },
        });
        // Si le GM etait sur une reserved seat, la liberer
        if (gmParticipant.isOnReservedSeat) {
          finalReservedSeats += 1;
        }
      }
    }

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

    const gmIsPlayerUpdate =
      existing.type === "JDR" && data.gmIsPlayer !== undefined
        ? { gmIsPlayer: data.gmIsPlayer }
        : {};

    return tx.gameTable.update({
      where: { id: tableId },
      data: {
        title,
        pitch,
        triggers,
        comments,
        maxPlayers: newMaxPlayers,
        reservedSeats: finalReservedSeats,
        startDateTime: start,
        endDateTime: end,
        boardGameId,
        ...gmIsPlayerUpdate,
      },
      include: {
        tags: { include: { tag: true } },
        creator: { select: { id: true, username: true } },
        boardGame: { select: BOARD_GAME_SELECT },
      },
    });
  });

  const updated = {
    ...result,
    tags: result.tags.map((gt) => gt.tag),
    boardGame: result.boardGame ?? null,
  };

  emitToEvent(existing.eventId, "table:updated", { table: updated });

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

  const participantUserIds = existing.participants
    .map((p) => p.userId)
    .filter((id) => id !== deletedByUserId);

  await prisma.gameTable.delete({ where: { id: tableId } });

  emitToEvent(existing.eventId, "table:deleted", { tableId });

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

    const gmTakesASeat = table.type === "JDS" || table.gmIsPlayer;
    if (table.createdBy === userId && !gmTakesASeat) {
      throw createError(400, "The GM cannot join their own table");
    }

    const existing = table.participants.find((p) => p.userId === userId);
    if (existing) {
      throw createError(409, "Already a participant of this table");
    }

    const confirmedCount = table.participants.filter((p) => p.status === "CONFIRMED").length;
    const openSeats = table.maxPlayers - confirmedCount - table.reservedSeats;
    const status = openSeats > 0 ? "CONFIRMED" : "WAITLIST";

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
  const table = await prisma.gameTable.findUnique({
    where: { id: tableId },
    include: { participants: true },
  });

  if (!table) {
    throw createError(404, "Table not found");
  }

  // Le MJ qui quitte supprime la table
  if (table.createdBy === userId) {
    const participantUserIds = table.participants
      .map((p) => p.userId)
      .filter((id) => id !== userId);

    await prisma.gameTable.delete({ where: { id: tableId } });
    emitToEvent(table.eventId, "table:deleted", { tableId });

    if (participantUserIds.length > 0) {
      await createBulkNotifications(
        participantUserIds.map((pid) => ({
          userId: pid,
          type: "TABLE_DELETED" as const,
          title: "Table supprimee",
          message: `La table "${table.title}" a ete supprimee (le MJ a quitte)`,
          metadata: { eventId: table.eventId, tableId },
        }))
      );
    }
    return;
  }

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
      if (participant.isOnReservedSeat) {
        // La place retourne dans le pool reserve (decision A), pas d'auto-promotion
        await tx.gameTable.update({
          where: { id: tableId },
          data: { reservedSeats: { increment: 1 } },
        });
      } else {
        // Place normale liberee : auto-promotion du premier en waitlist
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
    }
  });

  emitToEvent(table.eventId, "table:player:left", { tableId, userId });
  if (promotedUserId) {
    emitToEvent(table.eventId, "table:player:promoted", {
      tableId,
      userId: promotedUserId,
    });
    await createNotification({
      userId: promotedUserId,
      type: "WAITLIST_PROMOTED",
      title: "Place confirmee",
      message: `Tu es confirme pour la table "${table.title}"`,
      metadata: { eventId: table.eventId, tableId },
    });
  }
}

export async function setParticipantStatus(
  tableId: string,
  targetUserId: string,
  newStatus: "CONFIRMED" | "WAITLIST"
) {
  const table = await prisma.gameTable.findUnique({
    where: { id: tableId },
    include: { participants: true },
  });

  if (!table) {
    throw createError(404, "Table not found");
  }

  const participant = table.participants.find((p) => p.userId === targetUserId);
  if (!participant) {
    throw createError(404, "Participant not found");
  }

  let usedReservedSeat = false;

  if (newStatus === "CONFIRMED") {
    const confirmedCount = table.participants.filter((p) => p.status === "CONFIRMED").length;
    const openSeats = table.maxPlayers - confirmedCount - table.reservedSeats;

    if (table.reservedSeats > 0) {
      // Priorite : affecter a une reserved seat
      await prisma.$transaction(async (tx) => {
        await tx.gameTableParticipant.update({
          where: { id: participant.id },
          data: { status: "CONFIRMED", isOnReservedSeat: true },
        });
        await tx.gameTable.update({
          where: { id: tableId },
          data: { reservedSeats: { decrement: 1 } },
        });
      });
      usedReservedSeat = true;
    } else if (openSeats > 0) {
      await prisma.gameTableParticipant.update({
        where: { id: participant.id },
        data: { status: "CONFIRMED", isOnReservedSeat: false },
      });
    } else {
      throw createError(409, "Table is full");
    }
  } else {
    // Demote vers WAITLIST
    await prisma.$transaction(async (tx) => {
      if (participant.isOnReservedSeat) {
        // Libere la reserved seat
        await tx.gameTable.update({
          where: { id: tableId },
          data: { reservedSeats: { increment: 1 } },
        });
      }
      await tx.gameTableParticipant.update({
        where: { id: participant.id },
        data: { status: "WAITLIST", isOnReservedSeat: false },
      });
    });
  }

  if (newStatus === "CONFIRMED") {
    emitToEvent(table.eventId, "table:player:promoted", {
      tableId,
      userId: targetUserId,
    });
    if (usedReservedSeat) {
      await createNotification({
        userId: targetUserId,
        type: "RESERVED_SEAT_ASSIGNED",
        title: "Place reservee attribuee",
        message: `Le MJ t'a attribue une place reservee pour la table "${table.title}"`,
        metadata: { eventId: table.eventId, tableId },
      });
    } else {
      await createNotification({
        userId: targetUserId,
        type: "WAITLIST_PROMOTED",
        title: "Place confirmee",
        message: `Tu es confirme pour la table "${table.title}"`,
        metadata: { eventId: table.eventId, tableId },
      });
    }
  } else {
    emitToEvent(table.eventId, "table:player:demoted", {
      tableId,
      userId: targetUserId,
    });
    await createNotification({
      userId: targetUserId,
      type: "WAITLIST_DEMOTED",
      title: "Place en liste d'attente",
      message: `Tu as ete place en liste d'attente pour la table "${table.title}"`,
      metadata: { eventId: table.eventId, tableId },
    });
  }

  return { userId: targetUserId, status: newStatus };
}

export async function kickPlayer(tableId: string, userId: string) {
  const table = await prisma.gameTable.findUnique({
    where: { id: tableId },
    include: { participants: true },
  });

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
      if (participant.isOnReservedSeat) {
        // La place retourne dans le pool reserve, pas d'auto-promotion
        await tx.gameTable.update({
          where: { id: tableId },
          data: { reservedSeats: { increment: 1 } },
        });
      } else {
        // Place normale : auto-promotion
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
      emitToEvent(table.eventId, "table:player:promoted", {
        tableId,
        userId: promotedUserId,
      });
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
