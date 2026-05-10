const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Explicitly point to the generated prisma client if needed, 
// but usually require('@prisma/client') works if run from the project root.
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: { questions: true }
      }
    }
  });
  if (users.length === 0) {
    console.log('No users found in database.');
    return;
  }
  console.log('--- User Status ---');
  users.forEach(u => {
    console.log(`ID: ${u.id}`);
    console.log(`Email: ${u.email}`);
    console.log(`Plan: ${u.plan}`);
    console.log(`DailyCount: ${u.dailyUploadCount}`);
    console.log(`TotalQuestions: ${u._count.questions}`);
    console.log('-------------------');
  });
}

main().catch(e => {
  console.error('Error running script:', e);
}).finally(() => prisma.$disconnect());
