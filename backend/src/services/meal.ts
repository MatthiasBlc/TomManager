import prisma from "../util/db";
import createError from "http-errors";
import { emitToEvent } from "../socket/emitter";
import {
  assertParticipant,
  cancelStaleAssistantSwapRequests,
  getEventOr404,
  getOrCreateEventKitchen,
  isKitchenManagerUser,
  USER_SELECT,
} from "./kitchen";
import { findOrCreateProducts } from "./product";
import { findOrCreateUtensils } from "./utensil";
import { lockMealRow, type TxClient } from "./mealTransfer";
import { createBulkNotifications, createNotification } from "./notification";

function displayNameOf(user: { displayName: string | null; username: string } | null): string {
  return user?.displayName ?? user?.username ?? "Un chef";
}

interface IngredientInput {
  name: string;
  quantity: number;
  unit: "G" | "KG" | "ML" | "CL" | "L" | "CAS" | "CAC" | "PIECE";
}

interface UtensilInput {
  name: string;
}

interface UpdateMealInput {
  chefUserId?: string | null;
  name?: string;
  service?: "LUNCH" | "DINNER";
  startDateTime?: string;
  endDateTime?: string;
  maxAssistants?: number;
  vegeCount?: number;
  carneCount?: number;
  ingredients?: IngredientInput[];
  utensils?: UtensilInput[];
}

const MEAL_INCLUDE = {
  chef: { select: USER_SELECT },
  ingredients: true,
  utensils: true,
  assistants: { include: { user: { select: USER_SELECT } } },
} as const;

function serializeMeal(meal: {
  id: string;
  name: string;
  service: string;
  startDateTime: Date;
  endDateTime: Date;
  maxAssistants: number;
  vegeCount: number;
  carneCount: number;
  chef: unknown;
  ingredients: unknown[];
  utensils: unknown[];
  assistants: { user: unknown }[];
}) {
  return {
    id: meal.id,
    name: meal.name,
    service: meal.service,
    startDateTime: meal.startDateTime,
    endDateTime: meal.endDateTime,
    maxAssistants: meal.maxAssistants,
    vegeCount: meal.vegeCount,
    carneCount: meal.carneCount,
    chef: meal.chef,
    ingredients: meal.ingredients,
    utensils: meal.utensils,
    assistants: meal.assistants.map((a) => a.user),
    remainingSeats: Math.max(0, meal.maxAssistants - meal.assistants.length),
  };
}

export async function getMealDetail(mealId: string) {
  const meal = await prisma.meal.findUnique({ where: { id: mealId }, include: MEAL_INCLUDE });
  if (!meal) {
    throw createError(404, "Meal not found", { code: "MEAL_NOT_FOUND" });
  }
  return serializeMeal(meal);
}

async function assertBoundsAndOrder(eventId: string, start: Date, end: Date) {
  const event = await getEventOr404(eventId);
  if (isNaN(start.getTime())) {
    throw createError(400, "Invalid startDateTime", { code: "INVALID_START_DATETIME" });
  }
  if (isNaN(end.getTime())) {
    throw createError(400, "Invalid endDateTime", { code: "INVALID_END_DATETIME" });
  }
  if (end <= start) {
    throw createError(400, "endDateTime must be after startDateTime", { code: "END_BEFORE_START" });
  }
  if (start < event.startDateTime) {
    throw createError(400, "Meal startDateTime must be within event bounds", {
      code: "MEAL_START_OUT_OF_BOUNDS",
    });
  }
  if (end > event.endDateTime) {
    throw createError(400, "Meal endDateTime must be within event bounds", {
      code: "MEAL_END_OUT_OF_BOUNDS",
    });
  }
}

async function replaceIngredientsAndUtensils(
  tx: TxClient,
  mealId: string,
  ingredients: IngredientInput[] | undefined,
  utensils: UtensilInput[] | undefined
) {
  if (ingredients !== undefined) {
    await tx.mealIngredient.deleteMany({ where: { mealId } });
    if (ingredients.length > 0) {
      const products = await findOrCreateProducts(
        ingredients.map((i) => i.name),
        tx
      );
      const productByName = new Map(products.map((p) => [p.name, p]));
      await tx.mealIngredient.createMany({
        data: ingredients.map((i) => ({
          mealId,
          productId: productByName.get(i.name.trim().toLowerCase())?.id ?? null,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
        })),
      });
    }
  }

  if (utensils !== undefined) {
    await tx.mealUtensil.deleteMany({ where: { mealId } });
    if (utensils.length > 0) {
      const catalog = await findOrCreateUtensils(
        utensils.map((u) => u.name),
        tx
      );
      const utensilByName = new Map(catalog.map((u) => [u.name, u]));
      await tx.mealUtensil.createMany({
        data: utensils.map((u) => ({
          mealId,
          utensilId: utensilByName.get(u.name.trim().toLowerCase())?.id ?? null,
          name: u.name,
        })),
      });
    }
  }
}

