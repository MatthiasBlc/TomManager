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

    const returnTo = typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/")
      ? req.query.returnTo
      : undefined;
    if (returnTo) req.session.oauthReturnTo = returnTo;

    if (req.session.userId) req.session.oauthAction = "link";

    // Skip consent screen if user already has a linked Discord account
    let skipPrompt = false;
    if (req.session.userId) {
      const user = await prisma.user.findFirst({
        where: { id: req.session.userId },
        select: { discordId: true },
      });
      skipPrompt = !!user?.discordId;
    }

    const url = discordService.buildAuthorizeUrl(state, skipPrompt);
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function handleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      return res.redirect(`${FRONTEND_URL}/login?error=discord_denied`);
    }

    if (!state || state !== req.session.oauthState) {
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
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
      return res.redirect(`${FRONTEND_URL}/login?error=discord_token_exchange`);
    }

    const discordUser = await discordService.fetchDiscordUser(accessToken);
    const guildMember = await discordService.fetchGuildMember(accessToken);

    if (!guildMember) {
      return res.redirect(`${FRONTEND_URL}/login?error=not_in_guild`);
    }

    const memberRoles = guildMember.roles;
    const avatarUrl = discordService.buildAvatarUrl(discordUser.id, discordUser.avatar);
    const displayName = guildMember.nick ?? discordUser.global_name ?? discordUser.username;

    if (action === "link" && req.session.userId) {
      return handleLink(req, res, next, discordUser.id, discordUser.username, avatarUrl, memberRoles, returnTo);
    }

    const existing = await prisma.user.findFirst({
      where: { discordId: discordUser.id },
    });

    if (existing) {
      if (existing.deletedAt) {
        return res.redirect(`${FRONTEND_URL}/login?error=account_disabled`);
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: { discordUsername: discordUser.username, avatarUrl },
      });

      await syncAdminRole(existing.id, memberRoles);
      await discordService.syncDiscordParticipations(existing.id, memberRoles);

      req.session.userId = existing.id;
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
    res.redirect(`${FRONTEND_URL}${returnTo}`);
  } catch (err) {
    next(err);
  }
}

async function handleLink(
  req: Request,
  res: Response,
  _next: NextFunction,
  discordId: string,
  discordUsername: string,
  avatarUrl: string,
  memberRoles: string[],
  returnTo: string,
) {
  const conflict = await prisma.user.findFirst({
    where: { discordId },
  });

  if (conflict && conflict.id !== req.session.userId) {
    return res.redirect(`${FRONTEND_URL}${returnTo}?error=discord_already_linked`);
  }

  await prisma.user.update({
    where: { id: req.session.userId },
    data: { discordId, discordUsername, avatarUrl },
  });

  await discordService.syncDiscordParticipations(req.session.userId!, memberRoles);

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
      res.status(400).json({ error: { message: "Cannot unlink Discord from a Discord-only account" } });
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
    await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
  }
}
