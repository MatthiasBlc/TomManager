import prisma from "../util/db";
import createError from "http-errors";

export async function createEvent(
  name: string,
  startDateTime: string,
  endDateTime: string,
  userId: string
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

  const event = await prisma.event.create({
    data: {
      name: name.trim(),
      startDateTime: start,
      endDateTime: end,
      createdBy: userId,
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

export async function listEvents(userId: string, role: string, upcoming?: boolean) {
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
  data: { name?: string; startDateTime?: string; endDateTime?: string }
) {
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
      data: { name, startDateTime: start, endDateTime: end },
    });

    // Update expiresAt of PENDING invitations when dates change
    if (datesChanged) {
      await tx.eventInvitation.updateMany({
        where: { eventId, status: "PENDING" },
        data: { expiresAt: end },
      });
    }

    return updated;
  });

  return event;
}

export async function deleteEvent(eventId: string) {
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) {
    throw createError(404, "Event not found");
  }

  await prisma.$transaction([
    prisma.eventParticipation.deleteMany({ where: { eventId } }),
    prisma.eventInvitation.deleteMany({ where: { eventId } }),
    prisma.event.delete({ where: { id: eventId } }),
  ]);
}
