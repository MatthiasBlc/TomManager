import bcrypt from "bcrypt";
import prisma from "../util/db";
import createError from "http-errors";
import { validateToken, acceptInvitation } from "./invitation";

const SALT_ROUNDS = 12;

export async function signup(
  email: string,
  username: string,
  password: string,
  invitationToken: string
) {
  if (!invitationToken) {
    throw createError(400, "Invitation token is required");
  }

  // Validate token and verify email match
  const tokenData = await validateToken(invitationToken);
  if (tokenData.email.toLowerCase() !== email.toLowerCase()) {
    throw createError(403, "Email does not match invitation");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
      deletedAt: null,
    },
  });

  if (existing) {
    throw createError(409, "Email or username already taken");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, username, passwordHash },
  });

  // Accept invitation and create participation
  await acceptInvitation(invitationToken, user.id);

  return {
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
    eventId: tokenData.eventId,
  };
}

export async function login(identifier: string, password: string, invitationToken?: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
      deletedAt: null,
    },
  });

  if (!user) {
    throw createError(401, "Invalid credentials");
  }

  if (!user.passwordHash) {
    throw createError(401, "Invalid credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw createError(401, "Invalid credentials");
  }

  let eventId: string | undefined;

  if (invitationToken) {
    const tokenData = await validateToken(invitationToken);
    await acceptInvitation(invitationToken, user.id);
    eventId = tokenData.eventId;
  }

  return {
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
    eventId,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw createError(404, "User not found");
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    discordId: user.discordId,
    discordUsername: user.discordUsername,
    avatarUrl: user.avatarUrl,
  };
}
