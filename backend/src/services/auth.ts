import bcrypt from "bcrypt";
import prisma from "../util/db";
import createError from "http-errors";
import { getPreferences } from "./preference";

export async function login(identifier: string, password: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
      deletedAt: null,
    },
  });

  if (!user) {
    throw createError(401, "Invalid credentials", { code: "INVALID_CREDENTIALS" });
  }

  if (!user.passwordHash) {
    throw createError(401, "Invalid credentials", { code: "INVALID_CREDENTIALS" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw createError(401, "Invalid credentials", { code: "INVALID_CREDENTIALS" });
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw createError(404, "User not found", { code: "USER_NOT_FOUND" });
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    discordId: user.discordId,
    discordUsername: user.discordUsername,
    avatarUrl: user.avatarUrl,
    preferences: await getPreferences(userId),
  };
}
