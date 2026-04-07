import { cleanEnv, str } from "envalid";

const env = cleanEnv(process.env, {
  DATABASE_URL: str(),
  DISCORD_BOT_TOKEN: str(),
  DISCORD_GUILD_ID: str(),
  DISCORD_ADMIN_ROLE_ID: str({ default: "" }),
});

export default env;
