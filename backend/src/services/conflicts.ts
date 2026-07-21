import prisma from "../util/db";

// Moteur de conflits unifie (spec CookV1, section 6).
//
// Un "conflit" = deux occupations d'une meme personne qui se chevauchent dans le
// temps. Les occupations proviennent de deux domaines fusionnes en un seul jeu
// d'intervalles :
//   - Tables de jeu : le MJ (createdBy) occupe [start, end] de sa table ; chaque
//     joueur CONFIRMED occupe [start, end] de la table.
//   - Cuisine : le chef occupe [start, end] de SON repas ; chaque equipier inscrit
//     occupe [start, end] du repas.
//
// Le calcul attribue, pour chaque "source" (une table ou un repas), l'ensemble des
// personnes en conflit dessus. La visibilite de la surbrillance est ensuite decidee
// par l'appelant (personne concernee / chef du repas / MJ de la table).

export interface Occupation {
  // Identifiant global de la source (tableId ou mealId ; UUIDs distincts entre eux)
  sourceId: string;
  userId: string;
  start: number; // ms epoch
  end: number; // ms epoch
}

// Retourne, par sourceId, l'ensemble des userId en conflit sur cette source.
export function computeConflicts(occupations: Occupation[]): Map<string, Set<string>> {
  const byUser = new Map<string, Occupation[]>();
  for (const occ of occupations) {
    if (!byUser.has(occ.userId)) byUser.set(occ.userId, []);
    byUser.get(occ.userId)!.push(occ);
  }

  const result = new Map<string, Set<string>>();
  const mark = (sourceId: string, userId: string) => {
    if (!result.has(sourceId)) result.set(sourceId, new Set());
    result.get(sourceId)!.add(userId);
  };

  for (const [userId, list] of byUser) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        // Deux occupations sur la meme source (ex. MJ aussi joueur, dedoublonne en
        // amont) ne sont jamais un conflit avec elles-memes
        if (a.sourceId === b.sourceId) continue;
        if (a.start < b.end && a.end > b.start) {
          mark(a.sourceId, userId);
          mark(b.sourceId, userId);
        }
      }
    }
  }

  return result;
}

// Rassemble toutes les occupations (tables + cuisine) d'un event en un seul jeu.
// Source unique de verite pour le calcul des conflits, partagee par listTables
// (cote tables) et getKitchenView (cote repas) afin qu'un changement dans un
// domaine se repercute sur les conflits de l'autre.
export async function getEventOccupations(eventId: string): Promise<Occupation[]> {
  const occupations: Occupation[] = [];

  const tables = await prisma.gameTable.findMany({
    where: { eventId },
    select: {
      id: true,
      createdBy: true,
      startDateTime: true,
      endDateTime: true,
      participants: {
        where: { status: "CONFIRMED" },
        select: { userId: true },
      },
    },
  });

  for (const table of tables) {
    const start = table.startDateTime.getTime();
    const end = table.endDateTime.getTime();
    const seen = new Set<string>();
    // Le MJ occupe toujours sa table, qu'il soit assis (JDS / MJ joueur) ou non
    occupations.push({ sourceId: table.id, userId: table.createdBy, start, end });
    seen.add(table.createdBy);
    for (const p of table.participants) {
      if (seen.has(p.userId)) continue;
      seen.add(p.userId);
      occupations.push({ sourceId: table.id, userId: p.userId, start, end });
    }
  }

  const eventKitchen = await prisma.eventKitchen.findUnique({
    where: { eventId },
    select: { id: true },
  });

  if (eventKitchen) {
    const meals = await prisma.meal.findMany({
      where: { eventKitchenId: eventKitchen.id },
      select: {
        id: true,
        chefUserId: true,
        startDateTime: true,
        endDateTime: true,
        assistants: { select: { userId: true } },
      },
    });

    for (const meal of meals) {
      const start = meal.startDateTime.getTime();
      const end = meal.endDateTime.getTime();
      const seen = new Set<string>();
      // Repas orphelin (chefUserId null) : pas d'occupation chef, mais les equipiers
      // inscrits restent occupes
      if (meal.chefUserId) {
        occupations.push({ sourceId: meal.id, userId: meal.chefUserId, start, end });
        seen.add(meal.chefUserId);
      }
      for (const a of meal.assistants) {
        if (seen.has(a.userId)) continue;
        seen.add(a.userId);
        occupations.push({ sourceId: meal.id, userId: a.userId, start, end });
      }
    }
  }

  return occupations;
}

// Helper de haut niveau : occupations d'un event -> map des conflits par source.
export async function computeEventConflicts(eventId: string): Promise<Map<string, Set<string>>> {
  const occupations = await getEventOccupations(eventId);
  return computeConflicts(occupations);
}
