import { v4 as uuidv4 } from "uuid";
import prisma from "../util/db";
import createError from "http-errors";

export async function createInvitation(eventId: string, email: string, invitedBy: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw createError(404, "Event not found");
  }

  const existing = await prisma.eventInvitation.findUnique({
    where: { email_eventId: { email, eventId } },
  });

  if (existing) {
    if (existing.status === "PENDING" || existing.status === "ACCEPTED") {
      throw createError(409, "Invitation already exists for this email and event");
    }

    // EXPIRED -> delete and recreate
    await prisma.eventInvitation.delete({ where: { id: existing.id } });
  }

  const token = uuidv4();

  const invitation = await prisma.eventInvitation.create({
    data: {
      eventId,
      email,
      invitedBy,
      token,
      expiresAt: event.endDateTime,
    },
  });

  return {
    invitation,
    inviteLink: `/invite/${token}`,
  };
}

export async function validateToken(token: string) {
  const invitation = await prisma.eventInvitation.findUnique({
    where: { token },
    include: { event: true },
  });

  if (!invitation) {
    throw createError(404, "Invitation not found");
  }

  if (invitation.status === "ACCEPTED") {
    throw createError(409, "Invitation already used");
  }

  if (invitation.expiresAt < new Date()) {
    throw createError(410, "Invitation has expired");
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: invitation.email, deletedAt: null },
  });

  return {
    email: invitation.email,
    eventName: invitation.event.name,
    eventId: invitation.eventId,
    hasAccount: !!existingUser,
  };
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await prisma.eventInvitation.findUnique({
    where: { token },
    include: { event: true },
  });

  if (!invitation) {
    throw createError(404, "Invitation not found");
  }

  if (invitation.status === "ACCEPTED") {
    throw createError(409, "Invitation already used");
  }

  if (invitation.expiresAt < new Date()) {
    throw createError(410, "Invitation has expired");
  }

  // Update invitation status and create participation in a transaction
  const [updatedInvitation, participation] = await prisma.$transaction([
    prisma.eventInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    }),
    prisma.eventParticipation.upsert({
      where: { eventId_userId: { eventId: invitation.eventId, userId } },
      create: { eventId: invitation.eventId, userId },
      update: {},
    }),
  ]);

  return { invitation: updatedInvitation, participation };
}

export async function listInvitations(eventId: string) {
  return prisma.eventInvitation.findMany({
    where: { eventId },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
