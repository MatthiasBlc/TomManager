import crypto from "crypto";
import prisma from "../util/db";
import createError from "http-errors";
import env from "../config/env";

const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";

export function isDiscordConfigured(): boolean {
  return !!(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_GUILD_ID && env.DISCORD_REDIRECT_URI);
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds.members.read",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.DISCORD_REDIRECT_URI,
  });

  const res = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw createError(502, "Discord token exchange failed");
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw createError(502, "Discord token exchange failed");
  }
  return data.access_token;
}

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export async function fetchDiscordUser(token: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw createError(502, "Failed to fetch Discord user");
  return res.json() as Promise<DiscordUser>;
}

interface GuildMember {
  nick: string | null;
  roles: string[];
}

export async function fetchGuildMember(token: string): Promise<GuildMember | null> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw createError(502, "Failed to fetch guild member");
  return res.json() as Promise<GuildMember>;
}

export function buildAvatarUrl(id: string, avatar: string | null): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=256`;
  }
  const index = Number(BigInt(id) % 5n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export async function generateUniqueUsername(candidate: string, discordId: string): Promise<string> {
  let base = candidate
    .slice(0, 30)
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  if (base.length < 3) base = `user_${discordId.slice(-5)}`;

  const existing = await prisma.user.findFirst({ where: { username: base } });
  if (!existing) return base;

  const fallback = `${base.slice(0, 24)}_${discordId.slice(-5)}`;
  const existing2 = await prisma.user.findFirst({ where: { username: fallback } });
  if (!existing2) return fallback;

  return `${base.slice(0, 21)}_${crypto.randomBytes(3).toString("hex")}`;
}

export async function syncDiscordParticipations(userId: string, memberRoles: string[]): Promise<void> {
  const events = await prisma.event.findMany({
    where: { discordRoleId: { not: null } },
    select: { id: true, discordRoleId: true },
  });

  const granted = events.filter((e) => memberRoles.includes(e.discordRoleId!));
  const revoked = events.filter((e) => !memberRoles.includes(e.discordRoleId!));

  for (const event of granted) {
    await prisma.eventParticipation.upsert({
      where: { eventId_userId: { eventId: event.id, userId } },
      create: { eventId: event.id, userId, status: "CONFIRMED" },
      update: {},
    });
  }

  for (const event of revoked) {
    const participation = await prisma.eventParticipation.findUnique({
      where: { eventId_userId: { eventId: event.id, userId } },
    });
    if (!participation) continue;

    await prisma.gameTableParticipant.deleteMany({
      where: {
        userId,
        gameTable: { eventId: event.id },
      },
    });
    await prisma.eventParticipation.delete({
      where: { eventId_userId: { eventId: event.id, userId } },
    });
  }
}
