// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

// Comptes admin crees automatiquement en local et preprod
// Pour la prod, utiliser le script one-shot via docker exec
const DEV_ADMINS = [{ email: "admin@local.dev", username: "admin", password: "admin123" }];

// Comptes de demo pour tester manuellement la matrice de droits du module cuisine
// (voir docs/features/CookV1/SPEC_COOKING.md #4) : un admin "classique" (sans
// admin.kitchen, dashboard seul), un admin-responsable qui est AUSSI chef (sous-menu
// Gestion/Mon repas), un chef non-admin, et un utilisateur normal (equipier).
const DEV_KITCHEN_USERS = [
  { email: "adminchef@local.dev", username: "adminchef", password: "admin123", role: "ADMIN" },
  { email: "chef@local.dev", username: "chef", password: "chef123", role: "USER" },
  { email: "user@local.dev", username: "user", password: "user123", role: "USER" },
];

// Chefs supplementaires (non-admin) : de quoi peupler chaque scenario de fiche
// repas (complet, sur-occupe, minimal) sans jamais donner 2 repas au meme chef
// (contrainte @@unique([eventKitchenId, chefUserId])).
const DEV_EXTRA_CHEFS = [
  { email: "chef2@local.dev", username: "chef2", password: "chef123", role: "USER" },
  { email: "chef3@local.dev", username: "chef3", password: "chef123", role: "USER" },
  { email: "chef4@local.dev", username: "chef4", password: "chef123", role: "USER" },
];

// Participants generiques (equipiers sans role particulier) pour peupler l'event de
// demo : sert aussi de reservoir pour l'equipe courses et les inscriptions repas
// (participant1 = courses, participant2/3/4 = assistants, le reste = sans affectation).
const FILLER_PARTICIPANT_COUNT = 11;

async function getOrCreateUser({ email, username, password, role }) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    console.log(`Deja existant, ignore : ${username} (${email})`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, username, passwordHash, role },
  });
  console.log(`Compte cree : ${username} (${email}, ${role})`);
  return user;
}

async function seedAdmins() {
  for (const { email, username, password } of DEV_ADMINS) {
    await getOrCreateUser({ email, username, password, role: "ADMIN" });
  }
}

// Cree (ou retrouve, idempotence) un creneau repas identifie par (eventKitchenId,
// startDateTime, service) — meme cle que slotKey() cote generatePlanning — pour ne
// jamais dupliquer un creneau du seed si le script est relance.
async function findOrCreateMeal(
  eventKitchenId,
  { chefUserId, name, service, startDateTime, endDateTime, maxAssistants }
) {
  const existing = await prisma.meal.findFirst({
    where: { eventKitchenId, startDateTime, service },
  });
  if (existing) return existing;
  return prisma.meal.create({
    data: { eventKitchenId, chefUserId, name, service, startDateTime, endDateTime, maxAssistants },
  });
}

async function addAssistant(eventKitchenId, mealId, userId) {
  await prisma.mealAssistant.upsert({
    where: { mealId_userId: { mealId, userId } },
    create: { mealId, eventKitchenId, userId },
    update: {},
  });
}

