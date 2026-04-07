import { GuildMember } from "discord.js";
import env from "../util/env";
import {
  handleRoleAdded,
  handleRoleRemoved,
  handleAdminRoleChange,
  buildAvatarUrl,
} from "../services/syncParticipation";

export async function onGuildMemberUpdate(
  oldMember: GuildMember,
  newMember: GuildMember
): Promise<void> {
  const oldRoleIds = new Set(oldMember.roles.cache.keys());
  const newRoleIds = new Set(newMember.roles.cache.keys());

  const addedRoles = [...newRoleIds].filter((id) => !oldRoleIds.has(id));
  const removedRoles = [...oldRoleIds].filter((id) => !newRoleIds.has(id));

  if (addedRoles.length === 0 && removedRoles.length === 0) return;

  const discordId = newMember.user.id;
  const discordUsername = newMember.user.username;
  const avatarUrl = buildAvatarUrl(discordId, newMember.user.avatar);

  for (const roleId of addedRoles) {
    try {
      await handleRoleAdded(discordId, discordUsername, avatarUrl, roleId);

      if (env.DISCORD_ADMIN_ROLE_ID && roleId === env.DISCORD_ADMIN_ROLE_ID) {
        await handleAdminRoleChange(discordId, true);
      }
    } catch (err) {
      console.error(`[guildMemberUpdate] Erreur role+ ${roleId} membre ${discordId}:`, err);
    }
  }

  for (const roleId of removedRoles) {
    try {
      await handleRoleRemoved(discordId, roleId);

      if (env.DISCORD_ADMIN_ROLE_ID && roleId === env.DISCORD_ADMIN_ROLE_ID) {
        await handleAdminRoleChange(discordId, false);
      }
    } catch (err) {
      console.error(`[guildMemberUpdate] Erreur role- ${roleId} membre ${discordId}:`, err);
    }
  }
}
