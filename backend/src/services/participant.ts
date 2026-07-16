import prisma from "../util/db";
import createError from "http-errors";
import { emitToEvent } from "../socket/emitter";
import { createNotification } from "./notification";
import { lockTableRow } from "./gameTable";

export async function listParticipants(
  eventId: string,
  options: { limit?: number; cursor?: string } = {}
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw createError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
  }

  const take = Math.min(options.limit ?? 50, 100);

  const participations = await prisma.eventParticipation.findMany({
    where: {
      eventId,
      ...(options.cursor ? { createdAt: { lt: new Date(options.cursor) } } : {}),
    },
    include: {
      user: { select: { id: true, username: true, displayName: true, role: true } },
    },
    take: take + 1,
    orderBy: { createdAt: "asc" },
  });

  const hasMore = participations.length > take;
  const items = hasMore ? participations.slice(0, take) : participations;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return {
    data: items.map((p) => ({
      userId: p.user.id,
      username: p.user.username,
      displayName: p.user.displayName,
      role: p.user.role,
      joinedAt: p.createdAt,
    })),
    nextCursor,
  };
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
    // Serialise avec les autres operations de places sur cette table (cf. lockTableRow)
    await lockTableRow(tx, tp.gameTableId);
    await tx.gameTableParticipant.delete({ where: { id: tp.id } });

    if (tp.status === "CONFIRMED") {
      if (tp.isOnReservedSeat) {
        // La place reservee redevient disponible (pool derive), pas d'auto-promotion
      } else {
        // Place normale liberee : auto-promotion
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
}

export async function removeParticipant(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw createError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
  }

  if (event.createdBy === userId) {
    throw createError(400, "Cannot remove the event creator", {
      code: "CANNOT_REMOVE_EVENT_CREATOR",
    });
  }

  const participation = await prisma.eventParticipation.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });

  if (!participation) {
    throw createError(404, "Participant not found", { code: "PARTICIPANT_NOT_FOUND" });
  }

  await prisma.$transaction(async (tx) => {
    await cascadeRemoveFromTables(eventId, userId, tx);
    await tx.eventParticipation.delete({ where: { id: participation.id } });
  });

  emitToEvent(eventId, "participant:removed", { userId });

  await createNotification({
    userId,
    type: "PARTICIPANT_REMOVED",
    title: "Retiré d'un événement",
    message: `Tu as été retiré de l'événement "${event.name}"`,
    metadata: { eventId },
  });
}

export async function leaveEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw createError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
  }

  if (event.createdBy === userId) {
    throw createError(400, "The event creator cannot leave the event", {
      code: "EVENT_CREATOR_CANNOT_LEAVE",
    });
  }

  const participation = await prisma.eventParticipation.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });

  if (!participation) {
    throw createError(404, "Not a participant of this event", { code: "NOT_EVENT_PARTICIPANT" });
  }

  await prisma.$transaction(async (tx) => {
    await cascadeRemoveFromTables(eventId, userId, tx);
    await tx.eventParticipation.delete({ where: { id: participation.id } });
  });

  emitToEvent(eventId, "participant:removed", { userId });
}
