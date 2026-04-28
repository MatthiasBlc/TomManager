// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

// Comptes admin crees automatiquement en local et preprod
// Pour la prod, utiliser le script one-shot via docker exec
const DEV_ADMINS = [{ email: "admin@local.dev", username: "admin", password: "admin123" }];

async function seedAdmins() {
  for (const { email, username, password } of DEV_ADMINS) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      console.log(`Deja existant, ignore : ${username} (${email})`);
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, username, passwordHash, role: "ADMIN" },
    });

    console.log(`Admin cree : ${username} (${email})`);
  }
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
        startDateTime: new Date("2026-07-15T10:00:00.000Z"),
        endDateTime: new Date("2026-07-20T22:00:00.000Z"),
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
  const tagNames = ["jdr", "strategie", "coopératif", "familial", "initiation"];
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
  // Jour 16 : sequentielles (pas de conflit) → 2 colonnes pleine largeur empilees
  // Jour 17 : 2 tables simultanees (cote a cote) → grid 2 colonnes
  // Jour 18 : B longue chevauche A et C → A|B / C|B (B avec rowSpan=2)
  // Jour 19 : 3 tables simultanees → grid 3 colonnes
  // Jour 20 : mix complexe (sequentielles + simultanees + longue qui span)
  const tablesData = [
    // --- Jour 16 : sequentielles, pas de conflit ---
    {
      title: "L'Appel de Cthulhu - Scenario debutant",
      pitch:
        "Un scenario d'introduction au jeu de role lovecraftien. Personnages pre-tires fournis.",
      maxPlayers: 5,
      startDateTime: new Date("2026-07-16T08:00:00.000Z"),
      endDateTime: new Date("2026-07-16T11:00:00.000Z"),
      tags: ["jdr", "initiation"],
    },
    {
      title: "Donjons & Dragons 5e - La Crypte Oubliee",
      pitch: "Donjon classique pour 4-5 aventuriers. Niveau 3 recommande.",
      maxPlayers: 5,
      startDateTime: new Date("2026-07-16T13:00:00.000Z"),
      endDateTime: new Date("2026-07-16T17:00:00.000Z"),
      tags: ["jdr"],
    },

    // --- Jour 17 : 2 tables vraiment simultanees ---
    {
      title: "Pathfinder 2e - Quete des Anciens",
      pitch: "Aventure heroique dans un monde de haute fantasy. Regles completes.",
      maxPlayers: 4,
      startDateTime: new Date("2026-07-17T09:00:00.000Z"),
      endDateTime: new Date("2026-07-17T13:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Shadowrun 6e - Run de nuit",
      pitch: "Mission dans les rues de Seattle 2080. Infiltration et action garanties.",
      maxPlayers: 4,
      startDateTime: new Date("2026-07-17T09:00:00.000Z"),
      endDateTime: new Date("2026-07-17T13:00:00.000Z"),
      tags: ["jdr"],
    },

    // --- Jour 18 : B longue chevauche A et C ---
    // Resultat attendu : A|B  puis  C|B (B avec rowSpan=2)
    {
      title: "Vampire la Mascarade - Nuit de sang", // A : 10h-12h
      pitch: "Intrigues politiques entre clans vampiriques dans une ville moderne.",
      maxPlayers: 4,
      startDateTime: new Date("2026-07-18T08:00:00.000Z"),
      endDateTime: new Date("2026-07-18T11:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Warhammer 40k RPG - Requiem Infernal", // B : 10h-17h (longue)
      pitch: "Campagne en espace lointain. Duree estimee 7h. Univers sombre et brutal.",
      maxPlayers: 5,
      startDateTime: new Date("2026-07-18T08:00:00.000Z"),
      endDateTime: new Date("2026-07-18T16:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Star Wars Edge of the Empire - La Kessel Run", // C : 14h-17h
      pitch: "Du contrebandier a l'hero de la Rebellion. Univers Star Wars canonique.",
      maxPlayers: 5,
      startDateTime: new Date("2026-07-18T13:00:00.000Z"),
      endDateTime: new Date("2026-07-18T16:00:00.000Z"),
      tags: ["jdr", "initiation"],
    },

    // --- Jour 19 : 3 tables vraiment simultanees ---
    {
      title: "Blades in the Dark - Le Gang des Cendres",
      pitch: "Jeu de braquage dans une ville victorienne fantasmagorique.",
      maxPlayers: 4,
      startDateTime: new Date("2026-07-19T08:00:00.000Z"),
      endDateTime: new Date("2026-07-19T12:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Monster of the Week - Nuit des Createurs",
      pitch: "Chasseurs de monstres dans l'Amerique contemporaine. Inspire de Supernatural.",
      maxPlayers: 4,
      startDateTime: new Date("2026-07-19T08:00:00.000Z"),
      endDateTime: new Date("2026-07-19T12:00:00.000Z"),
      tags: ["jdr", "initiation"],
    },
    {
      title: "Ironsworn - Terres de Fer",
      pitch: "JDR solo ou cooperatif sans MJ dans un monde de fantasy nordique.",
      maxPlayers: 3,
      startDateTime: new Date("2026-07-19T08:00:00.000Z"),
      endDateTime: new Date("2026-07-19T12:00:00.000Z"),
      tags: ["jdr"],
    },

    // --- Jour 20 : mix complexe ---
    // Alien : 10h-12h (col 0)    Delta Green : 10h-12h (col 1)    Dungeon World : 10h-17h (col 2, span)
    // Mothership : 14h-17h (col 0)
    // Resultat attendu :
    //   Alien | Delta Green | Dungeon World
    //   Mothership | (vide) | Dungeon World
    {
      title: "Alien RPG - Chariot des Dieux",
      pitch: "Survival horror dans l'espace. Scenario officiel. Deconseille aux ames sensibles.",
      maxPlayers: 5,
      startDateTime: new Date("2026-07-20T08:00:00.000Z"),
      endDateTime: new Date("2026-07-20T11:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Delta Green - Operation OUTLOOK",
      pitch: "Agents gouvernementaux face a l'indicible. Horreur lovecraftienne contemporaine.",
      maxPlayers: 4,
      startDateTime: new Date("2026-07-20T08:00:00.000Z"),
      endDateTime: new Date("2026-07-20T11:00:00.000Z"),
      tags: ["jdr"],
    },
    {
      title: "Dungeon World - La Tour du Sorcier", // longue, chevauche tout
      pitch:
        "JDR narratif fantasy leger. Ideal pour joueurs voulant un rythme rapide et cinematique.",
      maxPlayers: 5,
      startDateTime: new Date("2026-07-20T08:00:00.000Z"),
      endDateTime: new Date("2026-07-20T16:00:00.000Z"),
      tags: ["jdr", "initiation"],
    },
    {
      title: "Mothership - Station Terreur",
      pitch: "Sci-fi horror old school. Equipage en perdition sur une station abandonnee.",
      maxPlayers: 4,
      startDateTime: new Date("2026-07-20T13:00:00.000Z"),
      endDateTime: new Date("2026-07-20T16:00:00.000Z"),
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
      startDateTime: new Date("2026-07-20T00:30:00.000Z"),
      endDateTime: new Date("2026-07-20T03:30:00.000Z"),
      tags: ["coopératif", "strategie"],
    },
    {
      type: "JDS",
      boardGameName: "Wingspan",
      title: "Wingspan - Tournoi des Oiseaux",
      pitch:
        "Construisez le sanctuaire d'oiseaux le plus attractif. Partie competitive 3-5 joueurs.",
      maxPlayers: 5,
      startDateTime: new Date("2026-07-17T14:00:00.000Z"),
      endDateTime: new Date("2026-07-17T16:30:00.000Z"),
      tags: ["familial", "strategie"],
    },
    {
      type: "JDS",
      boardGameName: "Ark Nova",
      title: "Ark Nova - Zoo en construction",
      pitch:
        "Concevez un zoo moderne en soutenant des projets de conservation. Jeu dense, initiation possible.",
      maxPlayers: 4,
      startDateTime: new Date("2026-07-19T13:00:00.000Z"),
      endDateTime: new Date("2026-07-19T17:00:00.000Z"),
      tags: ["strategie"],
    },
    {
      type: "JDS",
      title: "Partie libre JDS - apportez vos jeux",
      pitch: "Table ouverte pour toute partie de jeu de societe. Jeux du coin ou les votres.",
      maxPlayers: 8,
      startDateTime: new Date("2026-07-16T18:00:00.000Z"),
      endDateTime: new Date("2026-07-16T21:00:00.000Z"),
      tags: ["familial"],
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
          startDateTime: t.startDateTime,
          endDateTime: t.endDateTime,
          boardGameId,
        },
      });

      // Ajouter admin comme participant GM
      await prisma.gameTableParticipant.create({
        data: { gameTableId: table.id, userId: admin.id, status: "CONFIRMED" },
      });

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
