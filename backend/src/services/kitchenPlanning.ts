import prisma from "../util/db";
import { emitToEvent } from "../socket/emitter";
import { getEventOr404, getOrCreateEventKitchen } from "./kitchen";

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

export async function generatePlanning(eventId: string) {
  await getEventOr404(eventId);
  const eventKitchen = await getOrCreateEventKitchen(eventId);

  const [participantCount, chefCount, coursesCount, meals] = await Promise.all([
    prisma.eventParticipation.count({ where: { eventId } }),
    prisma.kitchenChef.count({ where: { eventKitchenId: eventKitchen.id } }),
    prisma.kitchenCoursesMember.count({ where: { eventKitchenId: eventKitchen.id } }),
    prisma.meal.findMany({
      where: { eventKitchenId: eventKitchen.id },
      orderBy: { startDateTime: "asc" },
      include: { assistants: true },
    }),
  ]);

  const pool = participantCount - chefCount - coursesCount;
  const capacities = computeMealCapacities(pool, meals.length);

  await prisma.$transaction(
    meals.map((meal, i) =>
      prisma.meal.update({ where: { id: meal.id }, data: { maxAssistants: capacities[i] } })
    )
  );

  emitToEvent(eventId, "kitchen:planning-generated", { eventId });

  const overCapacity = meals
    .map((meal, i) => ({
      mealId: meal.id,
      name: meal.name,
      occupied: meal.assistants.length,
      maxAssistants: capacities[i],
    }))
    .filter((m) => m.occupied > m.maxAssistants);

  return { pool, mealCount: meals.length, capacities, overCapacity };
}
