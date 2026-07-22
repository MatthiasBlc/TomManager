import prisma from "../util/db";
import createError from "http-errors";
import logger from "../util/logger";
import { emitToEvent } from "../socket/emitter";
import { getLocalUserIdsForDiscordRole } from "./adminSync";
import { computeEventConflicts } from "./conflicts";
import type { TxClient } from "./mealTransfer";

export const USER_SELECT = { id: true, username: true, displayName: true } as const;

type KitchenRole = "manager" | "chef" | "equipier" | "none";

interface UpdateConfigInput {
  chefRoleId?: string | null;
  allergiesNotes?: string | null;
  equipierPlanningEnabled?: boolean;
}

// Annule toute demande d'echange equipier PENDING dont `userId` est le demandeur : a
// appeler dans la MEME transaction que toute suppression/deplacement de son
// MealAssistant (leave, move, retrait manager, auto-desinscription role cuisine —
// point 4, Evolutions.md). Un demandeur n'a qu'une demande PENDING a la fois, donc
// "annuler la mienne" = "annuler celle qui referencait mon ancien emplacement".
export async function cancelStaleAssistantSwapRequests(
  tx: TxClient,
  eventKitchenId: string,
  userId: string
) {
  await tx.assistantSwapRequest.updateMany({
    where: { eventKitchenId, requesterUserId: userId, status: "PENDING" },
    data: { status: "CANCELLED", respondedAt: new Date() },
  });
}

export async function getEventOr404(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw createError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
  }
  return event;
}

export async function getOrCreateEventKitchen(eventId: string) {
  const existing = await prisma.eventKitchen.findUnique({ where: { eventId } });
  if (existing) return existing;
  return prisma.eventKitchen.create({ data: { eventId } });
}

async function isEventParticipant(eventId: string, userId: string) {
  const participation = await prisma.eventParticipation.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  return participation !== null;
}

async function isKitchenManager(userId: string, isAdmin: boolean) {
  if (!isAdmin) return false;
  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key: "admin.kitchen" } },
  });
  return pref?.value === true;
}

export async function isKitchenManagerUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  return isKitchenManager(userId, user?.role === "ADMIN");
}

// Reconstruit le roster ROLE d'un EventKitchen depuis les membres actuels de la
// guilde possedant le chefRoleId. Un chef ROLE non-survivant (role Discord perdu
// ou plus participant) est retire du roster ; son repas eventuel devient orphelin.
// Un nouveau chef ROLE preempte silencieusement ses appartenances courses/equipier.
export async function syncChefRoleRoster(
  eventKitchenId: string,
  eventId: string,
  chefRoleId: string
) {
  const holderUserIds = await getLocalUserIdsForDiscordRole(chefRoleId);

  const participants = await prisma.eventParticipation.findMany({
    where: { eventId, userId: { in: holderUserIds } },
    select: { userId: true },
  });
  const qualifying = new Set(participants.map((p) => p.userId));

  const currentRoleChefs = await prisma.kitchenChef.findMany({
    where: { eventKitchenId, source: "ROLE" },
  });
  const currentRoleUserIds = new Set(currentRoleChefs.map((c) => c.userId));

  const toRemove = currentRoleChefs.filter((c) => !qualifying.has(c.userId));
  const toAdd = [...qualifying].filter((userId) => !currentRoleUserIds.has(userId));

  await prisma.$transaction(async (tx) => {
    for (const chef of toRemove) {
      await tx.kitchenChef.delete({ where: { id: chef.id } });
      await tx.meal.updateMany({
        where: { eventKitchenId, chefUserId: chef.userId },
        data: { chefUserId: null },
      });
    }
    for (const userId of toAdd) {
      await tx.kitchenChef.create({ data: { eventKitchenId, userId, source: "ROLE" } });
      await tx.kitchenCoursesMember.deleteMany({ where: { eventKitchenId, userId } });
      await tx.mealAssistant.deleteMany({ where: { eventKitchenId, userId } });
      await cancelStaleAssistantSwapRequests(tx, eventKitchenId, userId);
    }
  });

  return { added: toAdd.length, removed: toRemove.length };
}

