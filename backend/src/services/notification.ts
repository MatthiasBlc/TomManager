import { NotificationType, Prisma } from "@prisma/client";
import prisma from "../util/db";
import createError from "http-errors";
import { emitToUser } from "../socket/emitter";
import logger from "../util/logger";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

// La creation de notification est un effet secondaire : un echec ne doit jamais
// faire echouer l'action metier deja commitee (kick, promotion, etc.)
export async function createNotification(input: CreateNotificationInput) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata ?? undefined,
      },
    });

    emitToUser(input.userId, "notification:new", { notification });

    return notification;
  } catch (err) {
    logger.error({ err, userId: input.userId, type: input.type }, "Failed to create notification");
    return null;
  }
}

export async function createBulkNotifications(inputs: CreateNotificationInput[]) {
  if (inputs.length === 0) return [];

  try {
    const notifications = await prisma.$transaction(
      inputs.map((input) =>
        prisma.notification.create({
          data: {
            userId: input.userId,
            type: input.type,
            title: input.title,
            message: input.message,
            metadata: input.metadata ?? undefined,
          },
        })
      )
    );

    for (const notification of notifications) {
      emitToUser(notification.userId, "notification:new", { notification });
    }

    return notifications;
  } catch (err) {
    logger.error({ err, count: inputs.length }, "Failed to create bulk notifications");
    return [];
  }
}

export async function getNotifications(
  userId: string,
  options: { cursor?: string; limit?: number; unreadOnly?: boolean } = {}
) {
  const { cursor, limit = 20, unreadOnly } = options;
  const take = Math.min(limit, 50);

  const where: Record<string, unknown> = { userId };
  if (unreadOnly) {
    where.read = false;
  }

  // Cursor-based pagination
  const findOptions: Parameters<typeof prisma.notification.findMany>[0] = {
    where,
    take: take + 1,
    orderBy: { createdAt: "desc" },
  };

  if (cursor) {
    findOptions.cursor = { id: cursor };
    findOptions.skip = 1;
  }

  const notifications = await prisma.notification.findMany(findOptions);

  const hasMore = notifications.length > take;
  const data = hasMore ? notifications.slice(0, take) : notifications;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor };
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

export async function markAsRead(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });

  if (!notification) {
    throw createError(404, "Notification not found", { code: "NOTIFICATION_NOT_FOUND" });
  }
  if (notification.userId !== userId) {
    throw createError(403, "Forbidden", { code: "FORBIDDEN" });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true, readAt: new Date() },
  });

  // Synchronise les autres appareils/onglets du meme utilisateur
  emitToUser(userId, "notification:read", { id });

  return updated;
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });

  emitToUser(userId, "notification:read-all", {});

  return result.count;
}

export async function deleteNotification(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });

  if (!notification) {
    throw createError(404, "Notification not found", { code: "NOTIFICATION_NOT_FOUND" });
  }
  if (notification.userId !== userId) {
    throw createError(403, "Forbidden", { code: "FORBIDDEN" });
  }

  await prisma.notification.delete({ where: { id } });

  emitToUser(userId, "notification:deleted", { id });
}
