import prisma from "../util/db";

// Sync du roster chef cuisine (source ROLE) depuis le role Discord chefRoleId
// d'un EventKitchen. Miroir de handleRoleAdded/handleRoleRemoved (syncParticipation.ts)
// mais sans creation de compte : un chef doit deja exister via sa participation a l'event
// (spec CookV1 7 : "un membre qui a le role chef mais ne participe pas a l'event n'est pas
// ajoute").

// Appele quand un role chefRoleId est ajoute a un membre Discord
export async function handleChefRoleAdded(discordId: string, roleId: string): Promise<void> {
  const eventKitchens = await prisma.eventKitchen.findMany({ where: { chefRoleId: roleId } });
  if (eventKitchens.length === 0) return;

  const user = await prisma.user.findFirst({ where: { discordId, deletedAt: null } });
  if (!user) return;

  for (const eventKitchen of eventKitchens) {
    const participation = await prisma.eventParticipation.findUnique({
      where: { eventId_userId: { eventId: eventKitchen.eventId, userId: user.id } },
    });
    if (!participation) continue;

    const existing = await prisma.kitchenChef.findUnique({
      where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: user.id } },
    });
    if (existing) continue;

    await prisma.kitchenChef.create({
      data: { eventKitchenId: eventKitchen.id, userId: user.id, source: "ROLE" },
    });
    // Le role chef preempte silencieusement courses/equipier (spec 2.4)
    await prisma.kitchenCoursesMember.deleteMany({
      where: { eventKitchenId: eventKitchen.id, userId: user.id },
    });
    await prisma.mealAssistant.deleteMany({
      where: { eventKitchenId: eventKitchen.id, userId: user.id },
    });
  }
}

// Appele quand un role chefRoleId est retire a un membre Discord
export async function handleChefRoleRemoved(discordId: string, roleId: string): Promise<void> {
  const eventKitchens = await prisma.eventKitchen.findMany({ where: { chefRoleId: roleId } });
  if (eventKitchens.length === 0) return;

  const user = await prisma.user.findFirst({ where: { discordId, deletedAt: null } });
  if (!user) return;

  for (const eventKitchen of eventKitchens) {
    const existing = await prisma.kitchenChef.findUnique({
      where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: user.id } },
    });
    if (!existing || existing.source !== "ROLE") continue;

    await prisma.kitchenChef.delete({ where: { id: existing.id } });
    // Le repas devient orphelin ; la fiche est conservee intacte (spec 2.4)
    await prisma.meal.updateMany({
      where: { eventKitchenId: eventKitchen.id, chefUserId: user.id },
      data: { chefUserId: null },
    });
  }
}
