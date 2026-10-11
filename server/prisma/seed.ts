import { PrismaClient } from '../generated/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('[*] Seeding database...');

  // 1. Users
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('admin123', salt);
  const supervisorPasswordHash = await bcrypt.hash('supervisor123', salt);
  const viewerPasswordHash = await bcrypt.hash('operator123', salt);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@factory.ai' },
    update: {},
    create: {
      email: 'admin@factory.ai',
      name: 'System Admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@factory.ai' },
    update: {},
    create: {
      email: 'supervisor@factory.ai',
      name: 'Shift Supervisor',
      passwordHash: supervisorPasswordHash,
      role: 'SUPERVISOR',
    },
  });

  await prisma.user.upsert({
    where: { email: 'operator@factory.ai' },
    update: {},
    create: {
      email: 'operator@factory.ai',
      name: 'Safety Operator',
      passwordHash: viewerPasswordHash,
      role: 'VIEWER',
    },
  });

  console.log(`[OK] Seeded Users: ${admin.email}, ${supervisor.email}`);

  // 2. Site
  let site = await prisma.site.findFirst();
  if (!site) {
    site = await prisma.site.create({
      data: { name: 'Main Industrial Complex - Plant 1' },
    });
  }

  // 3. Sector
  let sector = await prisma.sector.findFirst({ where: { siteId: site.id } });
  if (!sector) {
    sector = await prisma.sector.create({
      data: {
        siteId: site.id,
        name: 'Sector 1 (Furnace & Assembly)',
      },
    });
  }

  // 4. Edge Node
  const rawApiKey = process.env.EDGE_API_KEY || 'edge-api-key-factory-plant-01';
  const apiKeyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');

  let edgeNode = await prisma.edgeNode.findFirst({ where: { siteId: site.id } });
  if (!edgeNode) {
    edgeNode = await prisma.edgeNode.create({
      data: {
        id: 'edge-node-01',
        siteId: site.id,
        name: 'Factory Edge NUC-01',
        apiKeyHash,
        status: 'unknown',
        fps: 28.5,
        latencyMs: 14.2,
        lastSeenAt: null,
      },
    });
  }

  // 5. Cameras
  const defaultCameras = [
    { id: 'cam-01', name: 'Assembly Line A', streamUrl: 'synthetic' },
    { id: 'cam-02', name: 'Boiler & Steam Room', streamUrl: 'synthetic' },
    { id: 'cam-03', name: 'Chemical Storage', streamUrl: 'synthetic' },
    { id: 'cam-04', name: 'Welding & Fabrication', streamUrl: 'synthetic' },
  ];

  for (const c of defaultCameras) {
    const current = await prisma.camera.findUnique({ where: { id: c.id } });
    if (current?.streamUrlEnc === `rtsp://mock/${c.id}`) {
      await prisma.$transaction(async tx => {
        await tx.camera.update({ where: { id: c.id }, data: { streamUrlEnc: 'synthetic', status: 'unknown', lastFrameAt: null } });
        await tx.configState.upsert({ where: { id: 1 }, update: { version: { increment: 1 } }, create: { id: 1, version: 1, params: '{}' } });
        await tx.auditLog.create({ data: { action: 'normalize_demo_source', entity: 'camera', entityId: c.id, meta: JSON.stringify({ from: current.streamUrlEnc, to: 'synthetic', reason: 'Replace the nonfunctional seeded placeholder with an explicitly labeled demonstration source' }) } });
      });
    }
    await prisma.camera.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        name: c.name,
        sectorId: sector.id,
        edgeNodeId: edgeNode.id,
        streamUrlEnc: c.streamUrl,
        enabled: true,
        status: 'unknown',
        lastFrameAt: null,
      },
    });
  }
  console.log(`[OK] Seeded 4 Cameras for Sector: ${sector.name}`);

  // 6. Zones
  const existingZones = await prisma.zone.count();
  if (existingZones === 0) {
    await prisma.zone.create({
      data: {
        cameraId: 'cam-01',
        kind: 'PPE_REQUIRED',
        polygon: JSON.stringify([[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]]),
      },
    });
    await prisma.zone.create({
      data: {
        cameraId: 'cam-02',
        kind: 'SMOKING_RESTRICTED',
        polygon: JSON.stringify([[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]),
      },
    });
    await prisma.zone.create({
      data: {
        cameraId: 'cam-03',
        kind: 'SMOKING_RESTRICTED',
        polygon: JSON.stringify([[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]),
      },
    });
  }

  // Register supported model files without changing an existing selection.
  const activeModel = await prisma.modelVersion.findFirst({ where: { active: true } });
  for (const name of ['best_s5', 'best_s4']) {
    await prisma.modelVersion.upsert({
      where: { name }, update: {},
      create: { name, active: !activeModel && name === 'best_s5', metrics: '{}',
        thresholds: JSON.stringify({ person: .5, helmet: .65, head: .3, vest: .65, gloves: .3, boots: .3, no_gloves: .35, no_boots: .35, fire: .3, smoke: .25, cigarette: .3 }) },
    });
  }

  // 8. Config State
  await prisma.configState.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      version: 1,
      params: JSON.stringify({
        fire_window: 5,
        fire_threshold: 2,
        smoke_window: 5,
        smoke_threshold: 2,
        smoking_window: 8,
        smoking_threshold: 4,
        ppe_window: 10,
        ppe_threshold: 8,
        cooldown_seconds: 60,
      }),
    },
  });

  console.log('[OK] Database Seed Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('[!] Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
