import prisma from "../util/db";
import createError from "http-errors";
import { emitToEvent } from "../socket/emitter";
import {
  getEventOr404,
  getOrCreateEventKitchen,
  isKitchenManagerUser,
  USER_SELECT,
} from "./kitchen";
import { getMealDetail } from "./meal";
import { lockMealRowsSorted, swapRecipesByPk } from "./mealTransfer";

const SWAP_INCLUDE = {
  requesterMeal: { select: { id: true, name: true, service: true, startDateTime: true } },
  targetMeal: { select: { id: true, name: true, service: true, startDateTime: true } },
  requester: { select: USER_SELECT },
  target: { select: USER_SELECT },
} as const;

async function serializeSwapRequest(id: string) {
  const req = await prisma.mealSwapRequest.findUnique({ where: { id }, include: SWAP_INCLUDE });
  if (!req) throw createError(404, "Swap request not found", { code: "SWAP_NOT_FOUND" });
  return {
    id: req.id,
    status: req.status,
    createdAt: req.createdAt,
    respondedAt: req.respondedAt,
    requester: req.requester,
    target: req.target,
    requesterMeal: req.requesterMeal,
    targetMeal: req.targetMeal,
  };
}

// Un chef proprietaire d'un repas propose d'echanger son creneau avec celui d'un
// autre chef. L'echange n'est effectif qu'apres acceptation de la cible.
export async function createSwapRequest(
  eventId: string,
  actingUserId: string,
  targetMealId: string
) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  const requesterMeal = await prisma.meal.findUnique({
    where: {
      eventKitchenId_chefUserId: { eventKitchenId: eventKitchen.id, chefUserId: actingUserId },
    },
  });
  if (!requesterMeal) {
    throw createError(404, "You do not own a meal to swap", { code: "NOT_A_CHEF_WITH_MEAL" });
  }

  const targetMeal = await prisma.meal.findUnique({ where: { id: targetMealId } });
  if (!targetMeal || targetMeal.eventKitchenId !== eventKitchen.id) {
    throw createError(404, "Target meal not found", { code: "MEAL_NOT_FOUND" });
  }
  if (targetMeal.id === requesterMeal.id || targetMeal.chefUserId === actingUserId) {
    throw createError(400, "Cannot swap a meal with itself", { code: "SWAP_SAME_MEAL" });
  }
  if (!targetMeal.chefUserId) {
    throw createError(400, "Target meal has no chef to swap with", { code: "TARGET_MEAL_ORPHAN" });
  }

  const existingPending = await prisma.mealSwapRequest.findFirst({
    where: {
      status: "PENDING",
      OR: [
        { requesterMealId: requesterMeal.id },
        { targetMealId: requesterMeal.id },
        { requesterMealId: targetMeal.id },
        { targetMealId: targetMeal.id },
      ],
    },
  });
  if (existingPending) {
    throw createError(409, "A swap request is already pending on one of these meals", {
      code: "SWAP_ALREADY_PENDING",
    });
  }

  const created = await prisma.mealSwapRequest.create({
    data: {
      eventKitchenId: eventKitchen.id,
      requesterMealId: requesterMeal.id,
      targetMealId: targetMeal.id,
      requesterUserId: actingUserId,
      targetUserId: targetMeal.chefUserId,
    },
  });

  emitToEvent(eventId, "kitchen:swap-request-changed", { eventId });

  return serializeSwapRequest(created.id);
}

export async function listSwapRequests(eventId: string, userId: string) {
  await getEventOr404(eventId);
  const eventKitchen = await prisma.eventKitchen.findUnique({ where: { eventId } });
  if (!eventKitchen) return [];

  const isManager = await isKitchenManagerUser(userId);
  const requests = await prisma.mealSwapRequest.findMany({
    where: {
      eventKitchenId: eventKitchen.id,
      status: "PENDING",
      ...(isManager ? {} : { OR: [{ requesterUserId: userId }, { targetUserId: userId }] }),
    },
    orderBy: { createdAt: "desc" },
    include: SWAP_INCLUDE,
  });

  return requests.map((req) => ({
    id: req.id,
    status: req.status,
    createdAt: req.createdAt,
    respondedAt: req.respondedAt,
    requester: req.requester,
    target: req.target,
    requesterMeal: req.requesterMeal,
    targetMeal: req.targetMeal,
  }));
}

async function getPendingOr404(eventKitchenId: string, swapRequestId: string) {
  const req = await prisma.mealSwapRequest.findUnique({ where: { id: swapRequestId } });
  if (!req || req.eventKitchenId !== eventKitchenId) {
    throw createError(404, "Swap request not found", { code: "SWAP_NOT_FOUND" });
  }
  if (req.status !== "PENDING") {
    throw createError(409, "Swap request is not pending", { code: "SWAP_NOT_PENDING" });
  }
  return req;
}

