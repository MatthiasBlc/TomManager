import { GuildMember, PartialGuildMember } from "discord.js";
import env from "../util/env";
import {
  handleRoleAdded,
  handleRoleRemoved,
  handleAdminRoleChange,
  buildAvatarUrl,
} from "../services/syncParticipation";
import {
  handleChefRoleAdded,
  handleChefRoleRemoved,
  reconcileChefEligibility,
  reconcileChefOnParticipationLost,
} from "../services/syncKitchenChef";

export async function onGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember | PartialGuildMember
): Promise<void> {
  // Fetch complet si partiel (bot hors ligne pendant la mise a jour)
  if (oldMember.partial) oldMember = await oldMember.fetch();
  if (newMember.partial) newMember = await newMember.fetch();
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
      const participationChange = await handleRoleAdded(
        discordId,
        discordUsername,
        avatarUrl,
        roleId
      );
      await handleChefRoleAdded(discordId, roleId);

      // Le role qui vient d'etre ajoute est celui d'un event (participation gagnee) :
      // si le membre detient deja le role chef Discord de cet event, le materialiser
      // immediatement plutot que d'attendre un redemarrage du bot (startupSync).
      if (participationChange) {
        await reconcileChefEligibility(participationChange.eventId, participationChange.userId, [
          ...newRoleIds,
        ]);
      }

      if (env.DISCORD_ADMIN_ROLE_ID && roleId === env.DISCORD_ADMIN_ROLE_ID) {
        await handleAdminRoleChange(discordId, true);
      }
    } catch (err) {
      console.error(`[guildMemberUpdate] Erreur role+ ${roleId} membre ${discordId}:`, err);
    }
  }

  for (const roleId of removedRoles) {
    try {
      const participationChange = await handleRoleRemoved(discordId, roleId);
      await handleChefRoleRemoved(discordId, roleId);

      // Le role qui vient d'etre retire est celui d'un event (participation perdue) :
      // un chef ROLE doit toujours etre participant (spec 7), donc le retirer du roster
      // s'il y etait (le repas eventuel devient orphelin).
      if (participationChange) {
        await reconcileChefOnParticipationLost(
          participationChange.eventId,
          participationChange.userId
        );
      }

      if (env.DISCORD_ADMIN_ROLE_ID && roleId === env.DISCORD_ADMIN_ROLE_ID) {
        await handleAdminRoleChange(discordId, false);
      }
    } catch (err) {
      console.error(`[guildMemberUpdate] Erreur role- ${roleId} membre ${discordId}:`, err);
    }
  }
}
