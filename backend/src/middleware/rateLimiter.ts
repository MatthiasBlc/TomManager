import rateLimit from "express-rate-limit";
import env from "../config/env";

const skipInTest = () => env.NODE_ENV === "test" || process.env.ENABLE_TEST_ROUTES === "true";

// Auth : 10 tentatives / 15 min
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many attempts, please try again later" } },
  skip: skipInTest,
});

// Global API : 300 req / min par IP.
// Ces plafonds visent l'abus, pas l'usage intensif : une page evenement se
// rafraichit sur socket (temps reel), donc une seule action d'un chef declenche
// deja plusieurs GET chez chaque client connecte, et plusieurs personnes peuvent
// partager la meme IP (wifi du lieu, NAT mobile). 100/min etait sous ce plancher
// legitime : la saisie d'une recette suffisait a declencher des 429 en cascade,
// jusque sur /api/auth/me (retour prod, cf docs/features/KitchenRecipeNotes).
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many requests, please slow down" } },
  skip: skipInTest,
});

// Ecritures (POST/PATCH/DELETE) : 120 req / min par IP.
// L'edition de fiche repas est en auto-save debounce : remplir une recette de 15
// ingredients emet legitimement plusieurs dizaines de PATCH d'affilee.
export const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many write requests, please slow down" } },
  skip: (req) => skipInTest() || !["POST", "PATCH", "DELETE"].includes(req.method),
});
