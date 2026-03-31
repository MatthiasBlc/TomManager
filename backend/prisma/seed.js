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

async function main() {
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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
