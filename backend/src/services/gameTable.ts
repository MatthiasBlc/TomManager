import prisma from "../util/db";
import createError from "http-errors";
import { findOrCreateTags } from "./tag";
import { emitToEvent } from "../socket/emitter";
import { createNotification, createBulkNotifications } from "./notification";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Verrouille la ligne de la table (SELECT ... FOR UPDATE) pour serialiser les
// operations concurrentes sur les places d'une meme table (sinon deux actions
// simultanees peuvent lire le meme nombre de places libres et surreserver)
export async function lockTableRow(tx: TxClient, tableId: string) {
  await tx.$queryRaw`SELECT id FROM "GameTable" WHERE id = ${tableId} FOR UPDATE`;
}

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

  const gmIsPlayerChanged =
    existing.type === "JDR" &&
    data.gmIsPlayer !== undefined &&
    data.gmIsPlayer !== existing.gmIsPlayer;
  const gmSeatAdded = gmIsPlayerChanged && data.gmIsPlayer === true;
  const gmSeatRemoved = gmIsPlayerChanged && data.gmIsPlayer === false;

  // La place du MJ joueur vit avec le toggle : cocher "MJ joueur" CREE une place
  // pour lui (maxPlayers +1), decocher SUPPRIME sa place avec lui (maxPlayers -1).
  // Personne d'autre n'est retrograde ni promu par ce toggle : capacite et
  // occupation bougent ensemble, seul le total de joueurs change.
  const adjustedMaxPlayers = newMaxPlayers + (gmSeatAdded ? 1 : gmSeatRemoved ? -1 : 0);
  if (adjustedMaxPlayers > 20) {
    throw createError(400, "Enabling gmIsPlayer would exceed the maximum of 20 players");
  }
  if (adjustedMaxPlayers < 1) {
    throw createError(400, "Disabling gmIsPlayer would leave the table without any seat");
  }

  const newGmIsPlayer =
    existing.type === "JDR" && data.gmIsPlayer !== undefined
      ? data.gmIsPlayer
      : existing.gmIsPlayer;
  const gmTakesASeat = existing.type === "JDS" || newGmIsPlayer;

  // reservedSeats est un total fixe configure par le MJ : jamais mute par les actions
  // participants (join/promote/demote/leave/kick), uniquement ici sur demande explicite.
  // Meme borne qu'a la creation : le siege du MJ (JDS ou MJ joueur) n'est jamais
  // convertible en place reservee, le MJ n'est jamais sur une place reservee.
  const maxReserved = gmTakesASeat ? adjustedMaxPlayers - 1 : adjustedMaxPlayers;
  let newReservedSeats = existing.reservedSeats;
  if (data.reservedSeats !== undefined) {
    if (
      !Number.isInteger(data.reservedSeats) ||
      data.reservedSeats < 0 ||
      data.reservedSeats > maxReserved
    ) {
      throw createError(400, `reservedSeats must be between 0 and ${maxReserved}`);
    }
    newReservedSeats = data.reservedSeats;
  }
  // Si maxPlayers diminue (sans reservedSeats explicite), les reservedSeats
  // existantes sont cappees silencieusement a la meme borne
  newReservedSeats = Math.min(newReservedSeats, Math.max(0, maxReserved));

  const normalCapacity = Math.max(0, adjustedMaxPlayers - newReservedSeats);

  const demotedUserIds: string[] = [];
  const finalReservedSeats = newReservedSeats;

  const gmId = existing.createdBy;

  const result = await prisma.$transaction(async (tx) => {
    // Verrou + relecture des participants : la repartition se decide sur un etat a jour,
    // pas sur le snapshot pris avant la transaction (course avec un join simultane)
    await lockTableRow(tx, tableId);
    let participants = await tx.gameTableParticipant.findMany({
      where: { gameTableId: tableId },
    });

    // Toggle gmIsPlayer (JDR uniquement) — traite AVANT le calcul des debordements :
    // la place du MJ arrive/part avec lui, elle n'entre jamais dans la redistribution
    if (gmSeatAdded && !participants.some((p) => p.userId === gmId)) {
      const created = await tx.gameTableParticipant.create({
        data: { gameTableId: tableId, userId: gmId, status: "CONFIRMED" },
      });
      participants = [...participants, created];
    } else if (gmSeatRemoved) {
      const gmParticipant = participants.find((p) => p.userId === gmId);
      if (gmParticipant) {
        // La place du MJ est supprimee avec lui (maxPlayers -1) : elle ne devient
        // pas libre, donc aucune promotion depuis la liste d'attente
        await tx.gameTableParticipant.delete({ where: { id: gmParticipant.id } });
        participants = participants.filter((p) => p.id !== gmParticipant.id);
      }
    }

    const confirmedParticipants = participants.filter((p) => p.status === "CONFIRMED");
    const reservedParticipants = confirmedParticipants.filter((p) => p.isOnReservedSeat);
    const normalParticipants = confirmedParticipants.filter((p) => !p.isOnReservedSeat);
    // Le MJ assis a sa table n'est jamais candidat a la retrogradation : sa place
    // est garantie par la borne maxReserved (au moins une place libre lui revient)
    const demotableNormal = normalParticipants.filter((p) => p.userId !== gmId);

    // Debordement des places reservees (reservedSeats baisse sous l'occupation actuelle) :
    // le(s) joueur(s) reserve(s) le(s) plus recent(s) sont convertis en place libre si la
    // capacite libre le permet ; sinon ils partent en liste d'attente. Entre plusieurs
    // candidats en trop, les plus anciens du lot recuperent la conversion.
    const reservedOverflowCount = Math.max(0, reservedParticipants.length - newReservedSeats);
    // Le MJ est exclu des candidats (etat legacy uniquement : les gardes actuelles
    // l'empechent d'occuper une place reservee)
    const reservedOverflowGroup = reservedParticipants
      .filter((p) => p.userId !== gmId)
      .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())
      .slice(0, reservedOverflowCount);
    const availableNormalRoom = Math.max(0, normalCapacity - normalParticipants.length);
    const convertCount = Math.min(reservedOverflowCount, availableNormalRoom);
    const toWaitlistFromReserved = reservedOverflowGroup.slice(
      0,
      reservedOverflowCount - convertCount
    );
    const toConvertToNormal = reservedOverflowGroup.slice(reservedOverflowCount - convertCount);

    // Debordement des places libres (maxPlayers baisse ou reservedSeats augmente) :
    // liste d'attente directe, jamais de bascule automatique vers une place reservee (decision B)
    const normalAfterConversion = normalParticipants.length + convertCount;
    const normalOverflowCount = Math.max(0, normalAfterConversion - normalCapacity);
    const toWaitlistFromNormal = [...demotableNormal]
      .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())
      .slice(0, normalOverflowCount);

    for (const p of toConvertToNormal) {
      await tx.gameTableParticipant.update({
        where: { id: p.id },
        data: { isOnReservedSeat: false },
      });
    }

    for (const p of [...toWaitlistFromReserved, ...toWaitlistFromNormal]) {
      await tx.gameTableParticipant.update({
        where: { id: p.id },
        data: { status: "WAITLIST", isOnReservedSeat: false },
      });
      demotedUserIds.push(p.userId);
    }

    // Pas d'auto-promotion quand maxPlayers augmente ou reservedSeats diminue (decision B)

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
        maxPlayers: adjustedMaxPlayers,
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

  // Les joueurs retrogrades recoivent deja une notification dediee (WAITLIST_DEMOTED),
  // pas la peine de doubler avec TABLE_UPDATED
  const participantUserIds = existing.participants
    .map((p) => p.userId)
    .filter((id) => id !== updatedByUserId && !demotedUserIds.includes(id));

  // Le MJ ajoute comme joueur par un admin n'etait pas encore participant :
  // il doit aussi etre prevenu de la modification
  if (gmSeatAdded && gmId !== updatedByUserId && !participantUserIds.includes(gmId)) {
    participantUserIds.push(gmId);
  }

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
    await lockTableRow(tx, tableId);
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
    const confirmedOnReserved = table.participants.filter(
      (p) => p.status === "CONFIRMED" && p.isOnReservedSeat
    ).length;
    const confirmedNormal = confirmedCount - confirmedOnReserved;
    const normalCapacity = table.maxPlayers - table.reservedSeats;
    const openSeats = normalCapacity - confirmedNormal;
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
    await lockTableRow(tx, tableId);
    const participant = await tx.gameTableParticipant.findUnique({
      where: { gameTableId_userId: { gameTableId: tableId, userId } },
    });

    if (!participant) {
      throw createError(404, "Not a participant of this table");
    }

    await tx.gameTableParticipant.delete({ where: { id: participant.id } });

    if (participant.status === "CONFIRMED") {
      if (participant.isOnReservedSeat) {
        // La place reservee redevient disponible (pool derive), decision A : pas d'auto-promotion
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
  newStatus: "CONFIRMED" | "WAITLIST",
  seat?: "FREE" | "RESERVED"
) {
  const outcome = await prisma.$transaction(async (tx) => {
    await lockTableRow(tx, tableId);
    const table = await tx.gameTable.findUnique({
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

    // Le MJ assis a sa propre table (JDS ou MJ joueur) ne passe pas par la waitlist
    // et n'occupe jamais une place reservee : son depart se gere par la suppression
    // de la table ou le toggle gmIsPlayer
    if (newStatus === "WAITLIST" && targetUserId === table.createdBy) {
      throw createError(400, "The GM cannot be moved to the waitlist of their own table");
    }
    if (seat === "RESERVED" && targetUserId === table.createdBy) {
      throw createError(400, "The GM's seat can never be a reserved seat");
    }

    // Retrograder un joueur deja en liste d'attente n'a pas de sens (et
    // reinitialiserait sa position dans la file par effet de bord)
    if (newStatus === "WAITLIST" && participant.status === "WAITLIST") {
      throw createError(409, "Participant is already on the waitlist");
    }

    // Le choix de place est toujours explicite : plus de priorite par defaut
    // (le front envoie systematiquement seat, un client API doit faire de meme)
    if (newStatus === "CONFIRMED" && !seat) {
      throw createError(400, "seat is required when confirming a participant");
    }

    // reservedSeats est un total fixe configure par le MJ (cf. updateTable).
    // Les places reellement disponibles se derivent des participants, jamais stockees.
    const confirmedOnReserved = table.participants.filter(
      (p) => p.status === "CONFIRMED" && p.isOnReservedSeat
    ).length;
    const confirmedCount = table.participants.filter((p) => p.status === "CONFIRMED").length;
    const confirmedNormal = confirmedCount - confirmedOnReserved;
    const normalCapacity = table.maxPlayers - table.reservedSeats;

    const wasConversion = newStatus === "CONFIRMED" && participant.status === "CONFIRMED";
    let usedReservedSeat = false;
    let changed = true;

    if (wasConversion) {
      // Deja confirme : conversion en place entre place libre et place reservee
      const desiredReserved = seat === "RESERVED";

      if (desiredReserved === participant.isOnReservedSeat) {
        changed = false;
      } else if (desiredReserved) {
        const availableReserved = table.reservedSeats - confirmedOnReserved;
        if (availableReserved <= 0) {
          throw createError(409, "No reserved seat available");
        }
        await tx.gameTableParticipant.update({
          where: { id: participant.id },
          data: { isOnReservedSeat: true },
        });
        usedReservedSeat = true;
      } else {
        // Liberer une place reservee vers une place libre exige une place libre
        // disponible : le total de confirmes ne change pas, mais le compartiment
        // libre deborderait, et la place reservee ainsi liberee permettrait ensuite
        // une vraie sur-reservation (confirmes > maxPlayers). Meme regle que la
        // conversion automatique d'updateTable (availableNormalRoom).
        const availableNormal = normalCapacity - confirmedNormal;
        if (availableNormal <= 0) {
          throw createError(409, "No open seat available");
        }
        await tx.gameTableParticipant.update({
          where: { id: participant.id },
          data: { isOnReservedSeat: false },
        });
      }
    } else if (newStatus === "CONFIRMED") {
      const availableReserved = table.reservedSeats - confirmedOnReserved;
      const availableNormal = normalCapacity - confirmedNormal;

      if (seat === "RESERVED") {
        if (availableReserved <= 0) {
          throw createError(409, "No reserved seat available");
        }
        await tx.gameTableParticipant.update({
          where: { id: participant.id },
          data: { status: "CONFIRMED", isOnReservedSeat: true },
        });
        usedReservedSeat = true;
      } else {
        if (availableNormal <= 0) {
          throw createError(409, "No open seat available");
        }
        await tx.gameTableParticipant.update({
          where: { id: participant.id },
          data: { status: "CONFIRMED", isOnReservedSeat: false },
        });
      }
    } else {
      // Demote vers WAITLIST : la place reservee (le cas echeant) retourne
      // simplement dans le pool derive, reservedSeats (fixe) ne bouge pas.
      // joinedAt est reinitialise pour que le joueur retrograde reparte en fin de
      // file : sinon il garderait son anciennete et serait re-promu automatiquement
      // en premier des qu'une place se libere, annulant la decision du MJ.
      await tx.gameTableParticipant.update({
        where: { id: participant.id },
        data: { status: "WAITLIST", isOnReservedSeat: false, joinedAt: new Date() },
      });
    }

    return { table, usedReservedSeat, wasConversion, changed };
  });

  const { table, usedReservedSeat, wasConversion, changed } = outcome;

  if (!changed) {
    return { userId: targetUserId, status: newStatus };
  }

  if (wasConversion) {
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
    }

    return { userId: targetUserId, status: newStatus };
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

  if (!table) {
    throw createError(404, "Table not found");
  }

  // Meme logique que setParticipantStatus : le siege du MJ ne se libere pas par
  // un kick, mais par la suppression de la table ou le toggle gmIsPlayer
  if (table.createdBy === userId) {
    throw createError(400, "The GM cannot be removed from their own table");
  }

  let promotedUserId: string | null = null;
  await prisma.$transaction(async (tx) => {
    await lockTableRow(tx, tableId);
    const participant = await tx.gameTableParticipant.findUnique({
      where: { gameTableId_userId: { gameTableId: tableId, userId } },
    });

    if (!participant) {
      throw createError(404, "Not a participant of this table");
    }

    await tx.gameTableParticipant.delete({ where: { id: participant.id } });

    if (participant.status === "CONFIRMED") {
      if (participant.isOnReservedSeat) {
        // La place reservee redevient disponible (pool derive), pas d'auto-promotion
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
