import bcrypt from "bcrypt";
import prisma from "../util/db";
import createError from "http-errors";

const SALT_ROUNDS = 12;

export async function signup(email: string, username: string, password: string) {
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

  return { id: user.id, email: user.email, username: user.username, role: user.role };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (!user) {
    throw createError(401, "Invalid credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw createError(401, "Invalid credentials");
  }

  return { id: user.id, email: user.email, username: user.username, role: user.role };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw createError(404, "User not found");
  }

  return { id: user.id, email: user.email, username: user.username, role: user.role };
}
