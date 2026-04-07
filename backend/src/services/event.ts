import prisma from "../util/db";
import createError from "http-errors";

export async function createEvent(
  name: string,
  startDateTime: string,
  endDateTime: string,
  userId: string,
  discordRoleId?: string | null
) {
  if (!name || name.trim().length === 0 || name.trim().length > 100) {
    throw createError(400, "Name must be between 1 and 100 characters");
  }

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);

  if (isNaN(start.getTime())) {
    throw createError(400, "Invalid startDateTime");
  }
  if (isNaN(end.getTime())) {
    throw createError(400, "Invalid endDateTime");
  }
  if (end <= start) {
    throw createError(400, "endDateTime must be after startDateTime");
  }

  if (discordRoleId) {
    const conflict = await prisma.event.findFirst({ where: { discordRoleId } });
    if (conflict) throw createError(409, "Discord role already linked to another event");
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

export async function listEvents(userId: string, role: string, upcoming?: boolean, limit?: number) {
  const now = new Date();

  const where: Record<string, unknown> = {};

  if (role !== "ADMIN") {
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
          user: { select: { id: true, username: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event) {
    throw createError(404, "Event not found");
  }

  return {
    id: event.id,
    name: event.name,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    participants: event.participations.map((p) => ({
      userId: p.user.id,
      username: p.user.username,
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
  }
) {
  if (data.discordRoleId !== undefined && data.discordRoleId !== null) {
    const conflict = await prisma.event.findFirst({
      where: { discordRoleId: data.discordRoleId, id: { not: eventId } },
    });
    if (conflict) {
      throw createError(409, "Discord role already linked to another event");
    }
  }

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) {
    throw createError(404, "Event not found");
  }

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const start = data.startDateTime ? new Date(data.startDateTime) : existing.startDateTime;
  const end = data.endDateTime ? new Date(data.endDateTime) : existing.endDateTime;

  if (!name || name.length === 0 || name.length > 100) {
    throw createError(400, "Name must be between 1 and 100 characters");
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

  return event;
}

export async function purgeEvent(eventId: string) {
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) {
    throw createError(404, "Event not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.gameTable.deleteMany({ where: { eventId } });
    await tx.eventParticipation.deleteMany({ where: { eventId } });
    await tx.eventBoardGame.deleteMany({ where: { eventId } });
  });
}

export async function deleteEvent(eventId: string) {
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) {
    throw createError(404, "Event not found");
  }

  await prisma.$transaction(async (tx) => {
    // Delete GameTables (cascade handles GameTableTag + GameTableParticipant)
    await tx.gameTable.deleteMany({ where: { eventId } });
    await tx.eventParticipation.deleteMany({ where: { eventId } });
    await tx.event.delete({ where: { id: eventId } });
  });
}
