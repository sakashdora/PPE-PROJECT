import { PrismaClient } from '@prisma/client';
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
    update: { passwordHash: adminPasswordHash, role: 'ADMIN' },
    create: {
      email: 'admin@factory.ai',
      name: 'System Admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@factory.ai' },
    update: { passwordHash: supervisorPasswordHash, role: 'SUPERVISOR' },
    create: {
      email: 'supervisor@factory.ai',
      name: 'Shift Supervisor',
      passwordHash: supervisorPasswordHash,
      role: 'SUPERVISOR',
    },
  });

  await prisma.user.upsert({
    where: { email: 'operator@factory.ai' },
    update: { passwordHash: viewerPasswordHash, role: 'VIEWER' },
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
        status: 'online',
        fps: 28.5,
        latencyMs: 14.2,
        lastSeenAt: new Date(),
      },
    });
  }

  // 5. Cameras
  const defaultCameras = [
    { id: 'cam-01', name: 'Assembly Line A', streamUrl: 'rtsp://mock/cam-01' },
    { id: 'cam-02', name: 'Boiler & Steam Room', streamUrl: 'rtsp://mock/cam-02' },
    { id: 'cam-03', name: 'Chemical Storage', streamUrl: 'rtsp://mock/cam-03' },
    { id: 'cam-04', name: 'Welding & Fabrication', streamUrl: 'rtsp://mock/cam-04' },
  ];

  for (const c of defaultCameras) {
    await prisma.camera.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        streamUrlEnc: c.streamUrl,
        status: 'online',
        lastFrameAt: new Date(),
      },
      create: {
        id: c.id,
        name: c.name,
        sectorId: sector.id,
        edgeNodeId: edgeNode.id,
        streamUrlEnc: c.streamUrl,
        enabled: true,
        status: 'online',
        lastFrameAt: new Date(),
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

  // 7. Active Model Version
  await prisma.modelVersion.upsert({
    where: { name: 'ppe_v1_s2_yolo11s' },
    update: { active: true },
    create: {
      name: 'ppe_v1_s2_yolo11s',
      active: true,
      metrics: JSON.stringify({
        precision: 0.843,
        recall: 0.721,
        mAP50: 0.771,
        mAP50_95: 0.520,
      }),
      thresholds: JSON.stringify({
        person: 0.50,
        helmet: 0.70,
        head: 0.65,
        vest: 0.65,
        gloves: 0.60,
        boots: 0.60,
        no_gloves: 0.60,
        no_boots: 0.60,
        fire: 0.35,
        smoke: 0.30,
        cigarette: 0.50,
      }),
    },
  });

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
