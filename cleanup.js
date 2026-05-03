const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.question.deleteMany({
    where: {
      questionText: "Test Question"
    }
  });
  console.log("Deleted count:", result.count);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
