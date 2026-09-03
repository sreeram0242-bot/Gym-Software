const prisma = require('./lib/db').default;

async function main() {
  const commands = await prisma.biometricCommand.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log("RECENT COMMANDS:", JSON.stringify(commands, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