// Comptes + donnees de demo pour le module cuisine (CookV1). Idempotent comme le
// reste du seed : peut etre relance sans dupliquer (docker restarte le seed a
// chaque demarrage du backend, cf docker-compose.yml).
//
// Grille couverte (event 14-19 aout 2026, Europe/Paris, memes horaires fixes que
// generatePlanning : dejeuner 10h30-13h00, diner 18h30-21h00 -> 08h30-11h00 et
// 16h30-19h00 UTC en aout/DST) : 1er jour diner seul, jours intermediaires
// dejeuner+diner, dernier jour aucun repas = 9 creneaux. Varietes couvertes pour
// tester l'Admin Chef : creneaux orphelins, repas LUNCH, repas complet, repas en
// sur-occupation, repas sans ingredients/ustensiles, equipe courses peuplee.
async function seedKitchenDemo(event, fillerParticipants) {
  const adminChef = await getOrCreateUser(DEV_KITCHEN_USERS[0]);
  const chef = await getOrCreateUser(DEV_KITCHEN_USERS[1]);
  const user = await getOrCreateUser(DEV_KITCHEN_USERS[2]);
  const [chef2, chef3, chef4] = await Promise.all(DEV_EXTRA_CHEFS.map(getOrCreateUser));
  const [courses1, assistant2, assistant3, assistant4] = fillerParticipants;

  // admin.kitchen : seul adminChef a la case cochee (responsable complet).
  // admin@local.dev reste un admin "classique" (dashboard cuisine en lecture seule).
  await prisma.userPreference.upsert({
    where: { userId_key: { userId: adminChef.id, key: "admin.kitchen" } },
    create: { userId: adminChef.id, key: "admin.kitchen", value: true },
    update: { value: true },
  });

  for (const u of [adminChef, chef, user, chef2, chef3, chef4]) {
    await prisma.eventParticipation.upsert({
      where: { eventId_userId: { eventId: event.id, userId: u.id } },
      create: { eventId: event.id, userId: u.id },
      update: {},
    });
  }

  const eventKitchen = await prisma.eventKitchen.upsert({
    where: { eventId: event.id },
    create: {
      eventId: event.id,
      allergiesNotes: "Une convive est allergique aux fruits a coque.",
      equipierPlanningEnabled: true,
    },
    update: {},
  });

  // Reset local uniquement (SEED_RESET_KITCHEN=true, pose dans docker-compose.yml
  // dev exclusivement — jamais en preprod/prod) : purge les repas/rosters de cet
  // event avant de reseeder, pour eviter toute derive accumulee au fil des
  // redemarrages avec un code de generation different (creneaux orphelins d'un
  // ancien /generate manuel, horaires obsoletes, etc). Jamais destructif ailleurs.
  if (process.env.SEED_RESET_KITCHEN === "true") {
    await prisma.meal.deleteMany({ where: { eventKitchenId: eventKitchen.id } });
    await prisma.kitchenChef.deleteMany({ where: { eventKitchenId: eventKitchen.id } });
    await prisma.kitchenCoursesMember.deleteMany({ where: { eventKitchenId: eventKitchen.id } });
    console.log("SEED_RESET_KITCHEN=true : donnees cuisine de l'event demo reinitialisees");
  }

  // Roster chef en mode manuel (pas de chefRoleId : aucune guilde Discord reelle en
  // local). adminChef n'a volontairement PAS de repas encore, pour tester le bouton
  // "Generer le planning" (grille) puis "Choisir mon creneau" sous "Mon repas".
  for (const u of [adminChef, chef, chef2, chef3, chef4]) {
    await prisma.kitchenChef.upsert({
      where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: u.id } },
      create: { eventKitchenId: eventKitchen.id, userId: u.id, source: "MANUAL" },
      update: {},
    });
  }

  // Equipe courses (jamais peuplee auparavant dans le seed) : un equipier retire du
  // pool "equipiers a repartir sur les repas".
  await prisma.kitchenCoursesMember.upsert({
    where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: courses1.id } },
    create: { eventKitchenId: eventKitchen.id, userId: courses1.id },
    update: {},
  });

  // Creneau 1 (jour 14, diner seul) : reste ORPHELIN (aucun chef), pour tester
  // l'assignation de chef directement depuis la fiche (Admin Chef point 5).
  await findOrCreateMeal(eventKitchen.id, {
    chefUserId: null,
    name: "Dîner du vendredi",
    service: "DINNER",
    startDateTime: new Date("2026-08-14T16:30:00.000Z"),
    endDateTime: new Date("2026-08-14T19:00:00.000Z"),
    maxAssistants: 2,
  });

  // Creneau 2 (jour 15, dejeuner) : orphelin egalement.
  await findOrCreateMeal(eventKitchen.id, {
    chefUserId: null,
    name: "Déjeuner du samedi",
    service: "LUNCH",
    startDateTime: new Date("2026-08-15T08:30:00.000Z"),
    endDateTime: new Date("2026-08-15T11:00:00.000Z"),
    maxAssistants: 2,
  });

  // Creneau 3 (jour 15, diner) : repas complet du chef, recette + ingredients +
  // ustensiles, 1 equipier inscrit (1/3 places).
  const couscous = await findOrCreateMeal(eventKitchen.id, {
    chefUserId: chef.id,
    name: "Couscous royal",
    service: "DINNER",
    startDateTime: new Date("2026-08-15T16:30:00.000Z"),
    endDateTime: new Date("2026-08-15T19:00:00.000Z"),
    maxAssistants: 3,
  });
  if ((await prisma.mealIngredient.count({ where: { mealId: couscous.id } })) === 0) {
    await prisma.mealIngredient.createMany({
      data: [
        { mealId: couscous.id, name: "Semoule", quantity: 2, unit: "KG" },
        { mealId: couscous.id, name: "Merguez", quantity: 1.5, unit: "KG" },
      ],
    });
    await prisma.mealUtensil.create({ data: { mealId: couscous.id, name: "Couscoussier" } });
  }
  await addAssistant(eventKitchen.id, couscous.id, user.id);

  // Creneau 4 (jour 16, dejeuner) : repas COMPLET (capacite pleine, 1/1).
  const saladeNicoise = await findOrCreateMeal(eventKitchen.id, {
    chefUserId: chef2.id,
    name: "Salade Niçoise",
    service: "LUNCH",
    startDateTime: new Date("2026-08-16T08:30:00.000Z"),
    endDateTime: new Date("2026-08-16T11:00:00.000Z"),
    maxAssistants: 1,
  });
  if ((await prisma.mealIngredient.count({ where: { mealId: saladeNicoise.id } })) === 0) {
    await prisma.mealIngredient.createMany({
      data: [
        { mealId: saladeNicoise.id, name: "Thon", quantity: 500, unit: "G" },
        { mealId: saladeNicoise.id, name: "Tomates", quantity: 1, unit: "KG" },
      ],
    });
  }
  await addAssistant(eventKitchen.id, saladeNicoise.id, assistant2.id);

  // Creneau 5 (jour 16, diner) : orphelin.
  await findOrCreateMeal(eventKitchen.id, {
    chefUserId: null,
    name: "Dîner du dimanche",
    service: "DINNER",
    startDateTime: new Date("2026-08-16T16:30:00.000Z"),
    endDateTime: new Date("2026-08-16T19:00:00.000Z"),
    maxAssistants: 2,
  });

  // Creneau 6 (jour 17, dejeuner) : orphelin.
  await findOrCreateMeal(eventKitchen.id, {
    chefUserId: null,
    name: "Déjeuner du lundi",
    service: "LUNCH",
    startDateTime: new Date("2026-08-17T08:30:00.000Z"),
    endDateTime: new Date("2026-08-17T11:00:00.000Z"),
    maxAssistants: 2,
  });

  // Creneau 7 (jour 17, diner) : repas en SUR-OCCUPATION (2 inscrits, capacite 1) —
  // pour tester le badge d'alerte (generatePlanning.overCapacity / dashboard).
  const raclette = await findOrCreateMeal(eventKitchen.id, {
    chefUserId: chef3.id,
    name: "Raclette",
    service: "DINNER",
    startDateTime: new Date("2026-08-17T16:30:00.000Z"),
    endDateTime: new Date("2026-08-17T19:00:00.000Z"),
    maxAssistants: 1,
  });
  if ((await prisma.mealIngredient.count({ where: { mealId: raclette.id } })) === 0) {
    await prisma.mealIngredient.createMany({
      data: [{ mealId: raclette.id, name: "Fromage à raclette", quantity: 2, unit: "KG" }],
    });
    await prisma.mealUtensil.create({ data: { mealId: raclette.id, name: "Appareil à raclette" } });
  }
  await addAssistant(eventKitchen.id, raclette.id, assistant3.id);
  await addAssistant(eventKitchen.id, raclette.id, assistant4.id);

  // Creneau 8 (jour 18, dejeuner) : fiche MINIMALE (recette nommee, sans ingredient
  // ni ustensile renseigne).
  await findOrCreateMeal(eventKitchen.id, {
    chefUserId: chef4.id,
    name: "Buffet froid",
    service: "LUNCH",
    startDateTime: new Date("2026-08-18T08:30:00.000Z"),
    endDateTime: new Date("2026-08-18T11:00:00.000Z"),
    maxAssistants: 2,
  });

  // Creneau 9 (jour 18, diner) : orphelin.
  await findOrCreateMeal(eventKitchen.id, {
    chefUserId: null,
    name: "Dîner du mardi",
    service: "DINNER",
    startDateTime: new Date("2026-08-18T16:30:00.000Z"),
    endDateTime: new Date("2026-08-18T19:00:00.000Z"),
    maxAssistants: 2,
  });
  // (Jour 19, dernier jour de l'event : aucun repas, regle de la grille.)

  console.log(
    "Cuisine (demo) : 9 creneaux (grille complete 14-19 aout), 5 chefs " +
      "(adminchef sans repas, chef/chef2/chef3/chef4 assignes), 4 creneaux orphelins, " +
      "1 repas complet, 1 en sur-occupation, 1 fiche minimale, equipe courses peuplee (participant1)"
  );
}