export async function updateConfig(eventId: string, userId: string, data: UpdateConfigInput) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  const settingRole = data.chefRoleId !== undefined && data.chefRoleId !== null;

  const updated = await prisma.$transaction(async (tx) => {
    if (settingRole) {
      // Ecrasement MANUAL -> ROLE : orpheline les repas des chefs manuels retires
      const manualChefs = await tx.kitchenChef.findMany({
        where: { eventKitchenId: eventKitchen.id, source: "MANUAL" },
      });
      for (const chef of manualChefs) {
        await tx.meal.updateMany({
          where: { eventKitchenId: eventKitchen.id, chefUserId: chef.userId },
          data: { chefUserId: null },
        });
      }
      await tx.kitchenChef.deleteMany({
        where: { eventKitchenId: eventKitchen.id, source: "MANUAL" },
      });
    }

    return tx.eventKitchen.update({
      where: { id: eventKitchen.id },
      data: {
        ...(data.chefRoleId !== undefined ? { chefRoleId: data.chefRoleId } : {}),
        ...(data.allergiesNotes !== undefined ? { allergiesNotes: data.allergiesNotes } : {}),
        ...(data.equipierPlanningEnabled !== undefined
          ? { equipierPlanningEnabled: data.equipierPlanningEnabled }
          : {}),
      },
    });
  });

  if (settingRole) {
    try {
      await syncChefRoleRoster(updated.id, eventId, data.chefRoleId!);
    } catch (err) {
      logger.warn({ err, eventId }, "Kitchen: sync initial du roster chef par role impossible");
    }
  }

  emitToEvent(eventId, "kitchen:config-updated", { eventId });

  return getKitchenView(eventId, userId);
}

export async function assertParticipant(eventId: string, userId: string) {
  const participant = await isEventParticipant(eventId, userId);
  if (!participant) {
    throw createError(400, "Target user is not an event participant", {
      code: "NOT_EVENT_PARTICIPANT",
    });
  }
}

// Pool d'equipiers disponibles pour la repartition des capacites (section 4 Admin
// Chef) : participants totaux moins chefs moins equipe courses. Reutilise par
// generatePlanning (kitchenPlanning.ts) pour eviter de dupliquer les 3 counts.
export async function computeAvailablePool(
  eventId: string,
  eventKitchenId: string
): Promise<number> {
  const [participantCount, chefCount, coursesCount] = await Promise.all([
    prisma.eventParticipation.count({ where: { eventId } }),
    prisma.kitchenChef.count({ where: { eventKitchenId } }),
    prisma.kitchenCoursesMember.count({ where: { eventKitchenId } }),
  ]);
  return participantCount - chefCount - coursesCount;
}

export async function addManualChef(eventId: string, actingUserId: string, targetUserId: string) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  if (eventKitchen.chefRoleId) {
    throw createError(400, "Chef roster is managed by Discord role", {
      code: "CHEF_ROLE_MODE_ACTIVE",
    });
  }

  await assertParticipant(eventId, targetUserId);

  const existing = await prisma.kitchenChef.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: targetUserId } },
  });
  if (existing) {
    throw createError(409, "User is already a chef", { code: "ALREADY_CHEF" });
  }

  let claimedMealId: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.kitchenChef.create({
      data: { eventKitchenId: eventKitchen.id, userId: targetUserId, source: "MANUAL" },
    });
    // Le role chef preempte silencieusement courses/equipier (2.4)
    await tx.kitchenCoursesMember.deleteMany({
      where: { eventKitchenId: eventKitchen.id, userId: targetUserId },
    });

    const assistantRow = await tx.mealAssistant.findUnique({
      where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: targetUserId } },
      include: { meal: true },
    });
    if (assistantRow) {
      await tx.mealAssistant.delete({ where: { id: assistantRow.id } });
      // Point 3 (Evolutions.md), attribution MANUELLE uniquement : si le creneau ou
      // il etait inscrit est orphelin, il lui est automatiquement attribue. La
      // synchro par role Discord (syncChefRoleRoster) garde le comportement inchange
      // (desinscription seule, pas d'auto-attribution).
      if (assistantRow.meal.chefUserId === null) {
        await tx.meal.update({
          where: { id: assistantRow.mealId },
          data: { chefUserId: targetUserId },
        });
        claimedMealId = assistantRow.mealId;
      }
      await cancelStaleAssistantSwapRequests(tx, eventKitchen.id, targetUserId);
    }
  });

  emitToEvent(eventId, "kitchen:config-updated", { eventId });
  if (claimedMealId) {
    emitToEvent(eventId, "kitchen:meal-changed", { eventId, mealId: claimedMealId });
  }

  return getKitchenView(eventId, actingUserId);
}

export async function removeChef(eventId: string, actingUserId: string, targetUserId: string) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  if (eventKitchen.chefRoleId) {
    throw createError(400, "Chef roster is managed by Discord role", {
      code: "CHEF_ROLE_MODE_ACTIVE",
    });
  }

  const existing = await prisma.kitchenChef.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: targetUserId } },
  });
  if (!existing) {
    throw createError(404, "User is not in the chef roster", { code: "NOT_IN_CHEF_ROSTER" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.kitchenChef.delete({ where: { id: existing.id } });
    // Le repas devient orphelin ; la fiche est conservee intacte (2.4)
    await tx.meal.updateMany({
      where: { eventKitchenId: eventKitchen.id, chefUserId: targetUserId },
      data: { chefUserId: null },
    });
  });

  emitToEvent(eventId, "kitchen:config-updated", { eventId });

  return getKitchenView(eventId, actingUserId);
}

