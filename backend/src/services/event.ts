import prisma from "../util/db";
import createError from "http-errors";
import logger from "../util/logger";
import { syncEventParticipantsFromDiscord } from "./adminSync";
import { emitToEvent } from "../socket/emitter";
import { createBulkNotifications } from "./notification";

export async function createEvent(
  name: string,
  startDateTime: string,
  endDateTime: string,
  userId: string,
  discordRoleId?: string | null
) {
  if (!name || name.trim().length === 0 || name.trim().length > 100) {
    throw createError(400, "Name must be between 1 and 100 characters", { code: "NAME_LENGTH" });
  }

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);

  if (isNaN(start.getTime())) {
    throw createError(400, "Invalid startDateTime", { code: "INVALID_START_DATETIME" });
  }
  if (isNaN(end.getTime())) {
    throw createError(400, "Invalid endDateTime", { code: "INVALID_END_DATETIME" });
  }
  if (end <= start) {
    throw createError(400, "endDateTime must be after startDateTime", { code: "END_BEFORE_START" });
  }

  if (discordRoleId) {
    const conflict = await prisma.event.findFirst({ where: { discordRoleId } });
    if (conflict)
      throw createError(409, "Discord role already linked to another event", {
        code: "DISCORD_ROLE_ALREADY_LINKED",
      });
  }

  const event = await prisma.event.create({
    data: {
      name: name.trim(),
      startDateTime: start,
      endDateTime: end,
      createdBy: userId,
      discordRoleId: discordRoleId ?? null,
      participations: {
        create: {
          userId,
        },
      },
    },
    include: {
      participations: true,
    },
  });

  return event;
}

export async function listEvents(
  userId: string,
  role: string,
  upcoming?: boolean,
  limit?: number,
  mineOnly?: boolean
) {
  const now = new Date();

  const where: Record<string, unknown> = {};

  if (role !== "ADMIN" || mineOnly) {
    where.participations = { some: { userId } };
  }

  if (upcoming) {
    where.startDateTime = { gt: now };
  }

  const events = await prisma.event.findMany({
    where,
    select: {
      id: true,
      name: true,
      startDateTime: true,
      endDateTime: true,
      _count: { select: { participations: true } },
    },
    take: limit,
    orderBy: { startDateTime: "asc" },
  });

  return events.map((e) => ({
    id: e.id,
    name: e.name,
    startDateTime: e.startDateTime,
    endDateTime: e.endDateTime,
    participantCount: e._count.participations,
  }));
}

