const { PrismaClient } = require('./generated/client');
const p = new PrismaClient();

async function main() {
  const open = await p.alert.count({ where: { status: 'OPEN' } });
  const total = await p.alert.count();
  const events = await p.alertEvent.count();
  console.log('Open alerts:', open);
  console.log('Total alerts:', total);
  console.log('Alert events:', events);
  await p.$disconnect();
}

main().catch(e => { console.error(e.message); p.$disconnect(); });