export async function addCoursesMember(
  eventId: string,
  actingUserId: string,
  targetUserId: string
) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  await assertParticipant(eventId, targetUserId);

  const isChef = await prisma.kitchenChef.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: targetUserId } },
  });
  if (isChef) {
    throw createError(409, "User is a chef and cannot join the courses team", {
      code: "ROLE_EXCLUSIVITY",
    });
  }

  const existing = await prisma.kitchenCoursesMember.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: targetUserId } },
  });
  if (existing) {
    throw createError(409, "User is already in the courses team", {
      code: "ALREADY_COURSES_MEMBER",
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.kitchenCoursesMember.create({
      data: { eventKitchenId: eventKitchen.id, userId: targetUserId },
    });
    // Le role courses preempte silencieusement l'inscription equipier, symetrique
    // au chef (point 3 Evolutions.md).
    await tx.mealAssistant.deleteMany({
      where: { eventKitchenId: eventKitchen.id, userId: targetUserId },
    });
    await cancelStaleAssistantSwapRequests(tx, eventKitchen.id, targetUserId);
  });

  emitToEvent(eventId, "kitchen:config-updated", { eventId });
  emitToEvent(eventId, "kitchen:assistant-changed", { eventId, mealId: null });

  return getKitchenView(eventId, actingUserId);
}

export async function removeCoursesMember(
  eventId: string,
  actingUserId: string,
  targetUserId: string
) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  const existing = await prisma.kitchenCoursesMember.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: targetUserId } },
  });
  if (!existing) {
    throw createError(404, "User is not in the courses team", { code: "NOT_COURSES_MEMBER" });
  }

  await prisma.kitchenCoursesMember.delete({ where: { id: existing.id } });

  emitToEvent(eventId, "kitchen:config-updated", { eventId });

  return getKitchenView(eventId, actingUserId);
}

// Listes de roster partagees entre la vue Gestion (responsable) et le dashboard
// Admin simple (point 5 Evolutions.md : ce dernier recoit desormais les memes
// listes nominatives, en lecture seule).
async function computeRosterLists(eventId: string, eventKitchenId: string) {
  const [chefs, coursesMembers, participations, assistants] = await Promise.all([
    prisma.kitchenChef.findMany({
      where: { eventKitchenId },
      include: { user: { select: USER_SELECT } },
    }),
    prisma.kitchenCoursesMember.findMany({
      where: { eventKitchenId },
      include: { user: { select: USER_SELECT } },
    }),
    prisma.eventParticipation.findMany({
      where: { eventId },
      include: { user: { select: USER_SELECT } },
    }),
    prisma.mealAssistant.findMany({ where: { eventKitchenId }, select: { userId: true } }),
  ]);

  const chefUserIds = new Set(chefs.map((c) => c.userId));
  const coursesUserIds = new Set(coursesMembers.map((c) => c.userId));
  const assistedUserIds = new Set(assistants.map((a) => a.userId));

  return {
    chefs: chefs.map((c) => ({ ...c.user, source: c.source })),
    coursesMembers: coursesMembers.map((c) => c.user),
    unassigned: participations
      .filter(
        (p) =>
          !chefUserIds.has(p.userId) &&
          !coursesUserIds.has(p.userId) &&
          !assistedUserIds.has(p.userId)
      )
      .map((p) => p.user),
  };
}

