import { Guild } from "discord.js";
import prisma from "../util/db";
import env from "../util/env";
import {
  handleRoleAdded,
  handleRoleRemoved,
  handleAdminRoleChange,
  buildAvatarUrl,
} from "./syncParticipation";

// Sync complete au demarrage : reconcilie la DB avec l'etat actuel du guild
export async function startupSync(guild: Guild): Promise<void> {
  console.log("[startup-sync] Debut de la reconciliation...");

  const events = await prisma.event.findMany({
    where: { discordRoleId: { not: null } },
    select: { id: true, discordRoleId: true },
  });

  if (events.length === 0) {
    console.log("[startup-sync] Aucun event avec discordRoleId, rien a faire.");
    return;
  }

  const members = await guild.members.fetch();
  console.log(`[startup-sync] ${members.size} membres, ${events.length} events a reconcilier.`);

  let processed = 0;
  let errors = 0;

  for (const member of members.values()) {
    try {
      const memberRoleIds = [...member.roles.cache.keys()];
      const discordId = member.user.id;
      const discordUsername = member.user.username;
      const avatarUrl = buildAvatarUrl(discordId, member.user.avatar);

      for (const event of events) {
        if (memberRoleIds.includes(event.discordRoleId!)) {
          await handleRoleAdded(discordId, discordUsername, avatarUrl, event.discordRoleId!);
        } else {
          await handleRoleRemoved(discordId, event.discordRoleId!);
        }
      }

      // Gestion role admin
      if (env.DISCORD_ADMIN_ROLE_ID) {
        const hasAdminRole = memberRoleIds.includes(env.DISCORD_ADMIN_ROLE_ID);
        await handleAdminRoleChange(discordId, hasAdminRole);
      }

      processed++;
    } catch (err) {
      errors++;
      console.error(`[startup-sync] Erreur membre ${member.user.id}:`, err);
    }
  }

  console.log(`[startup-sync] Termine. ${processed} membres traites, ${errors} erreurs.`);
}