// Participants generiques (equipiers), pour peupler un peu plus l'event de demo.
// Retourne la liste des comptes crees : seedKitchenDemo reutilise les premiers pour
// l'equipe courses et quelques inscriptions repas plutot que de creer des comptes
// dedies.
async function seedFillerParticipants(event) {
  const participants = [];
  for (let i = 1; i <= FILLER_PARTICIPANT_COUNT; i++) {
    const participant = await getOrCreateUser({
      email: `participant${i}@local.dev`,
      username: `participant${i}`,
      password: "participant123",
      role: "USER",
    });
    await prisma.eventParticipation.upsert({
      where: { eventId_userId: { eventId: event.id, userId: participant.id } },
      create: { eventId: event.id, userId: participant.id },
      update: {},
    });
    participants.push(participant);
  }
  console.log(
    `Participants generiques : ${FILLER_PARTICIPANT_COUNT} (participant1..${FILLER_PARTICIPANT_COUNT}@local.dev, mdp participant123)`
  );
  return participants;
}

async function seedDemoData() {
  const admin = await prisma.user.findFirst({
    where: { email: "admin@local.dev" },
  });

  if (!admin) {
    console.log("Admin introuvable, abandon du seed de demo");
    return;
  }

  // --- Evenement ---
  let event = await prisma.event.findFirst({
    where: { name: "Convention Ete 2026", createdBy: admin.id },
  });

  if (!event) {
    event = await prisma.event.create({
      data: {
        name: "Convention Ete 2026",
        startDateTime: new Date("2026-08-14T10:00:00.000Z"),
        endDateTime: new Date("2026-08-19T22:00:00.000Z"),
        createdBy: admin.id,
      },
    });
    console.log("Evenement cree : Convention Ete 2026");
  } else {
    console.log("Evenement deja existant, ignore");
  }

  // Participation admin
  await prisma.eventParticipation.upsert({
    where: { eventId_userId: { eventId: event.id, userId: admin.id } },
    create: { eventId: event.id, userId: admin.id },
    update: {},
  });

  // --- Module cuisine (CookV1) : comptes de demo + donnees ---
  // Voir docs/features/CookV1/SPEC_COOKING.md #4 pour la matrice de droits testee.
  // Les filler participants sont crees en premier : seedKitchenDemo en reutilise
  // quelques-uns pour l'equipe courses et les inscriptions repas.
  const fillerParticipants = await seedFillerParticipants(event);
  await seedKitchenDemo(event, fillerParticipants);

  // --- Jeux de societe ---
  const gamesData = [
    { name: "Wingspan", yearPublished: 2019, minPlayers: 1, maxPlayers: 5, playingTime: 70 },
    { name: "Spirit Island", yearPublished: 2017, minPlayers: 1, maxPlayers: 4, playingTime: 120 },
    { name: "Ark Nova", yearPublished: 2021, minPlayers: 1, maxPlayers: 4, playingTime: 150 },
  ];

  const boardGames = [];
  const boardGameMap = {};
  for (const g of gamesData) {
    let bg = await prisma.boardGame.findFirst({ where: { name: g.name } });
    if (!bg) {
      bg = await prisma.boardGame.create({ data: g });
      console.log(`Jeu cree : ${g.name}`);
    } else {
      console.log(`Jeu deja existant, ignore : ${g.name}`);
    }
    boardGames.push(bg);
    boardGameMap[g.name] = bg;
  }

  // Associer les jeux a l'evenement (amenes par admin)
  for (const bg of boardGames) {
    const existing = await prisma.eventBoardGame.findFirst({
      where: { eventId: event.id, boardGameId: bg.id },
    });
    if (!existing) {
      await prisma.eventBoardGame.create({
        data: { eventId: event.id, boardGameId: bg.id, broughtByUserId: admin.id },
      });
    }
  }

  // --- Tags ---
  const tagNames = ["jdr", "strategie", "coopératif", "familial", "initiation", "demo"];
  const tagMap = {};
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    tagMap[name] = tag;
  }

  // --- Tables ---
  // Les tables couvrent differents cas de chevauchement pour tester la vue liste :
  //
  // Jour 15 : sequentielles (pas de conflit) → 2 colonnes pleine largeur empilees
  // Jour 16 : 2 tables simultanees (cote a cote) → grid 2 colonnes
  // Jour 17 : B longue chevauche A et C → A|B / C|B (B avec rowSpan=2)
  // Jour 18 : 3 tables simultanees → grid 3 colonnes
  // Jour 19 : mix complexe (sequentielles + simultanees + longue qui span)
  const tablesData = [
    // --- Jour 15 : sequentielles, pas de conflit ---
    {
      title: "L'Appel de Cthulhu - Scenario debutant",
      pitch:
        "Un scenario d'introduction au jeu de role lovecraftien. Personnages pre-tires fournis.",
      maxPlayers: 5,
      startDateTime: new Date("2026-08-15T08:00:00.000Z"),
      endDateTime: new Date("2026-08-15T11:00:00.000Z"),
      tags: ["jdr", "initiation"],
    },
    {
      title: "Donjons & Dragons 5e - La Crypte Oubliee",
      pitch: "Donjon classique pour 4-5 aventuriers. Niveau 3 recommande.",
      maxPlayers: 5,
      startDateTime: new Date("2026-08-15T13:00:00.000Z"),
      endDateTime: new Date("2026-08-15T17:00:00.000Z"),
      tags: ["jdr"],
    },

    // --- Jour 16 : 2 tables vraiment simultanees ---
    {
      title: "Pathfinder 2e - Quete des Anciens",
      pitch: "Aventure heroique dans un monde de haute fantasy. Regles completes.",
      maxPlayers: 4,
      startDateTime: new Date("2026-08-16T09:00:00.000Z"),
      endDateTime: new Date("2026-08-16T13:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Shadowrun 6e - Run de nuit",
      pitch: "Mission dans les rues de Seattle 2080. Infiltration et action garanties.",
      maxPlayers: 4,
      startDateTime: new Date("2026-08-16T09:00:00.000Z"),
      endDateTime: new Date("2026-08-16T13:00:00.000Z"),
      tags: ["jdr"],
    },

    // --- Jour 17 : B longue chevauche A et C ---
    // Resultat attendu : A|B  puis  C|B (B avec rowSpan=2)
    {
      title: "Vampire la Mascarade - Nuit de sang", // A : 10h-12h
      pitch: "Intrigues politiques entre clans vampiriques dans une ville moderne.",
      maxPlayers: 4,
      startDateTime: new Date("2026-08-17T08:00:00.000Z"),
      endDateTime: new Date("2026-08-17T11:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Warhammer 40k RPG - Requiem Infernal", // B : 10h-17h (longue)
      pitch: "Campagne en espace lointain. Duree estimee 7h. Univers sombre et brutal.",
      maxPlayers: 5,
      startDateTime: new Date("2026-08-17T08:00:00.000Z"),
      endDateTime: new Date("2026-08-17T16:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Star Wars Edge of the Empire - La Kessel Run", // C : 14h-17h
      pitch: "Du contrebandier a l'hero de la Rebellion. Univers Star Wars canonique.",
      maxPlayers: 5,
      startDateTime: new Date("2026-08-17T13:00:00.000Z"),
      endDateTime: new Date("2026-08-17T16:00:00.000Z"),
      tags: ["jdr", "initiation"],
    },

    // --- Jour 18 : 3 tables vraiment simultanees ---
    {
      title: "Blades in the Dark - Le Gang des Cendres",
      pitch: "Jeu de braquage dans une ville victorienne fantasmagorique.",
      maxPlayers: 4,
      startDateTime: new Date("2026-08-18T08:00:00.000Z"),
      endDateTime: new Date("2026-08-18T12:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Monster of the Week - Nuit des Createurs",
      pitch: "Chasseurs de monstres dans l'Amerique contemporaine. Inspire de Supernatural.",
      maxPlayers: 4,
      startDateTime: new Date("2026-08-18T08:00:00.000Z"),
      endDateTime: new Date("2026-08-18T12:00:00.000Z"),
      tags: ["jdr", "initiation"],
    },
    {
      title: "Ironsworn - Terres de Fer",
      pitch: "JDR solo ou cooperatif sans MJ dans un monde de fantasy nordique.",
      maxPlayers: 3,
      startDateTime: new Date("2026-08-18T08:00:00.000Z"),
      endDateTime: new Date("2026-08-18T12:00:00.000Z"),
      tags: ["jdr"],
    },

    // --- Jour 19 : mix complexe ---
    // Alien : 10h-12h (col 0)    Delta Green : 10h-12h (col 1)    Dungeon World : 10h-17h (col 2, span)
    // Mothership : 14h-17h (col 0)
    // Resultat attendu :
    //   Alien | Delta Green | Dungeon World
    //   Mothership | (vide) | Dungeon World
    {
      title: "Alien RPG - Chariot des Dieux",
      pitch: "Survival horror dans l'espace. Scenario officiel. Deconseille aux ames sensibles.",
      maxPlayers: 5,
      startDateTime: new Date("2026-08-19T08:00:00.000Z"),
      endDateTime: new Date("2026-08-19T11:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Delta Green - Operation OUTLOOK",
      pitch: "Agents gouvernementaux face a l'indicible. Horreur lovecraftienne contemporaine.",
      maxPlayers: 4,
      startDateTime: new Date("2026-08-19T08:00:00.000Z"),
      endDateTime: new Date("2026-08-19T11:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Dungeon World - La Tour du Sorcier", // longue, chevauche tout
      pitch:
        "JDR narratif fantasy leger. Ideal pour joueurs voulant un rythme rapide et cinematique.",
      maxPlayers: 5,
      startDateTime: new Date("2026-08-19T08:00:00.000Z"),
      endDateTime: new Date("2026-08-19T16:00:00.000Z"),
      tags: ["jdr", "initiation"],
    },
    {
      title: "Mothership - Station Terreur",
      pitch: "Sci-fi horror old school. Equipage en perdition sur une station abandonnee.",
      maxPlayers: 4,
      startDateTime: new Date("2026-08-19T13:00:00.000Z"),
      endDateTime: new Date("2026-08-19T16:00:00.000Z"),
      tags: ["jdr"],
    },
    // --- Sessions JDS ---
    {
      type: "JDS",
      boardGameName: "Spirit Island",
      title: "Spirit Island - Nuit des Esprits",
      pitch:
        "Defense cooperative de l'ile contre les colonisateurs. Complexite elevee, session de nuit.",
      maxPlayers: 4,
      startDateTime: new Date("2026-08-19T00:30:00.000Z"),
      endDateTime: new Date("2026-08-19T03:30:00.000Z"),
      tags: ["coopératif", "strategie"],
    },
    {
      type: "JDS",
      boardGameName: "Wingspan",
      title: "Wingspan - Tournoi des Oiseaux",
      pitch:
        "Construisez le sanctuaire d'oiseaux le plus attractif. Partie competitive 3-5 joueurs.",
      maxPlayers: 5,
      startDateTime: new Date("2026-08-16T14:00:00.000Z"),
      endDateTime: new Date("2026-08-16T16:30:00.000Z"),
      tags: ["familial", "strategie"],
    },
    {
      type: "JDS",
      boardGameName: "Ark Nova",
      title: "Ark Nova - Zoo en construction",
      pitch:
        "Concevez un zoo moderne en soutenant des projets de conservation. Jeu dense, initiation possible.",
      maxPlayers: 4,
      startDateTime: new Date("2026-08-18T13:00:00.000Z"),
      endDateTime: new Date("2026-08-18T17:00:00.000Z"),
      tags: ["strategie"],
    },
    {
      type: "JDS",
      title: "Partie libre JDS - apportez vos jeux",
      pitch: "Table ouverte pour toute partie de jeu de societe. Jeux du coin ou les votres.",
      maxPlayers: 8,
      startDateTime: new Date("2026-08-15T18:00:00.000Z"),
      endDateTime: new Date("2026-08-15T21:00:00.000Z"),
      tags: ["familial"],
    },

    // --- Jour 19, soir : demo UX "places reservees" ---
    // Sequentielles (pas de chevauchement), rangees apres Dungeon World/Mothership.
    // Couvre toute la matrice reservedSeats/places-libres pour valider l'affichage
    // de la fiche table (cf. docs/features/table-reserved-seats-ux) :
    //   1. Pas de reservation, places encore libres (cas de base)
    //   2. Pas de reservation, complete (liste d'attente simple)
    //   3. Reservation partielle + places libres restantes (les deux coexistent)
    //   4. Reservation entierement pourvue + places libres restantes (pas de ligne fantome)
    //   5. Places libres epuisees MAIS reserve encore vacante (piege silencieux,
    //      se produit meme quand reservedSeats < maxPlayers)
    //   6. Reservation totale (reservedSeats = maxPlayers), non entierement pourvue
    //      (cas signale par un utilisateur : "3/4 mais je ne peux pas rejoindre")
    //   7. Reservation totale, entierement pourvue (complete sans ambiguite)
    {
      title: "Demo UX 1 - Table ouverte, places disponibles",
      pitch: "Aucune reservation : les places restantes sont ouvertes a tous.",
      maxPlayers: 5,
      reservedSeats: 0,
      startDateTime: new Date("2026-08-19T16:00:00.000Z"),
      endDateTime: new Date("2026-08-19T16:50:00.000Z"),
      tags: ["demo"],
      participants: (fp) => [
        { user: fp[0], status: "CONFIRMED" },
        { user: fp[1], status: "CONFIRMED" },
      ],
    },
    {
      title: "Demo UX 2 - Table ouverte, complete",
      pitch: "Aucune reservation, mais toutes les places sont prises : liste d'attente classique.",
      maxPlayers: 2,
      reservedSeats: 0,
      startDateTime: new Date("2026-08-19T16:50:00.000Z"),
      endDateTime: new Date("2026-08-19T17:40:00.000Z"),
      tags: ["demo"],
      participants: (fp) => [
        { user: fp[2], status: "CONFIRMED" },
        { user: fp[3], status: "WAITLIST" },
      ],
    },
    {
      title: "Demo UX 3 - Reservation partielle, places libres restantes",
      pitch:
        "1 des 2 places reservees est pourvue, et il reste des places libres a cote : les deux se cotoient sur la meme fiche.",
      maxPlayers: 5,
      reservedSeats: 2,
      startDateTime: new Date("2026-08-19T17:40:00.000Z"),
      endDateTime: new Date("2026-08-19T18:30:00.000Z"),
      tags: ["demo"],
      participants: (fp) => [{ user: fp[4], status: "CONFIRMED", isOnReservedSeat: true }],
    },
    {
      title: "Demo UX 4 - Reservation complete, places libres restantes",
      pitch:
        "L'unique place reservee est deja attribuee ; 2 places libres restent ouvertes a l'inscription directe.",
      maxPlayers: 5,
      reservedSeats: 1,
      gmOnReservedSeat: true,
      startDateTime: new Date("2026-08-19T18:30:00.000Z"),
      endDateTime: new Date("2026-08-19T19:20:00.000Z"),
      tags: ["demo"],
      participants: (fp) => [
        { user: fp[5], status: "CONFIRMED" },
        { user: fp[6], status: "CONFIRMED" },
      ],
    },
    {
      title: "Demo UX 5 - Places libres epuisees, reserve encore vacante",
      pitch:
        "Les 2 places libres sont prises, mais les 2 places reservees n'ont encore ete attribuees a personne : rejoindre mene direct a la liste d'attente, meme si la table n'affiche pas complet a premiere vue.",
      maxPlayers: 4,
      reservedSeats: 2,
      startDateTime: new Date("2026-08-19T19:20:00.000Z"),
      endDateTime: new Date("2026-08-19T20:10:00.000Z"),
      tags: ["demo"],
      participants: (fp) => [{ user: fp[7], status: "CONFIRMED" }],
    },
    {
      title: "Demo UX 6 - Reservation totale, non entierement attribuee",
      pitch:
        "Cas signale par un joueur en production : la table affiche 3/4 mais la 4e place est deja reservee par le MJ, pas encore attribuee. Rejoindre place en liste d'attente.",
      maxPlayers: 4,
      reservedSeats: 4,
      gmOnReservedSeat: true,
      startDateTime: new Date("2026-08-19T20:10:00.000Z"),
      endDateTime: new Date("2026-08-19T21:00:00.000Z"),
      tags: ["demo"],
      participants: (fp) => [
        { user: fp[8], status: "CONFIRMED", isOnReservedSeat: true },
        { user: fp[9], status: "CONFIRMED", isOnReservedSeat: true },
        { user: fp[1], status: "WAITLIST" },
      ],
    },
    {
      title: "Demo UX 7 - Reservation totale, complete",
      pitch: "Toutes les places reservees sont attribuees : la table est simplement complete.",
      maxPlayers: 3,
      reservedSeats: 3,
      gmOnReservedSeat: true,
      startDateTime: new Date("2026-08-19T21:00:00.000Z"),
      endDateTime: new Date("2026-08-19T21:50:00.000Z"),
      tags: ["demo"],
      participants: (fp) => [
        { user: fp[0], status: "CONFIRMED", isOnReservedSeat: true },
        { user: fp[10], status: "CONFIRMED", isOnReservedSeat: true },
      ],
    },
  ];

  for (const t of tablesData) {
    const existing = await prisma.gameTable.findFirst({
      where: { eventId: event.id, title: t.title },
    });

    if (!existing) {
      const boardGameId = t.boardGameName ? (boardGameMap[t.boardGameName]?.id ?? null) : null;

      const table = await prisma.gameTable.create({
        data: {
          eventId: event.id,
          createdBy: admin.id,
          type: t.type || "JDR",
          title: t.title,
          pitch: t.pitch || null,
          triggers: t.triggers || null,
          comments: null,
          maxPlayers: t.maxPlayers,
          reservedSeats: t.reservedSeats ?? 0,
          startDateTime: t.startDateTime,
          endDateTime: t.endDateTime,
          boardGameId,
        },
      });

      // Ajouter admin comme participant GM (eventuellement sur une place reservee,
      // pour les tables de demo qui en ont besoin)
      await prisma.gameTableParticipant.create({
        data: {
          gameTableId: table.id,
          userId: admin.id,
          status: "CONFIRMED",
          isOnReservedSeat: t.gmOnReservedSeat ?? false,
        },
      });

      // Participants additionnels (tables de demo places reservees)
      for (const p of t.participants ? t.participants(fillerParticipants) : []) {
        await prisma.gameTableParticipant.create({
          data: {
            gameTableId: table.id,
            userId: p.user.id,
            status: p.status,
            isOnReservedSeat: p.isOnReservedSeat ?? false,
          },
        });
      }

      // Tags
      for (const tagName of t.tags) {
        const tag = tagMap[tagName];
        if (tag) {
          await prisma.gameTableTag.create({
            data: { gameTableId: table.id, tagId: tag.id },
          });
        }
      }

      console.log(`Table creee : ${t.title}`);
    } else {
      console.log(`Table deja existante, ignore : ${t.title}`);
    }
  }
}

async function main() {
  await seedAdmins();
  try {
    await seedDemoData();
  } catch (e) {
    // La donnee de demo est optionnelle — le serveur doit toujours demarrer
    console.error("[seed] seedDemoData echoue (non-fatal) :", e.message);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
