import prisma from "../util/db";

// Sync du roster chef cuisine (source ROLE) depuis le role Discord chefRoleId
// d'un EventKitchen. Miroir de handleRoleAdded/handleRoleRemoved (syncParticipation.ts)
// mais sans creation de compte : un chef doit deja exister via sa participation a l'event
// (spec CookV1 7 : "un membre qui a le role chef mais ne participe pas a l'event n'est pas
// ajoute").
//
// Deux chemins d'entree materialisent le meme etat (un chef ROLE = a la fois participant
// ET porteur du role Discord chef) :
// - le role chef est (ajoute|retire) alors que la participation existe deja
//   (handleChefRoleAdded/Removed, appeles pour le roleId qui vient de changer) ;
// - la participation est (gagnee|perdue) alors que le role chef est deja detenu
//   (reconcileChefEligibility/reconcileChefOnParticipationLost, appeles depuis
//   guildMemberUpdate apres handleRoleAdded/handleRoleRemoved). Sans ce 2e chemin, un
//   membre ayant recu le role chef Discord AVANT de rejoindre l'event restait absent du
//   roster jusqu'au prochain redemarrage du bot (startupSync).

async function materializeRoleChef(eventKitchenId: string, userId: string): Promise<void> {
  const existing = await prisma.kitchenChef.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId, userId } },
  });
  if (existing) return;

  await prisma.kitchenChef.create({
    data: { eventKitchenId, userId, source: "ROLE" },
  });
  // Le role chef preempte silencieusement courses/equipier (spec 2.4)
  await prisma.kitchenCoursesMember.deleteMany({
    where: { eventKitchenId, userId },
  });
  await prisma.mealAssistant.deleteMany({
    where: { eventKitchenId, userId },
  });
}

async function dematerializeRoleChef(eventKitchenId: string, userId: string): Promise<void> {
  const existing = await prisma.kitchenChef.findUnique({
    where: { eventKitchenId_userId: { eventKitchenId, userId } },
  });
  if (!existing || existing.source !== "ROLE") return;

  await prisma.kitchenChef.delete({ where: { id: existing.id } });
  // Le repas devient orphelin ; la fiche est conservee intacte (spec 2.4)
  await prisma.meal.updateMany({
    where: { eventKitchenId, chefUserId: userId },
    data: { chefUserId: null },
  });
}

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

    await materializeRoleChef(eventKitchen.id, user.id);
  }
}

// Appele quand un role chefRoleId est retire a un membre Discord
export async function handleChefRoleRemoved(discordId: string, roleId: string): Promise<void> {
  const eventKitchens = await prisma.eventKitchen.findMany({ where: { chefRoleId: roleId } });
  if (eventKitchens.length === 0) return;

  const user = await prisma.user.findFirst({ where: { discordId, deletedAt: null } });
  if (!user) return;

  for (const eventKitchen of eventKitchens) {
    await dematerializeRoleChef(eventKitchen.id, user.id);
  }
}

// Appele apres qu'un utilisateur ait gagne la participation a un event (role Discord lie
// a l'event ajoute). Si l'event a un EventKitchen en mode role et que l'utilisateur
// detient deja ce role (currentRoleIds), il devient chef immediatement au lieu d'attendre
// un redemarrage du bot.
export async function reconcileChefEligibility(
  eventId: string,
  userId: string,
  currentRoleIds: string[]
): Promise<void> {
  const eventKitchen = await prisma.eventKitchen.findUnique({ where: { eventId } });
  if (!eventKitchen?.chefRoleId) return;
  if (!currentRoleIds.includes(eventKitchen.chefRoleId)) return;

  await materializeRoleChef(eventKitchen.id, userId);
}

// Appele apres qu'un utilisateur ait perdu la participation a un event (role Discord lie
// a l'event retire). Un chef ROLE doit toujours etre participant de l'event (spec 7) :
// s'il en avait un, on le retire du roster (le repas devient orphelin, cf 2.4). Les
// chefs MANUAL ne sont pas concernes (geres explicitement par le responsable).
export async function reconcileChefOnParticipationLost(
  eventId: string,
  userId: string
): Promise<void> {
  const eventKitchen = await prisma.eventKitchen.findUnique({ where: { eventId } });
  if (!eventKitchen) return;

  await dematerializeRoleChef(eventKitchen.id, userId);
}
