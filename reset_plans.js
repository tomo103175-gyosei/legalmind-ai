const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    data: { plan: 'FREE' }
  });
  console.log(`Updated ${result.count} users to FREE.`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