export async function getEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      participations: {
        include: {
          user: { select: { id: true, username: true, displayName: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event) {
    throw createError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
  }

  return {
    id: event.id,
    name: event.name,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    createdBy: event.createdBy,
    // Sans ce champ, la modale d'edition initialisait "Discord Role ID" a vide
    // et chaque enregistrement effacait le role lie a l'event
    discordRoleId: event.discordRoleId,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    participants: event.participations.map((p) => ({
      userId: p.user.id,
      username: p.user.username,
      displayName: p.user.displayName ?? null,
      role: p.user.role,
      joinedAt: p.createdAt,
    })),
  };
}

export async function updateEvent(
  eventId: string,
  data: {
    name?: string;
    startDateTime?: string;
    endDateTime?: string;
    discordRoleId?: string | null;
  },
  updatedByUserId: string
) {
  if (data.discordRoleId !== undefined && data.discordRoleId !== null) {
    const conflict = await prisma.event.findFirst({
      where: { discordRoleId: data.discordRoleId, id: { not: eventId } },
    });
    if (conflict) {
      throw createError(409, "Discord role already linked to another event", {
        code: "DISCORD_ROLE_ALREADY_LINKED",
      });
    }
  }

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) {
    throw createError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
  }

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const start = data.startDateTime ? new Date(data.startDateTime) : existing.startDateTime;
  const end = data.endDateTime ? new Date(data.endDateTime) : existing.endDateTime;

  if (!name || name.length === 0 || name.length > 100) {
    throw createError(400, "Name must be between 1 and 100 characters", { code: "NAME_LENGTH" });
  }
  if (data.startDateTime && isNaN(start.getTime())) {
    throw createError(400, "Invalid startDateTime", { code: "INVALID_START_DATETIME" });
  }
  if (data.endDateTime && isNaN(end.getTime())) {
    throw createError(400, "Invalid endDateTime", { code: "INVALID_END_DATETIME" });
  }
  if (end <= start) {
    throw createError(400, "endDateTime must be after startDateTime", { code: "END_BEFORE_START" });
  }

  const datesChanged =
    start.getTime() !== existing.startDateTime.getTime() ||
    end.getTime() !== existing.endDateTime.getTime();

  const event = await prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id: eventId },
      data: {
        name,
        startDateTime: start,
        endDateTime: end,
        ...(data.discordRoleId !== undefined ? { discordRoleId: data.discordRoleId } : {}),
      },
    });

    if (datesChanged) {
      // Cascade dates to GameTables
      const tables = await tx.gameTable.findMany({ where: { eventId } });
      for (const table of tables) {
        const clampedStart = table.startDateTime < start ? start : table.startDateTime;
        const clampedEnd = table.endDateTime > end ? end : table.endDateTime;

        if (clampedStart >= clampedEnd) {
          // Table becomes invalid — delete it (cascade handles tags + participants)
          await tx.gameTable.delete({ where: { id: table.id } });
        } else if (
          clampedStart.getTime() !== table.startDateTime.getTime() ||
          clampedEnd.getTime() !== table.endDateTime.getTime()
        ) {
          await tx.gameTable.update({
            where: { id: table.id },
            data: { startDateTime: clampedStart, endDateTime: clampedEnd },
          });
        }
      }
    }

    return updated;
  });

  emitToEvent(eventId, "event:updated", { event });

  // Seuls les changements visibles par les participants declenchent une
  // notification (nom, dates) — pas les champs techniques (discordRoleId)
  const nameChanged = name !== existing.name;
  if (nameChanged || datesChanged) {
    const participations = await prisma.eventParticipation.findMany({
      where: { eventId },
      select: { userId: true },
    });
    const recipients = participations.map((p) => p.userId).filter((id) => id !== updatedByUserId);
    await createBulkNotifications(
      recipients.map((userId) => ({
        userId,
        type: "EVENT_UPDATED" as const,
        title: "Événement modifié",
        message: `L'événement "${name}" a été modifié`,
        metadata: { eventId },
      }))
    );
  }

  return event;
}

// Purge silencieuse : suppression directe en DB sans passer par removeParticipant/kickPlayer.
// Ne pas ajouter de notifications ni d'emissions socket ici — la purge est une operation admin
// qui ne doit pas alerter les utilisateurs concernes.
export async function purgeEvent(eventId: string) {
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) {
    throw createError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.gameTable.deleteMany({ where: { eventId } });
    await tx.eventParticipation.deleteMany({ where: { eventId } });
    await tx.eventBoardGame.deleteMany({ where: { eventId } });
  });

  // L'event conserve son discordRoleId : re-importer immediatement les
  // participants depuis le role Discord pour ne pas laisser la liste vide.
  // Best-effort : un bot indisponible ne doit pas faire echouer la purge
  // (resyncedParticipants: null signale que le re-import n'a pas eu lieu).
  let resyncedParticipants: number | null = null;
  if (existing.discordRoleId) {
    try {
      resyncedParticipants = await syncEventParticipantsFromDiscord(eventId);
    } catch (err) {
      logger.warn({ err, eventId }, "Purge: re-import Discord des participants impossible");
    }
  }

  return { resyncedParticipants };
}

export async function deleteEvent(eventId: string, deletedByUserId: string) {
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) {
    throw createError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
  }

  // Les participants sont recuperes AVANT le delete cascade
  const participations = await prisma.eventParticipation.findMany({
    where: { eventId },
    select: { userId: true },
  });

  await prisma.$transaction(async (tx) => {
    // Delete GameTables (cascade handles GameTableTag + GameTableParticipant)
    await tx.gameTable.deleteMany({ where: { eventId } });
    await tx.eventParticipation.deleteMany({ where: { eventId } });
    await tx.event.delete({ where: { id: eventId } });
  });

  emitToEvent(eventId, "event:deleted", { eventId });

  const recipients = participations.map((p) => p.userId).filter((id) => id !== deletedByUserId);
  await createBulkNotifications(
    recipients.map((userId) => ({
      userId,
      type: "EVENT_DELETED" as const,
      title: "Événement supprimé",
      message: `L'événement "${existing.name}" a été supprimé`,
      metadata: { eventId },
    }))
  );
}