export async function getKitchenView(eventId: string, userId: string | undefined) {
  await getEventOr404(eventId);
  const eventKitchen = await prisma.eventKitchen.findUnique({ where: { eventId } });

  const user = userId
    ? await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
    : null;
  const isAdmin = user?.role === "ADMIN";
  const manager = userId ? await isKitchenManager(userId, isAdmin) : false;

  const isChef =
    userId && eventKitchen
      ? (await prisma.kitchenChef.findUnique({
          where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId } },
        })) !== null
      : false;

  // Flag self (pas une liste nominative) : necessaire au front pour masquer le
  // bouton "S'inscrire" a un membre de l'equipe courses (point 4 Evolutions.md).
  // Non sensible, meme traitement que isChef (expose a tous les roles).
  const isCoursesMember =
    userId && eventKitchen
      ? (await prisma.kitchenCoursesMember.findUnique({
          where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId } },
        })) !== null
      : false;

  const participant = userId ? await isEventParticipant(eventId, userId) : false;

  let currentUserKitchenRole: KitchenRole = "none";
  if (manager) currentUserKitchenRole = "manager";
  else if (isChef) currentUserKitchenRole = "chef";
  else if (participant) currentUserKitchenRole = "equipier";

  // Fiches (allergies, ingredients, ustensiles) : chef + responsable (PAS l'admin simple)
  const isFullReader = manager || isChef;
  // Gestion (roster, courses, sans-affectation) : responsable uniquement
  const isGestionReader = manager;
  // Board (planning repas) : chef/responsable toujours, equipier si active, et
  // l'admin simple qui garde un acces "dashboard" au tableau meme sans droit particulier
  const canSeeBoard =
    isFullReader || isAdmin || (participant && (eventKitchen?.equipierPlanningEnabled ?? false));
  // Admin simple (role ADMIN sans preference admin.kitchen, ni chef) : dashboard
  // en lecture seule (compteurs), jamais les listes nominatives ni les fiches
  const isPlainAdmin = isAdmin && !manager && !isChef;

  const base = {
    eventKitchenId: eventKitchen?.id ?? null,
    chefRoleId: eventKitchen?.chefRoleId ?? null,
    equipierPlanningEnabled: eventKitchen?.equipierPlanningEnabled ?? false,
    currentUserKitchenRole,
    isChef,
    isCoursesMember,
    meals: [] as unknown[],
  };

  if (!eventKitchen || !canSeeBoard) {
    return base;
  }

  const meals = await prisma.meal.findMany({
    where: { eventKitchenId: eventKitchen.id },
    include: {
      chef: { select: USER_SELECT },
      assistants: { include: { user: { select: USER_SELECT } } },
      ingredients: true,
      utensils: true,
    },
    orderBy: { startDateTime: "asc" },
  });

  // Conflits calcules sur le jeu d'intervalles UNIFIE (tables + cuisine, spec 6) :
  // une occupation cuisine qui chevauche une table (ou un autre creneau cuisine) met
  // les personnes concernees en conflit. Rendu dans l'onglet Planning.
  // - currentUserConflict : l'utilisateur courant est en conflit sur ce repas
  //   (chef occupe par son repas, ou equipier inscrit) — visible par la personne.
  // - conflictingCount : nombre de personnes en conflit sur ce repas — destine au
  //   chef du repas (symetrie avec le MJ cote table).
  const conflictsBySource = await computeEventConflicts(eventId);

  const mealsView = meals.map((meal) => {
    const conflictedUsers = conflictsBySource.get(meal.id) ?? new Set<string>();
    return {
      id: meal.id,
      name: meal.name,
      service: meal.service,
      startDateTime: meal.startDateTime,
      endDateTime: meal.endDateTime,
      maxAssistants: meal.maxAssistants,
      chef: meal.chef,
      assistants: meal.assistants.map((a) => a.user),
      remainingSeats: Math.max(0, meal.maxAssistants - meal.assistants.length),
      currentUserConflict: userId ? conflictedUsers.has(userId) : false,
      conflictingCount: conflictedUsers.size,
      ...(isFullReader ? { ingredients: meal.ingredients, utensils: meal.utensils } : {}),
    };
  });

  const result: Record<string, unknown> = { ...base, meals: mealsView };

  if (isFullReader) {
    result.allergiesNotes = eventKitchen.allergiesNotes;
  }

  if (isGestionReader) {
    const roster = await computeRosterLists(eventId, eventKitchen.id);

    result.chefs = roster.chefs;
    result.coursesMembers = roster.coursesMembers;
    result.unassigned = roster.unassigned;
    result.orphanMeals = mealsView.filter((m) => m.chef === null);

    // Compteur "equipiers repartis" (Admin Chef point 4) : places allouees sur
    // l'ensemble des repas vs pool total disponible (participants - chefs - courses).
    const poolTotal = await computeAvailablePool(eventId, eventKitchen.id);
    const allocated = mealsView.reduce((sum, m) => sum + m.maxAssistants, 0);
    result.capacitySummary = { allocated, poolTotal: Math.max(0, poolTotal) };
  }

  if (isPlainAdmin) {
    // Admin sans preference admin.kitchen : dashboard en lecture seule. Depuis le
    // point 5 (Evolutions.md), il recoit aussi les listes nominatives (chefs,
    // equipe courses, sans-affectation) et les equipiers par repas (deja presents
    // dans mealsView via canSeeBoard) — jamais les allergies/ingredients/ustensiles,
    // qui restent chef/responsable uniquement (isFullReader).
    const roster = await computeRosterLists(eventId, eventKitchen.id);

    result.dashboard = {
      chefsCount: roster.chefs.length,
      coursesCount: roster.coursesMembers.length,
      unassignedCount: roster.unassigned.length,
      chefs: roster.chefs,
      coursesMembers: roster.coursesMembers,
      unassigned: roster.unassigned,
    };
  }

  return result;
}
