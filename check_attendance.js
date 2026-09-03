const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function check() {
  const atts = await prisma.attendanceRecord.findMany({
    orderBy: { checkInTime: 'desc' },
    take: 5
  });
  console.log("RECENT ATTENDANCE:");
  console.log(atts);
}
check().finally(() => prisma.$disconnect());
