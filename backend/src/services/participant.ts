import prisma from "../util/db";
import createError from "http-errors";

export async function listParticipants(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw createError(404, "Event not found");
  }

  const participations = await prisma.eventParticipation.findMany({
    where: { eventId },
    include: {
      user: { select: { id: true, username: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return participations.map((p) => ({
    userId: p.user.id,
    username: p.user.username,
    role: p.user.role,
    joinedAt: p.createdAt,
  }));
}

export async function removeParticipant(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw createError(404, "Event not found");
  }

  if (event.createdBy === userId) {
    throw createError(400, "Cannot remove the event creator");
  }

  const participation = await prisma.eventParticipation.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });

  if (!participation) {
    throw createError(404, "Participant not found");
  }

  await prisma.eventParticipation.delete({
    where: { id: participation.id },
  });
}

export async function leaveEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw createError(404, "Event not found");
  }

  if (event.createdBy === userId) {
    throw createError(400, "The event creator cannot leave the event");
  }

  const participation = await prisma.eventParticipation.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });

  if (!participation) {
    throw createError(404, "Not a participant of this event");
  }

  await prisma.eventParticipation.delete({
    where: { id: participation.id },
  });
}
