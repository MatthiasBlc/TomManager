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

async function cascadeRemoveFromTables(
  eventId: string,
  userId: string,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
) {
  // Delete EventBoardGame entries for this user in this event
  await tx.eventBoardGame.deleteMany({
    where: { eventId, broughtByUserId: userId },
  });

  // Delete GameTables created by this user in this event (cascade handles children)
  await tx.gameTable.deleteMany({
    where: { eventId, createdBy: userId },
  });

  // Remove user from all table participations in this event
  const tableParticipations = await tx.gameTableParticipant.findMany({
    where: {
      gameTable: { eventId },
      userId,
    },
    include: { gameTable: true },
  });

  for (const tp of tableParticipations) {
    await tx.gameTableParticipant.delete({ where: { id: tp.id } });

    // Promote waitlist if the user was confirmed
    if (tp.status === "CONFIRMED") {
      const firstWaitlisted = await tx.gameTableParticipant.findFirst({
        where: { gameTableId: tp.gameTableId, status: "WAITLIST" },
        orderBy: { joinedAt: "asc" },
      });
      if (firstWaitlisted) {
        await tx.gameTableParticipant.update({
          where: { id: firstWaitlisted.id },
          data: { status: "CONFIRMED" },
        });
      }
    }
  }
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

  await prisma.$transaction(async (tx) => {
    await cascadeRemoveFromTables(eventId, userId, tx);
    await tx.eventParticipation.delete({ where: { id: participation.id } });
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

  await prisma.$transaction(async (tx) => {
    await cascadeRemoveFromTables(eventId, userId, tx);
    await tx.eventParticipation.delete({ where: { id: participation.id } });
  });
}