export async function updateMeal(
  eventId: string,
  mealId: string,
  actingUserId: string,
  data: UpdateMealInput
) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  const meal = await prisma.meal.findUnique({ where: { id: mealId } });
  if (!meal || meal.eventKitchenId !== eventKitchen.id) {
    throw createError(404, "Meal not found", { code: "MEAL_NOT_FOUND" });
  }

  const isManager = await isKitchenManagerUser(actingUserId);
  const isOwner = meal.chefUserId === actingUserId;

  // Champs structurants (chef, capacite, horaires, service, repartition vege/carne)
  // reserves au manager : ils definissent la grille generee ; le chef n'edite que
  // name/ingredients/utensils.
  const touchesManagerOnly =
    data.maxAssistants !== undefined ||
    data.vegeCount !== undefined ||
    data.carneCount !== undefined ||
    data.chefUserId !== undefined ||
    data.startDateTime !== undefined ||
    data.endDateTime !== undefined ||
    data.service !== undefined;
  if (touchesManagerOnly && !isManager) {
    throw createError(
      403,
      "Only a kitchen manager can change the chef, capacity, schedule, service or diet split",
      { code: "FORBIDDEN" }
    );
  }
  if (!isManager && !isOwner) {
    throw createError(403, "Only the meal chef or a kitchen manager can edit this meal", {
      code: "FORBIDDEN",
    });
  }

  let targetChefUserId: string | null | undefined = undefined;
  if (data.chefUserId !== undefined) {
    if (meal.chefUserId !== null) {
      throw createError(400, "This meal already has a chef", { code: "MEAL_NOT_ORPHAN" });
    }
    if (data.chefUserId !== null) {
      const chefRow = await prisma.kitchenChef.findUnique({
        where: {
          eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: data.chefUserId },
        },
      });
      if (!chefRow) {
        throw createError(400, "Target user is not in the chef roster", {
          code: "NOT_IN_CHEF_ROSTER",
        });
      }
      const existingMeal = await prisma.meal.findUnique({
        where: {
          eventKitchenId_chefUserId: {
            eventKitchenId: eventKitchen.id,
            chefUserId: data.chefUserId,
          },
        },
      });
      if (existingMeal) {
        throw createError(409, "This chef already has a meal", { code: "MEAL_ALREADY_EXISTS" });
      }
    }
    targetChefUserId = data.chefUserId;
  }

  const start = data.startDateTime ? new Date(data.startDateTime) : meal.startDateTime;
  const end = data.endDateTime ? new Date(data.endDateTime) : meal.endDateTime;
  if (data.startDateTime || data.endDateTime) {
    await assertBoundsAndOrder(eventId, start, end);
  }

  await prisma.$transaction(async (tx) => {
    await tx.meal.update({
      where: { id: mealId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.service !== undefined ? { service: data.service } : {}),
        ...(data.startDateTime !== undefined ? { startDateTime: start } : {}),
        ...(data.endDateTime !== undefined ? { endDateTime: end } : {}),
        ...(data.maxAssistants !== undefined ? { maxAssistants: data.maxAssistants } : {}),
        ...(data.vegeCount !== undefined ? { vegeCount: data.vegeCount } : {}),
        ...(data.carneCount !== undefined ? { carneCount: data.carneCount } : {}),
        ...(targetChefUserId !== undefined ? { chefUserId: targetChefUserId } : {}),
      },
    });
    await replaceIngredientsAndUtensils(tx, mealId, data.ingredients, data.utensils);
  });

  emitToEvent(eventId, "kitchen:meal-changed", { eventId, mealId });

  // Notif au chef du repas quand la repartition vege/carne change reellement (y compris
  // depuis la valeur par defaut 0/0) : le responsable est seul a pouvoir l'editer, le
  // chef doit savoir combien preparer. Aucune notif sur un repas orphelin (pas de chef),
  // ni quand le responsable qui edite est lui-meme le chef du repas : il connait deja la
  // valeur qu'il vient de saisir (meme regle que KITCHEN_OVERCAPACITY).
  const newVegeCount = data.vegeCount !== undefined ? data.vegeCount : meal.vegeCount;
  const newCarneCount = data.carneCount !== undefined ? data.carneCount : meal.carneCount;
  const dietSplitChanged =
    (data.vegeCount !== undefined && data.vegeCount !== meal.vegeCount) ||
    (data.carneCount !== undefined && data.carneCount !== meal.carneCount);
  if (dietSplitChanged && meal.chefUserId && meal.chefUserId !== actingUserId) {
    await createNotification({
      userId: meal.chefUserId,
      type: "KITCHEN_DIET_SPLIT_UPDATED",
      title: "Répartition végé/carné mise à jour",
      message: `Ton repas "${meal.name}" passe de ${meal.vegeCount} végé / ${meal.carneCount} carné à ${newVegeCount} végé / ${newCarneCount} carné.`,
      metadata: { eventId, mealId },
    });
  }

  return getMealDetail(mealId);
}

export async function deleteMeal(eventId: string, mealId: string) {
  const eventKitchen = await getOrCreateEventKitchen(eventId);
  const meal = await prisma.meal.findUnique({ where: { id: mealId } });
  if (!meal || meal.eventKitchenId !== eventKitchen.id) {
    throw createError(404, "Meal not found", { code: "MEAL_NOT_FOUND" });
  }

  await prisma.meal.delete({ where: { id: mealId } });

  emitToEvent(eventId, "kitchen:meal-changed", { eventId, mealId });
}

