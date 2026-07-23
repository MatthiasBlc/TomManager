import prisma from "../util/db";
import { emitToEvent } from "../socket/emitter";
import { TZ, zonedWallClockToUtc, zonedYMD } from "../util/timezone";
import { computeAvailablePool, getEventOr404, getOrCreateEventKitchen } from "./kitchen";
import { createBulkNotifications } from "./notification";

// Heures murales (Europe/Paris) par defaut des creneaux generes.
const LUNCH_HOURS = { startH: 10, startM: 30, endH: 13, endM: 0 };
const DINNER_HOURS = { startH: 18, startM: 30, endH: 21, endM: 0 };

type Service = "LUNCH" | "DINNER";

export interface ExpectedSlot {
  service: Service;
  name: string;
  startDateTime: Date;
  endDateTime: Date;
}

function slotName(service: Service, startDateTime: Date): string {
  // Nom affiche a l'utilisateur : accents francais corrects (convention projet).
  const weekday = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long" }).format(
    startDateTime
  );
  return service === "LUNCH" ? `Déjeuner du ${weekday}` : `Dîner du ${weekday}`;
}

// Deroule les creneaux attendus d'un event : premier jour = diner seul, jours
// intermediaires = dejeuner + diner, dernier jour = aucun repas. Cas limite d'un
// event sur un seul jour calendaire : la regle "premier jour" l'emporte (diner
// unique) plutot que de produire une matrice vide.
export function computeExpectedSlots(eventStart: Date, eventEnd: Date): ExpectedSlot[] {
  const first = zonedYMD(eventStart, TZ);
  const last = zonedYMD(eventEnd, TZ);

  // Enumeration des jours calendaires via des minuits UTC (pas de DST en UTC, donc
  // l'ajout de 24h ne saute jamais un jour). Ces minuits ne servent qu'a iterer les
  // dates (y/m/d), pas a produire des instants affiches.
  const firstMid = Date.UTC(first.y, first.mo - 1, first.d);
  const lastMid = Date.UTC(last.y, last.mo - 1, last.d);
  const days: { y: number; mo: number; d: number }[] = [];
  for (let t = firstMid; t <= lastMid; t += 86_400_000) {
    const dd = new Date(t);
    days.push({ y: dd.getUTCFullYear(), mo: dd.getUTCMonth() + 1, d: dd.getUTCDate() });
  }

  const slots: ExpectedSlot[] = [];
  const total = days.length;

  const pushSlot = (day: { y: number; mo: number; d: number }, service: Service) => {
    const hours = service === "LUNCH" ? LUNCH_HOURS : DINNER_HOURS;
    const start = zonedWallClockToUtc(day.y, day.mo, day.d, hours.startH, hours.startM, TZ);
    const end = zonedWallClockToUtc(day.y, day.mo, day.d, hours.endH, hours.endM, TZ);
    slots.push({ service, name: slotName(service, start), startDateTime: start, endDateTime: end });
  };

  days.forEach((day, i) => {
    const isFirst = i === 0;
    const isLast = i === total - 1;
    if (total === 1) {
      // Event d'un seul jour : la regle premier jour gagne (diner seul).
      pushSlot(day, "DINNER");
      return;
    }
    if (isFirst) {
      pushSlot(day, "DINNER");
    } else if (isLast) {
      // dernier jour : aucun repas
    } else {
      pushSlot(day, "LUNCH");
      pushSlot(day, "DINNER");
    }
  });

  return slots;
}

// Cle de correspondance (startDateTime, service) : identifie un creneau de facon
// stable, reutilisee par generatePlanning (anti-doublon grille) et par la creation
// manuelle d'un creneau (anti-doublon jour+service, cf createMeal).
export function slotKey(start: Date, service: Service): string {
  return `${start.getTime()}|${service}`;
}

// Repartition equilibree de `pool` equipiers sur `mealCount` repas (tries par
// startDateTime) : base = floor(pool/mealCount), les `reste` premiers repas
// recoivent base+1. Clamp a 0 partout si pool<=0 ou mealCount=0 (spec CookV1 5).
export function computeMealCapacities(pool: number, mealCount: number): number[] {
  if (mealCount <= 0) return [];
  if (pool <= 0) return new Array(mealCount).fill(0);

  const base = Math.floor(pool / mealCount);
  const reste = pool % mealCount;

  return Array.from({ length: mealCount }, (_, i) => base + (i < reste ? 1 : 0));
}

