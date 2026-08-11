import { cleanEnv, num, port, str } from "envalid";

const env = cleanEnv(process.env, {
  PORT: port({ default: 3001 }),
  DATABASE_URL: str(),
  SESSION_SECRET: str(),
  CORS_ORIGIN: str({ default: "http://localhost:3000" }),
  // Nombre de proxys devant le backend, de droite a gauche dans X-Forwarded-For.
  // En prod la chaine est Traefik -> nginx -> backend, donc 2 : avec 1, express
  // resolvait req.ip a l'IP interne de Traefik, identique pour tout le monde, et
  // le rate limiter comptait donc TOUS les utilisateurs dans un seul compteur.
  // 0 (defaut dev/test) = pas de proxy, req.ip = IP de la socket.
  TRUST_PROXY: num({ default: 0 }),
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
  BGG_API_TOKEN: str({ default: "" }),
});

export default env;
