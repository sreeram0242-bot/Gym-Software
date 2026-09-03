const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function check() {
  const customers = await prisma.customer.findMany({
    select: { name: true, fingerprintId: true }
  });
  console.log("CUSTOMERS:");
  console.log(customers);
}
check().finally(() => prisma.$disconnect());