// Genere la matrice de repas de l'event et repartit le pool equipier restant sur les
// creneaux nouvellement crees. Idempotent : un creneau deja present (meme
// startDateTime + service) n'est jamais recree ni modifie ; seuls les creneaux
// manquants sont ajoutes, et le pool deja consomme par les repas existants est
// soustrait avant repartition sur les nouveaux.
export async function generatePlanning(eventId: string) {
  const event = await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  const expectedSlots = computeExpectedSlots(event.startDateTime, event.endDateTime);

  const [pool, existingMeals] = await Promise.all([
    computeAvailablePool(eventId, eventKitchen.id),
    prisma.meal.findMany({
      where: { eventKitchenId: eventKitchen.id },
      select: { startDateTime: true, service: true, maxAssistants: true },
    }),
  ]);

  // Les champs structurants d'un repas ne sont editables que par le manager (cf
  // updateMeal), garantissant qu'un creneau genere ne derive pas hors de la grille
  // et reste reconnu au reclic.
  const existingKeys = new Set(
    existingMeals.map((m) => slotKey(m.startDateTime, m.service as Service))
  );
  const missingSlots = expectedSlots.filter(
    (s) => !existingKeys.has(slotKey(s.startDateTime, s.service))
  );

  const consumed = existingMeals.reduce((sum, m) => sum + m.maxAssistants, 0);
  const remainingPool = Math.max(0, pool - consumed);
  const capacities = computeMealCapacities(remainingPool, missingSlots.length);

  if (missingSlots.length > 0) {
    await prisma.meal.createMany({
      data: missingSlots.map((slot, i) => ({
        eventKitchenId: eventKitchen.id,
        chefUserId: null,
        name: slot.name,
        service: slot.service,
        startDateTime: slot.startDateTime,
        endDateTime: slot.endDateTime,
        maxAssistants: capacities[i],
      })),
    });
  }

  emitToEvent(eventId, "kitchen:planning-generated", { eventId });

  // Sur-occupation calculee sur l'ensemble des repas (existants + nouveaux) : un
  // creneau existant dont l'occupation depasse la capacite est signale, sans etre
  // modifie (regle d'idempotence).
  const allMeals = await prisma.meal.findMany({
    where: { eventKitchenId: eventKitchen.id },
    include: { _count: { select: { assistants: true } } },
    orderBy: { startDateTime: "asc" },
  });
  const overCapacity = allMeals
    .filter((m) => m._count.assistants > m.maxAssistants)
    .map((m) => ({
      mealId: m.id,
      name: m.name,
      occupied: m._count.assistants,
      maxAssistants: m.maxAssistants,
    }));

  const overCapacityByChef = allMeals.filter(
    (m) => m.chefUserId && m._count.assistants > m.maxAssistants
  );
  await createBulkNotifications(
    overCapacityByChef.map((m) => ({
      userId: m.chefUserId as string,
      type: "KITCHEN_OVERCAPACITY" as const,
      title: "Sur-occupation de votre créneau",
      message: `Votre repas "${m.name}" a ${m._count.assistants} inscrits pour ${m.maxAssistants} places prévues`,
      metadata: { eventId, mealId: m.id },
    }))
  );

  return {
    pool,
    createdCount: missingSlots.length,
    mealCount: allMeals.length,
    capacities,
    overCapacity,
  };
}

// Reinitialise le planning (Admin Chef point 1/2) : supprime tous les repas de
// l'event (cascade ingredients/ustensiles/equipiers/echanges), sans toucher aux
// rosters chefs/equipe courses. Fait reapparaitre le bouton "Generer" (perimetre
// distinct de purgeEvent, qui reset l'event entier).
export async function resetPlanning(eventId: string) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  const { count } = await prisma.meal.deleteMany({
    where: { eventKitchenId: eventKitchen.id },
  });

  emitToEvent(eventId, "kitchen:meal-changed", { eventId, mealId: null });

  return { deletedCount: count };
}
