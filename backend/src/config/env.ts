import { cleanEnv, port, str } from "envalid";

const env = cleanEnv(process.env, {
  PORT: port({ default: 3001 }),
  DATABASE_URL: str(),
  SESSION_SECRET: str(),
  CORS_ORIGIN: str({ default: "http://localhost:3000" }),
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),
  DISCORD_CLIENT_ID: str({ default: "" }),
  DISCORD_CLIENT_SECRET: str({ default: "" }),
  DISCORD_GUILD_ID: str({ default: "" }),
  DISCORD_REDIRECT_URI: str({ default: "" }),
  DISCORD_ADMIN_ROLE_ID: str({ default: "" }),
  DISCORD_BOT_TOKEN: str({ default: "" }),
});

export default env;
