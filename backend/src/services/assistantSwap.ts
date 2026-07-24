import prisma from "../util/db";
import createError from "http-errors";
import { emitToEvent } from "../socket/emitter";
import {
  cancelStaleAssistantSwapRequests,
  getEventOr404,
  getOrCreateEventKitchen,
  isKitchenManagerUser,
  USER_SELECT,
} from "./kitchen";
import { getMealDetail } from "./meal";
import { lockMealRowsSorted } from "./mealTransfer";
import { createBulkNotifications, createNotification } from "./notification";

function displayNameOf(user: { displayName: string | null; username: string } | null): string {
  return user?.displayName ?? user?.username ?? "Un équipier";
}

const ASSISTANT_SWAP_INCLUDE = {
  requesterMeal: { select: { id: true, name: true, service: true, startDateTime: true } },
  targetMeal: { select: { id: true, name: true, service: true, startDateTime: true } },
  requester: { select: USER_SELECT },
} as const;

function serializeAssistantSwapRequest(req: {
  id: string;
  status: string;
  createdAt: Date;
  respondedAt: Date | null;
  requester: unknown;
  requesterMeal: unknown;
  targetMeal: unknown;
}) {
  return {
    id: req.id,
    status: req.status,
    createdAt: req.createdAt,
    respondedAt: req.respondedAt,
    requester: req.requester,
    requesterMeal: req.requesterMeal,
    targetMeal: req.targetMeal,
  };
}

async function getPendingAssistantSwapOr404(eventKitchenId: string, id: string) {
  const req = await prisma.assistantSwapRequest.findUnique({ where: { id } });
  if (!req || req.eventKitchenId !== eventKitchenId) {
    throw createError(404, "Assistant swap request not found", {
      code: "ASSISTANT_SWAP_NOT_FOUND",
    });
  }
  if (req.status !== "PENDING") {
    throw createError(409, "Assistant swap request is not pending", {
      code: "ASSISTANT_SWAP_NOT_PENDING",
    });
  }
  return req;
}

// Un equipier demande un echange de creneau avec un repas COMPLET (s'il restait une
// place libre, l'equipier devrait se deplacer directement, cf point 4 Evolutions.md).
// La demande cible un repas, pas une personne : n'importe quel MealAssistant courant
// du repas cible pourra l'accepter (premier arrive, premier servi).
export async function createAssistantSwapRequest(
  eventId: string,
  actingUserId: string,
  targetMealId: string
) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  const requesterAssistant = await prisma.mealAssistant.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: actingUserId } },
  });
  if (!requesterAssistant) {
    throw createError(404, "You are not registered on a meal", { code: "NOT_MEAL_ASSISTANT" });
  }

  const targetMeal = await prisma.meal.findUnique({
    where: { id: targetMealId },
    include: {
      _count: { select: { assistants: true } },
      assistants: { select: { userId: true } },
    },
  });
  if (!targetMeal || targetMeal.eventKitchenId !== eventKitchen.id) {
    throw createError(404, "Target meal not found", { code: "MEAL_NOT_FOUND" });
  }
  if (targetMeal.id === requesterAssistant.mealId) {
    throw createError(400, "Cannot request a swap with your own meal", {
      code: "ASSISTANT_SWAP_SAME_MEAL",
    });
  }
  if (targetMeal._count.assistants < targetMeal.maxAssistants) {
    throw createError(409, "Target meal still has a free seat, move directly instead", {
      code: "TARGET_MEAL_HAS_SEATS",
    });
  }

  const existingPending = await prisma.assistantSwapRequest.findFirst({
    where: { requesterUserId: actingUserId, status: "PENDING" },
  });
  if (existingPending) {
    throw createError(409, "You already have a pending assistant swap request", {
      code: "ASSISTANT_SWAP_ALREADY_PENDING",
    });
  }

  const created = await prisma.assistantSwapRequest.create({
    data: {
      eventKitchenId: eventKitchen.id,
      requesterMealId: requesterAssistant.mealId,
      targetMealId: targetMeal.id,
      requesterUserId: actingUserId,
    },
    include: ASSISTANT_SWAP_INCLUDE,
  });

  emitToEvent(eventId, "kitchen:assistant-swap-changed", { eventId });

  await createBulkNotifications(
    targetMeal.assistants.map((a) => ({
      userId: a.userId,
      type: "KITCHEN_ASSISTANT_SWAP_REQUESTED" as const,
      title: "Demande d'échange de créneau",
      message: `${displayNameOf(created.requester)} aimerait échanger son créneau contre une place sur "${created.targetMeal.name}"`,
      metadata: { eventId, mealId: targetMeal.id, assistantSwapRequestId: created.id },
    }))
  );

  return serializeAssistantSwapRequest(created);
}

