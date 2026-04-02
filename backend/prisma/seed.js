// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

// Comptes admin crees automatiquement en local et preprod
// Pour la prod, utiliser le script one-shot via docker exec
const DEV_ADMINS = [
  { email: "admin@local.dev", username: "admin", password: "admin123" },
];

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
  for (const g of gamesData) {
    let bg = await prisma.boardGame.findFirst({ where: { name: g.name } });
    if (!bg) {
      bg = await prisma.boardGame.create({ data: g });
      console.log(`Jeu cree : ${g.name}`);
    } else {
      console.log(`Jeu deja existant, ignore : ${g.name}`);
    }
    boardGames.push(bg);
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
  const tablesData = [
    {
      title: "Partie de Wingspan",
      pitch: "Une partie de Wingspan pour decouvrir ce magnifique jeu d'oiseaux. Convient aux debutants.",
      maxPlayers: 4,
      startDateTime: new Date("2026-07-16T14:00:00.000Z"),
      endDateTime: new Date("2026-07-16T16:00:00.000Z"),
      tags: ["strategie", "initiation"],
    },
    {
      title: "Spirit Island - Initiation",
      pitch: "Introduction a Spirit Island, jeu cooperatif de defense d'ile. On jouera avec les esprits de base.",
      triggers: "Themes de colonisation",
      maxPlayers: 4,
      startDateTime: new Date("2026-07-17T10:00:00.000Z"),
      endDateTime: new Date("2026-07-17T13:00:00.000Z"),
      tags: ["coopératif", "initiation"],
    },
    {
      title: "Ark Nova - Partie complete",
      pitch: "Construction de zoo, gestion de ressources. Pour joueurs experimentes.",
      maxPlayers: 3,
      startDateTime: new Date("2026-07-18T15:00:00.000Z"),
      endDateTime: new Date("2026-07-18T17:30:00.000Z"),
      tags: ["strategie"],
    },
  ];

  for (const t of tablesData) {
    const existing = await prisma.gameTable.findFirst({
      where: { eventId: event.id, title: t.title },
    });

    if (!existing) {
      const table = await prisma.gameTable.create({
        data: {
          eventId: event.id,
          createdBy: admin.id,
          title: t.title,
          pitch: t.pitch || null,
          triggers: t.triggers || null,
          comments: null,
          maxPlayers: t.maxPlayers,
          startDateTime: t.startDateTime,
          endDateTime: t.endDateTime,
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
  await seedDemoData();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
