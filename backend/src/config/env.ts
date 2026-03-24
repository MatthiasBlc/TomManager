import { cleanEnv, port, str } from "envalid";

const env = cleanEnv(process.env, {
  PORT: port({ default: 3001 }),
  DATABASE_URL: str(),
  SESSION_SECRET: str(),
  CORS_ORIGIN: str({ default: "http://localhost:3000" }),
  NODE_ENV: str({ choices: ["development", "test", "production"], default: "development" }),
});

export default env;