export async function listAssistantSwapRequests(eventId: string, userId: string) {
  await getEventOr404(eventId);
  const eventKitchen = await prisma.eventKitchen.findUnique({ where: { eventId } });
  if (!eventKitchen) return [];

  const isManager = await isKitchenManagerUser(userId);
  const myAssistant = await prisma.mealAssistant.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId } },
  });

  const requests = await prisma.assistantSwapRequest.findMany({
    where: {
      eventKitchenId: eventKitchen.id,
      status: "PENDING",
      ...(isManager
        ? {}
        : {
            OR: [
              { requesterUserId: userId },
              ...(myAssistant ? [{ targetMealId: myAssistant.mealId }] : []),
            ],
          }),
    },
    orderBy: { createdAt: "desc" },
    include: ASSISTANT_SWAP_INCLUDE,
  });

  return requests.map(serializeAssistantSwapRequest);
}

// Acceptation par un equipier actuellement inscrit sur le repas cible (n'importe
// lequel, premier arrive premier servi). Echange 1-pour-1 des MealAssistant.mealId,
// capacite-neutre. Revalidation "stale" des DEUX cotes a l'acceptation : ni le
// demandeur ni l'accepteur ne sont fixes cote capacite comme dans l'echange chef, ce
// qui rend cette double verification necessaire ici (l'accepteur n'est connu qu'a
// l'acceptation).
export async function acceptAssistantSwapRequest(
  eventId: string,
  requestId: string,
  actingUserId: string
) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);
  const req = await getPendingAssistantSwapOr404(eventKitchen.id, requestId);

  await prisma.$transaction(async (tx) => {
    await lockMealRowsSorted(tx, req.requesterMealId, req.targetMealId);

    const freshReq = await tx.assistantSwapRequest.findUnique({ where: { id: req.id } });
    if (!freshReq || freshReq.status !== "PENDING") {
      throw createError(409, "Assistant swap request is not pending", {
        code: "ASSISTANT_SWAP_NOT_PENDING",
      });
    }

    const requesterAssistant = await tx.mealAssistant.findUnique({
      where: {
        eventKitchenId_userId: {
          eventKitchenId: eventKitchen.id,
          userId: freshReq.requesterUserId,
        },
      },
    });
    if (!requesterAssistant || requesterAssistant.mealId !== freshReq.requesterMealId) {
      throw createError(409, "Assistant swap request is stale", { code: "ASSISTANT_SWAP_STALE" });
    }
    const accepterAssistant = await tx.mealAssistant.findUnique({
      where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: actingUserId } },
    });
    if (!accepterAssistant || accepterAssistant.mealId !== freshReq.targetMealId) {
      throw createError(403, "You are not currently assigned to the target meal", {
        code: "FORBIDDEN",
      });
    }

    await tx.mealAssistant.update({
      where: { id: requesterAssistant.id },
      data: { mealId: freshReq.targetMealId },
    });
    await tx.mealAssistant.update({
      where: { id: accepterAssistant.id },
      data: { mealId: freshReq.requesterMealId },
    });

    await tx.assistantSwapRequest.update({
      where: { id: freshReq.id },
      data: { status: "ACCEPTED", respondedAt: new Date(), accepterUserId: actingUserId },
    });

    // Nettoyage cascade : si le demandeur ou l'accepteur avait par ailleurs sa
    // propre demande PENDING, elle referencerait desormais un ancien emplacement.
    await cancelStaleAssistantSwapRequests(tx, eventKitchen.id, freshReq.requesterUserId);
    await cancelStaleAssistantSwapRequests(tx, eventKitchen.id, actingUserId);
  });

  emitToEvent(eventId, "kitchen:assistant-changed", { eventId, mealId: req.requesterMealId });
  emitToEvent(eventId, "kitchen:assistant-changed", { eventId, mealId: req.targetMealId });
  emitToEvent(eventId, "kitchen:assistant-swap-changed", { eventId });

  const [requesterMeal, targetMeal, acceptingUser] = await Promise.all([
    getMealDetail(req.requesterMealId),
    getMealDetail(req.targetMealId),
    prisma.user.findUnique({ where: { id: actingUserId }, select: USER_SELECT }),
  ]);

  await createNotification({
    userId: req.requesterUserId,
    type: "KITCHEN_ASSISTANT_SWAP_ACCEPTED",
    title: "Échange de créneau accepté",
    message: `${displayNameOf(acceptingUser)} a accepté d'échanger sa place sur "${targetMeal.name}"`,
    metadata: { eventId, mealId: req.targetMealId, assistantSwapRequestId: req.id },
  });

  return { requesterMeal, targetMeal };
}

export async function cancelAssistantSwapRequest(
  eventId: string,
  requestId: string,
  actingUserId: string
) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);
  const req = await getPendingAssistantSwapOr404(eventKitchen.id, requestId);
  if (req.requesterUserId !== actingUserId) {
    throw createError(403, "Only the requester can cancel this swap", { code: "FORBIDDEN" });
  }

  await prisma.assistantSwapRequest.update({
    where: { id: req.id },
    data: { status: "CANCELLED", respondedAt: new Date() },
  });

  emitToEvent(eventId, "kitchen:assistant-swap-changed", { eventId });

  const updated = await prisma.assistantSwapRequest.findUniqueOrThrow({
    where: { id: req.id },
    include: ASSISTANT_SWAP_INCLUDE,
  });
  return serializeAssistantSwapRequest(updated);
}
