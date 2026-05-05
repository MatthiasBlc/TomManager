import { Request, Response, NextFunction } from "express";
import prisma from "../util/db";
import * as discordService from "../services/discordAuth";
import env from "../config/env";

const FRONTEND_URL = env.CORS_ORIGIN;

export async function initiateLogin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!discordService.isDiscordConfigured()) {
      res.status(503).json({ error: { message: "Discord OAuth not configured" } });
      return;
    }

    const state = discordService.generateState();
    req.session.oauthState = state;

    const returnTo =
      typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/")
        ? req.query.returnTo
        : undefined;
    if (returnTo) req.session.oauthReturnTo = returnTo;

    if (req.session.userId) req.session.oauthAction = "link";

    // popup=1 : le callback renverra une page HTML avec postMessage au lieu d'un redirect
    if (req.query.popup === "1") req.session.oauthPopup = true;
    else delete req.session.oauthPopup;

    // prompt=none par defaut : Discord n'affiche la fenetre de consentement qu'a la premiere autorisation.
    // prompt=consent force l'affichage a chaque fois (comportement indesirable).
    const url = discordService.buildAuthorizeUrl(state);
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

// Redirige la popup vers une page frontend dediee qui emet le postMessage
// depuis le bundle React (pas de script inline → pas de probleme CSP).
function sendPopupResponse(res: Response, payload: Record<string, string>) {
  const params = new URLSearchParams(payload).toString();
  res.redirect(`${FRONTEND_URL}/oauth-popup?${params}`);
}

export async function handleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, state, error } = req.query as Record<string, string>;

    const isPopup = !!req.session.oauthPopup;
    delete req.session.oauthPopup;

    const authError = (errorKey: string) => {
      if (isPopup)
        return sendPopupResponse(res, {
          type: "DISCORD_AUTH_ERROR",
          error: errorKey,
        });
      return res.redirect(`${FRONTEND_URL}/login?error=${errorKey}`);
    };

    if (error) {
      return authError("discord_denied");
    }

    if (!state || state !== req.session.oauthState) {
      return authError("invalid_state");
    }
    delete req.session.oauthState;

    const returnTo = req.session.oauthReturnTo ?? "/events";
    const action = req.session.oauthAction;
    delete req.session.oauthReturnTo;
    delete req.session.oauthAction;

    let accessToken: string;
    try {
      accessToken = await discordService.exchangeCode(code);
    } catch {
      return authError("discord_token_exchange");
    }

    const discordUser = await discordService.fetchDiscordUser(accessToken);
    const guildMember = await discordService.fetchGuildMember(accessToken);

    if (!guildMember) {
      return authError("not_in_guild");
    }

    const memberRoles = guildMember.roles;
    const avatarUrl = discordService.buildAvatarUrl(discordUser.id, discordUser.avatar);
    const displayName = guildMember.nick ?? discordUser.global_name ?? discordUser.username;

    if (action === "link" && req.session.userId) {
      return handleLink(
        req,
        res,
        discordUser.id,
        discordUser.username,
        avatarUrl,
        memberRoles,
        returnTo,
        isPopup
      );
    }

    const existing = await prisma.user.findFirst({
      where: { discordId: discordUser.id },
    });

    if (existing) {
      if (existing.deletedAt) {
        return authError("account_disabled");
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: { discordUsername: discordUser.username, avatarUrl, displayName },
      });

      await syncAdminRole(existing.id, memberRoles);
      await discordService.syncDiscordParticipations(existing.id, memberRoles);

      req.session.userId = existing.id;
      if (isPopup) return sendPopupResponse(res, { type: "DISCORD_AUTH_SUCCESS" });
      return res.redirect(`${FRONTEND_URL}${returnTo}`);
    }

    const username = await discordService.generateUniqueUsername(displayName, discordUser.id);

    const user = await prisma.user.create({
      data: {
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        avatarUrl,
        username,
        role: "USER",
      },
    });

    await syncAdminRole(user.id, memberRoles);
    await discordService.syncDiscordParticipations(user.id, memberRoles);

    req.session.userId = user.id;
    if (isPopup) return sendPopupResponse(res, { type: "DISCORD_AUTH_SUCCESS" });
    res.redirect(`${FRONTEND_URL}${returnTo}`);
  } catch (err) {
    next(err);
  }
}

async function handleLink(
  req: Request,
  res: Response,
  discordId: string,
  discordUsername: string,
  avatarUrl: string,
  memberRoles: string[],
  returnTo: string,
  isPopup: boolean
) {
  const conflict = await prisma.user.findFirst({
    where: { discordId },
  });

  if (conflict && conflict.id !== req.session.userId) {
    if (isPopup)
      return sendPopupResponse(res, {
        type: "DISCORD_AUTH_ERROR",
        error: "discord_already_linked",
      });
    return res.redirect(`${FRONTEND_URL}${returnTo}?error=discord_already_linked`);
  }

  await prisma.user.update({
    where: { id: req.session.userId },
    data: { discordId, discordUsername, avatarUrl },
  });

  await discordService.syncDiscordParticipations(req.session.userId!, memberRoles);

  if (isPopup) return sendPopupResponse(res, { type: "DISCORD_AUTH_SUCCESS" });
  return res.redirect(`${FRONTEND_URL}${returnTo}?success=discord_linked`);
}

export async function unlinkDiscord(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.session.userId, deletedAt: null },
    });

    if (!user) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }

    if (!user.passwordHash) {
      res.status(400).json({
        error: {
          message: "Cannot unlink Discord from a Discord-only account",
        },
      });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { discordId: null, discordUsername: null, avatarUrl: null },
    });

    res.json({ message: "Discord unlinked" });
  } catch (err) {
    next(err);
  }
}

async function syncAdminRole(userId: string, memberRoles: string[]): Promise<void> {
  if (!env.DISCORD_ADMIN_ROLE_ID) return;
  if (memberRoles.includes(env.DISCORD_ADMIN_ROLE_ID)) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "ADMIN" },
    });
  }
}
