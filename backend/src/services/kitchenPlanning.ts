import prisma from "../util/db";
import { emitToEvent } from "../socket/emitter";
import { computeAvailablePool, getEventOr404, getOrCreateEventKitchen } from "./kitchen";

// Fuseau de reference pour la matrice de repas. L'app est franco-centree et les
// heures des creneaux sont exprimees en heure murale locale (10h30, 18h30) : on
// derive les jours et les horaires en Europe/Paris, independamment du fuseau du
// serveur, via l'API Intl (gestion DST correcte).
const TZ = "Europe/Paris";

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

// Decalage (ms) entre `timeZone` et UTC a l'instant `date`.
function getZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  const asUTC = Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second);
  return asUTC - date.getTime();
}

// Convertit une heure murale (y, m, d, h, min) exprimee dans `timeZone` en instant UTC.
// Les heures des repas (10h30 / 18h30) ne tombent jamais dans la fenetre de bascule
// DST (02h-03h), donc l'approximation d'offset a l'instant devine est exacte ici.
function zonedWallClockToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  min: number,
  timeZone: string
): Date {
  const utcGuess = Date.UTC(y, mo - 1, d, h, min, 0);
  const offset = getZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
}

// Annee/mois/jour calendaires de `date` dans `timeZone`.
function zonedYMD(date: Date, timeZone: string): { y: number; mo: number; d: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, mo, d] = dtf.format(date).split("-").map(Number);
  return { y, mo, d };
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
