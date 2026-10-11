/**
 * clean-demo-db.js
 * Resets all Alert, AlertEvent, AlertReceipt data.
 * Preserves: Users, EdgeNode, Camera, Sector, Zone, ModelVersion, ConfigState.
 * Then inserts a handful of realistic demo incidents for a judge demo.
 *
 * Usage: node clean-demo-db.js
 */
const { PrismaClient } = require('./generated/client');
const p = new PrismaClient();

async function main() {
  console.log('Cleaning demo database...');

  // Delete in FK-safe order
  await p.alertEvent.deleteMany({});
  await p.alertReceipt.deleteMany({});
  await p.alert.deleteMany({});
  console.log('✓ Cleared all incidents');

  // Fetch needed IDs
  const cameras = await p.camera.findMany({ take: 4, orderBy: { id: 'asc' } });
  if (!cameras.length) {
    console.error('No cameras found. Seed the database first with: npm run seed');
    await p.$disconnect();
    return;
  }

  const now = new Date();
  const ago = (minutes) => new Date(now.getTime() - minutes * 60 * 1000);

  const incidents = [
    // CRITICAL — Fire
    {
      id: 'demo-fire-001',
      cameraId: cameras[0].id,
      dedupKey: 'fire::cam-01',
      severity: 'CRITICAL',
      type: 'fire',
      items: JSON.stringify(['fire']),
      confidence: 0.94,
      votes: '4/5',
      hitCount: 4,
      status: 'OPEN',
      firstSeenAt: ago(3),
      lastSeenAt: ago(2),
      snapshotPath: null,
      version: 1,
      modelVersion: 'best_s5',
    },
    // CRITICAL — Smoke
    {
      id: 'demo-smoke-001',
      cameraId: cameras[1]?.id || cameras[0].id,
      dedupKey: 'smoke::cam-02',
      severity: 'CRITICAL',
      type: 'smoke',
      items: JSON.stringify(['smoke']),
      confidence: 0.88,
      votes: '3/5',
      hitCount: 3,
      status: 'ACKNOWLEDGED',
      firstSeenAt: ago(12),
      lastSeenAt: ago(10),
      snapshotPath: null,
      version: 2,
      modelVersion: 'best_s5',
      ackAt: ago(9),
      ackById: 'supervisor@factory.ai',
    },
    // WARNING — No helmet
    {
      id: 'demo-ppe-001',
      cameraId: cameras[0].id,
      dedupKey: 'missing_ppe:head::cam-01',
      severity: 'WARNING',
      type: 'missing_ppe',
      items: JSON.stringify(['head']),
      confidence: 0.78,
      votes: '9/10',
      hitCount: 9,
      status: 'OPEN',
      firstSeenAt: ago(8),
      lastSeenAt: ago(7),
      snapshotPath: null,
      version: 1,
      modelVersion: 'best_s5',
    },
    // WARNING — No gloves
    {
      id: 'demo-ppe-002',
      cameraId: cameras[2]?.id || cameras[0].id,
      dedupKey: 'missing_ppe:no_gloves::cam-03',
      severity: 'COMPLIANCE',
      type: 'missing_ppe',
      items: JSON.stringify(['no_gloves']),
      confidence: 0.71,
      votes: '8/10',
      hitCount: 8,
      status: 'OPEN',
      firstSeenAt: ago(5),
      lastSeenAt: ago(4),
      snapshotPath: null,
      version: 1,
      modelVersion: 'best_s5',
    },
    // RESOLVED — No vest (already handled)
    {
      id: 'demo-ppe-003',
      cameraId: cameras[3]?.id || cameras[0].id,
      dedupKey: 'missing_ppe:vest::cam-04',
      severity: 'COMPLIANCE',
      type: 'missing_ppe',
      items: JSON.stringify(['vest']),
      confidence: 0.82,
      votes: '10/10',
      hitCount: 10,
      status: 'RESOLVED',
      firstSeenAt: ago(60),
      lastSeenAt: ago(58),
      snapshotPath: null,
      version: 3,
      modelVersion: 'best_s5',
      ackAt: ago(55),
      ackById: 'supervisor@factory.ai',
      resolvedAt: ago(50),
      note: 'Worker confirmed vest retrieved from locker.',
    },
    // WARNING — Smoking in restricted zone
    {
      id: 'demo-smoking-001',
      cameraId: cameras[1]?.id || cameras[0].id,
      dedupKey: 'smoking::cam-02',
      severity: 'WARNING',
      type: 'smoking',
      items: JSON.stringify(['cigarette']),
      confidence: 0.67,
      votes: '4/8',
      hitCount: 4,
      status: 'OPEN',
      firstSeenAt: ago(15),
      lastSeenAt: ago(14),
      snapshotPath: null,
      version: 1,
      modelVersion: 'best_s5',
    },
  ];

  for (const inc of incidents) {
    const created = await p.alert.create({ data: inc });
    await p.alertEvent.create({
      data: {
        alertId: created.id,
        kind: 'created',
        payload: JSON.stringify({ id: created.id, type: created.type }),
      },
    });
    if (inc.status === 'ACKNOWLEDGED' || inc.status === 'RESOLVED') {
      await p.alertEvent.create({
        data: {
          alertId: created.id,
          kind: 'updated',
          payload: JSON.stringify({ id: created.id, type: created.type, status: created.status }),
        },
      });
    }
    await p.alertReceipt.create({ data: { id: inc.id, alertId: created.id } });
    console.log(`✓ Created ${inc.severity} ${inc.type} [${inc.status}] — ${inc.id}`);
  }

  const finalOpen = await p.alert.count({ where: { status: 'OPEN' } });
  const finalTotal = await p.alert.count();
  console.log(`\nDemo database ready: ${finalOpen} open / ${finalTotal} total incidents`);
  console.log('Login: http://localhost:3000 → supervisor@factory.ai / supervisor123');
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e.message);
  await p.$disconnect();
  process.exit(1);
});
