import prisma from "../util/db";
import createError from "http-errors";
import env from "../config/env";
import { syncDiscordParticipations, generateUniqueUsername, buildAvatarUrl } from "./discordAuth";

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordMember {
  user: {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  };
  roles: string[];
}

async function fetchAllGuildMembers(): Promise<DiscordMember[]> {
  const members: DiscordMember[] = [];
  let after = "0";

  while (true) {
    const res = await fetch(
      `${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } }
    );

    if (!res.ok) throw createError(502, "Impossible de recuperer les membres Discord");

    const batch = (await res.json()) as DiscordMember[];
    if (batch.length === 0) break;

    members.push(...batch);
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].user.id;
  }

  return members;
}

export async function syncAll(): Promise<{ synced: number; errors: string[] }> {
  if (!env.DISCORD_BOT_TOKEN) throw createError(503, "DISCORD_BOT_TOKEN non configure");
  if (!env.DISCORD_GUILD_ID) throw createError(503, "DISCORD_GUILD_ID non configure");

  const members = await fetchAllGuildMembers();
  let synced = 0;
  const errors: string[] = [];

  for (const member of members) {
    try {
      const hasRelevantRole = await prisma.event.findFirst({
        where: { discordRoleId: { in: member.roles } },
      });

      let user = await prisma.user.findFirst({
        where: { discordId: member.user.id, deletedAt: null },
      });

      if (!user && hasRelevantRole) {
        const displayName = member.user.global_name || member.user.username;
        const username = await generateUniqueUsername(displayName, member.user.id);
        const avatarUrl = buildAvatarUrl(member.user.id, member.user.avatar);
        user = await prisma.user.create({
          data: {
            discordId: member.user.id,
            discordUsername: member.user.username,
            avatarUrl,
            username,
          },
        });
      }

      if (!user) continue;

      await syncDiscordParticipations(user.id, member.roles);

      // Gestion role admin
      if (env.DISCORD_ADMIN_ROLE_ID) {
        const hasAdminRole = member.roles.includes(env.DISCORD_ADMIN_ROLE_ID);
        const expectedRole = hasAdminRole ? "ADMIN" : "USER";
        if (user.role !== expectedRole) {
          await prisma.user.update({ where: { id: user.id }, data: { role: expectedRole } });
        }
      }

      synced++;
    } catch (err) {
      errors.push(`Membre ${member.user.id}: ${(err as Error).message}`);
    }
  }

  return { synced, errors };
}
