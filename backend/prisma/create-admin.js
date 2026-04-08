// Script one-shot pour creer un admin en production
// Ne jamais inclure dans le seed automatique
//
// Usage:
//   docker exec \
//     -e ADMIN_EMAIL=toi@example.com \
//     -e ADMIN_USERNAME=admin \
//     -e ADMIN_PASSWORD=motdepasse_fort \
//     tommanager-backend \
//     node prisma/create-admin.js

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !username || !password) {
    console.error("Variables requises : ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD");
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    console.log(`Deja existant, rien a faire : ${username} (${email})`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, username, passwordHash, role: "ADMIN" },
  });

  console.log(`Admin cree : ${username} (${email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
