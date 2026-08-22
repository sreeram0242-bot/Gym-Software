import prisma from './lib/db';

async function main() {
  const gym = await prisma.gym.create({
    data: {
      name: 'Test Gym',
      ownerName: 'Test Owner',
      email: 'test@gym.com',
      phone: '1234567890',
      userId: 'admin',
      passwordHash: 'admin123',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      memberCount: 0
    }
  });
  console.log('Created test gym successfully!');
  console.log('User ID:', gym.userId);
  console.log('Password:', gym.passwordHash);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
