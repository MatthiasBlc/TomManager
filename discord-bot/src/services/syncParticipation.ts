import crypto from "crypto";
import prisma from "../util/db";
import env from "../util/env";

// Miroir de la fonction backend — deduplication du username Discord
async function generateUniqueUsername(candidate: string, discordId: string): Promise<string> {
  let base = candidate.slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, "_");
  if (base.length < 3) base = `user_${discordId.slice(-5)}`;

  const existing = await prisma.user.findFirst({ where: { username: base } });
  if (!existing) return base;

  const fallback = `${base.slice(0, 24)}_${discordId.slice(-5)}`;
  const existing2 = await prisma.user.findFirst({ where: { username: fallback } });
  if (!existing2) return fallback;

  return `${base.slice(0, 21)}_${crypto.randomBytes(3).toString("hex")}`;
}

export function buildAvatarUrl(id: string, avatar: string | null): string {
  if (avatar) return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=256`;
  const index = parseInt(id.slice(-4), 16) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

// Appele quand un role lie a un event est ajoute a un membre Discord
export async function handleRoleAdded(
  discordId: string,
  discordUsername: string,
  avatarUrl: string,
  roleId: string
): Promise<void> {
  const event = await prisma.event.findFirst({ where: { discordRoleId: roleId } });
  if (!event) return;

  let user = await prisma.user.findFirst({ where: { discordId, deletedAt: null } });
  if (!user) {
    const username = await generateUniqueUsername(discordUsername, discordId);
    user = await prisma.user.create({
      data: { discordId, discordUsername, avatarUrl, username },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { discordUsername, avatarUrl },
    });
  }

  await prisma.eventParticipation.upsert({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    create: { eventId: event.id, userId: user.id },
    update: {},
  });
}

// Appele quand un role lie a un event est retire a un membre Discord
export async function handleRoleRemoved(discordId: string, roleId: string): Promise<void> {
  const event = await prisma.event.findFirst({ where: { discordRoleId: roleId } });
  if (!event) return;

  const user = await prisma.user.findFirst({ where: { discordId, deletedAt: null } });
  if (!user) return;

  const participation = await prisma.eventParticipation.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
  });
  if (!participation) return;

  await prisma.gameTableParticipant.deleteMany({
    where: { userId: user.id, gameTable: { eventId: event.id } },
  });
  await prisma.eventParticipation.delete({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
  });
}

// Gestion du role admin Discord
export async function handleAdminRoleChange(discordId: string, added: boolean): Promise<void> {
  if (!env.DISCORD_ADMIN_ROLE_ID) return;
  const user = await prisma.user.findFirst({ where: { discordId, deletedAt: null } });
  if (!user) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { role: added ? "ADMIN" : "USER" },
  });
}