// Acceptation (par la cible) : la recette (name + ingredients + ustensiles) et le chef
// suivent dans l'echange ; les equipiers (MealAssistant), les horaires, le service et
// la capacite restent attaches au creneau d'origine.
export async function acceptSwapRequest(
  eventId: string,
  swapRequestId: string,
  actingUserId: string
) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);
  const req = await getPendingOr404(eventKitchen.id, swapRequestId);

  if (req.targetUserId !== actingUserId) {
    throw createError(403, "Only the target chef can accept this swap", { code: "FORBIDDEN" });
  }

  await prisma.$transaction(async (tx) => {
    // Verrous dans un ordre deterministe pour eviter les deadlocks croises.
    await lockMealRowsSorted(tx, req.requesterMealId, req.targetMealId);

    const requesterMeal = await tx.meal.findUnique({ where: { id: req.requesterMealId } });
    const targetMeal = await tx.meal.findUnique({ where: { id: req.targetMealId } });
    if (
      !requesterMeal ||
      !targetMeal ||
      requesterMeal.eventKitchenId !== eventKitchen.id ||
      targetMeal.eventKitchenId !== eventKitchen.id
    ) {
      throw createError(404, "Meal not found", { code: "MEAL_NOT_FOUND" });
    }
    // Detection d'obsolescence : un chef a change entre-temps (ex. reassignation manager).
    if (
      requesterMeal.chefUserId !== req.requesterUserId ||
      targetMeal.chefUserId !== req.targetUserId
    ) {
      throw createError(409, "Swap request is stale", { code: "SWAP_STALE" });
    }

    const requesterName = requesterMeal.name;
    const targetName = targetMeal.name;

    // 1. Libere les deux chefUserId (etat null intermediaire) : la contrainte unique
    //    [eventKitchenId, chefUserId] interdit que deux lignes portent le meme chef,
    //    meme transitoirement, dans la transaction.
    await tx.meal.update({ where: { id: requesterMeal.id }, data: { chefUserId: null } });
    await tx.meal.update({ where: { id: targetMeal.id }, data: { chefUserId: null } });

    // 2. Reaffecte le chef croise + deplace le nom (recette).
    await tx.meal.update({
      where: { id: requesterMeal.id },
      data: { chefUserId: req.targetUserId, name: targetName },
    });
    await tx.meal.update({
      where: { id: targetMeal.id },
      data: { chefUserId: req.requesterUserId, name: requesterName },
    });

    // 3. Deplace ingredients & ustensiles (echange croise, capture des PK AVANT tout
    //    mouvement, cf commentaire de swapRecipesByPk).
    await swapRecipesByPk(tx, requesterMeal.id, targetMeal.id);

    await tx.mealSwapRequest.update({
      where: { id: req.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    // Defense en profondeur : annule toute autre demande PENDING sur ces deux repas.
    await tx.mealSwapRequest.updateMany({
      where: {
        id: { not: req.id },
        status: "PENDING",
        OR: [
          { requesterMealId: { in: [requesterMeal.id, targetMeal.id] } },
          { targetMealId: { in: [requesterMeal.id, targetMeal.id] } },
        ],
      },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
  });

  emitToEvent(eventId, "kitchen:meal-changed", { eventId, mealId: req.requesterMealId });
  emitToEvent(eventId, "kitchen:meal-changed", { eventId, mealId: req.targetMealId });
  emitToEvent(eventId, "kitchen:swap-request-changed", { eventId });

  const [requesterMeal, targetMeal] = await Promise.all([
    getMealDetail(req.requesterMealId),
    getMealDetail(req.targetMealId),
  ]);
  return { requesterMeal, targetMeal };
}

export async function rejectSwapRequest(
  eventId: string,
  swapRequestId: string,
  actingUserId: string
) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);
  const req = await getPendingOr404(eventKitchen.id, swapRequestId);

  if (req.targetUserId !== actingUserId) {
    throw createError(403, "Only the target chef can reject this swap", { code: "FORBIDDEN" });
  }

  await prisma.mealSwapRequest.update({
    where: { id: req.id },
    data: { status: "REJECTED", respondedAt: new Date() },
  });

  emitToEvent(eventId, "kitchen:swap-request-changed", { eventId });

  return serializeSwapRequest(req.id);
}

export async function cancelSwapRequest(
  eventId: string,
  swapRequestId: string,
  actingUserId: string
) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);
  const req = await getPendingOr404(eventKitchen.id, swapRequestId);

  if (req.requesterUserId !== actingUserId) {
    throw createError(403, "Only the requester can cancel this swap", { code: "FORBIDDEN" });
  }

  await prisma.mealSwapRequest.update({
    where: { id: req.id },
    data: { status: "CANCELLED", respondedAt: new Date() },
  });

  emitToEvent(eventId, "kitchen:swap-request-changed", { eventId });

  return serializeSwapRequest(req.id);
}
