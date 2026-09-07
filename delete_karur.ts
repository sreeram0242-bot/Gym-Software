import prisma from './lib/db';

async function main() {
  const gym = await prisma.gym.findFirst({
    where: { name: { contains: 'Karur Fitness', mode: 'insensitive' } }
  });

  if (gym) {
    console.log(`Found gym: ${gym.name} (ID: ${gym.id}). Deleting references...`);
    
    const sales = await prisma.productSale.findMany({ where: { gymId: gym.id } });
    if (sales.length > 0) {
      await prisma.productSaleItem.deleteMany({
        where: { saleId: { in: sales.map(s => s.id) } }
      });
    }

    // Also delete any product sale items linked to products of this gym (just in case)
    const products = await prisma.product.findMany({ where: { gymId: gym.id } });
    if (products.length > 0) {
      await prisma.productSaleItem.deleteMany({
        where: { productId: { in: products.map(p => p.id) } }
      });
    }

    await prisma.gym.delete({
      where: { id: gym.id }
    });
    console.log(`Successfully deleted gym: ${gym.name}`);
  } else {
    console.log('No gym found matching "Karur Fitness"');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
