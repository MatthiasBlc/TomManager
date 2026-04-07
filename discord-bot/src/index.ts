import { Client, Events, GatewayIntentBits } from "discord.js";
import env from "./util/env";
import prisma from "./util/db";
import { onGuildMemberUpdate } from "./handlers/guildMemberUpdate";
import { startupSync } from "./services/startupSync";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Privileged intent — activer dans Discord Developer Portal
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] Connecte en tant que ${c.user.tag}`);

  const guild = c.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    console.error(`[bot] Guild ${env.DISCORD_GUILD_ID} introuvable. Verifier DISCORD_GUILD_ID et que le bot est dans le serveur.`);
    return;
  }

  await startupSync(guild);
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (newMember.guild.id !== env.DISCORD_GUILD_ID) return;
  await onGuildMemberUpdate(oldMember, newMember);
});

client.on(Events.Error, (err) => {
  console.error("[bot] Erreur Discord:", err);
});

async function shutdown() {
  console.log("[bot] Arret...");
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

client.login(env.DISCORD_BOT_TOKEN).catch((err) => {
  console.error("[bot] Echec de connexion:", err);
  process.exit(1);
});