// Un chef du roster reclame un creneau orphelin de la grille generee. Le verrou de
// ligne serialise deux reclamations concurrentes sur le meme creneau (le 2e voit le
// creneau deja pris).
export async function claimMeal(eventId: string, mealId: string, chefUserId: string) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  const chefRow = await prisma.kitchenChef.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: chefUserId } },
  });
  if (!chefRow) {
    throw createError(403, "You are not in the chef roster", { code: "NOT_IN_CHEF_ROSTER" });
  }

  await prisma.$transaction(async (tx) => {
    await lockMealRow(tx, mealId);
    const meal = await tx.meal.findUnique({ where: { id: mealId } });
    if (!meal || meal.eventKitchenId !== eventKitchen.id) {
      throw createError(404, "Meal not found", { code: "MEAL_NOT_FOUND" });
    }
    if (meal.chefUserId !== null) {
      throw createError(409, "This meal already has a chef", { code: "MEAL_ALREADY_CLAIMED" });
    }
    const existingMeal = await tx.meal.findUnique({
      where: {
        eventKitchenId_chefUserId: { eventKitchenId: eventKitchen.id, chefUserId },
      },
    });
    if (existingMeal) {
      throw createError(409, "You already have a meal", { code: "CHEF_ALREADY_HAS_MEAL" });
    }
    await tx.meal.update({ where: { id: mealId }, data: { chefUserId } });
  });

  emitToEvent(eventId, "kitchen:meal-changed", { eventId, mealId });

  const detail = await getMealDetail(mealId);

  const existingAssistants = await prisma.mealAssistant.findMany({
    where: { mealId },
    select: { userId: true },
  });
  if (existingAssistants.length > 0) {
    const chef = await prisma.user.findUnique({ where: { id: chefUserId }, select: USER_SELECT });
    await createBulkNotifications(
      existingAssistants.map((a) => ({
        userId: a.userId,
        type: "KITCHEN_MEAL_CLAIMED" as const,
        title: "Un chef a rejoint votre repas",
        message: `${displayNameOf(chef)} est désormais le chef du repas "${detail.name}" auquel vous participez`,
        metadata: { eventId, mealId },
      }))
    );
  }

  return detail;
}

export async function joinOrMoveMeal(eventId: string, mealId: string, userId: string) {
  const eventKitchen = await getOrCreateEventKitchen(eventId);
  await assertParticipant(eventId, userId);

  const isChef = await prisma.kitchenChef.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId } },
  });
  if (isChef) {
    throw createError(409, "Chefs cannot register as an assistant", { code: "ROLE_EXCLUSIVITY" });
  }
  const isCoursesMember = await prisma.kitchenCoursesMember.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId } },
  });
  if (isCoursesMember) {
    throw createError(409, "Courses team members cannot register as an assistant", {
      code: "ROLE_EXCLUSIVITY",
    });
  }

  await prisma.$transaction(async (tx) => {
    await lockMealRow(tx, mealId);
    const meal = await tx.meal.findUnique({ where: { id: mealId }, include: { assistants: true } });
    if (!meal || meal.eventKitchenId !== eventKitchen.id) {
      throw createError(404, "Meal not found", { code: "MEAL_NOT_FOUND" });
    }

    if (meal.assistants.some((a) => a.userId === userId)) {
      throw createError(409, "Already registered on this meal", { code: "ALREADY_MEAL_ASSISTANT" });
    }
    if (meal.assistants.length >= meal.maxAssistants) {
      throw createError(409, "Meal is full", { code: "MEAL_FULL" });
    }

    // "Se deplacer" = quitter + rejoindre dans la meme transaction (rollback si dest pleine)
    await tx.mealAssistant.deleteMany({ where: { eventKitchenId: eventKitchen.id, userId } });
    await tx.mealAssistant.create({
      data: { mealId, eventKitchenId: eventKitchen.id, userId },
    });
    // L'ancien emplacement referme par une demande d'echange equipier en attente
    // (point 4, Evolutions.md) : elle n'a plus de sens, quel que soit le chemin
    // (auto-deplacement ou reassignation manager).
    await cancelStaleAssistantSwapRequests(tx, eventKitchen.id, userId);
  });

  emitToEvent(eventId, "kitchen:assistant-changed", { eventId, mealId });

  return getMealDetail(mealId);
}

export async function leaveMeal(eventId: string, mealId: string, userId: string) {
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  const assistant = await prisma.mealAssistant.findUnique({
    where: { mealId_userId: { mealId, userId } },
  });
  if (!assistant || assistant.eventKitchenId !== eventKitchen.id) {
    throw createError(404, "Not registered on this meal", { code: "NOT_MEAL_ASSISTANT" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.mealAssistant.delete({ where: { id: assistant.id } });
    await cancelStaleAssistantSwapRequests(tx, eventKitchen.id, userId);
  });

  emitToEvent(eventId, "kitchen:assistant-changed", { eventId, mealId });
}
