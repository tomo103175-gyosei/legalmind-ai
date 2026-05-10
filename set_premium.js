const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setPremium() {
  const email = 'tomo103175@gmail.com';
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { plan: 'PREMIUM' },
    });
    console.log(`User ${email} updated to PREMIUM.`);
    console.log(user);
  } catch (error) {
    console.error('Error updating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setPremium();
