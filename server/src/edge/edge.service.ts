import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../common/event-bus.service';
import * as fs from 'fs';
import * as path from 'path';

export interface AlertIngestDto {
  id: string; // UUID from edge
  cameraId: string;
  dedupKey: string;
  severity: 'CRITICAL' | 'WARNING' | 'COMPLIANCE';
  type: string;
  items?: string[];
  confidence: number;
  votes?: string;
  ts?: string;
}

export interface HeartbeatDto {
  fps?: number;
  latencyMs?: number;
  cpu?: number;
  temp?: number;
  cameras?: Array<{
    id: string;
    status?: string;
    lastFrameAt?: string;
    fps?: number;
  }>;
}

@Injectable()
export class EdgeService {
  private readonly logger = new Logger(EdgeService.name);
  private readonly cooldownMs = 60 * 1000; // 60s secondary deduplication floor

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async saveSnapshot(alertId: string, buffer?: Buffer): Promise<string | null> {
    if (!buffer || buffer.length === 0) return null;

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const baseDir = process.env.SNAPSHOTS_DIR || 'snapshots';
    const targetDir = path.join(baseDir, year, month, day);
    fs.mkdirSync(targetDir, { recursive: true });

    const filePath = path.join(targetDir, `${alertId}.jpg`);
    fs.writeFileSync(filePath, buffer);
    return filePath.replace(/\\/g, '/');
  }

  async ingestAlert(edgeNode: any, dto: AlertIngestDto, snapshotBuffer?: Buffer) {
    const rawDto = dto as any;
    const alertId = rawDto.id;
    const cameraId = rawDto.cameraId || rawDto.camera_id;
    const dedupKey = rawDto.dedupKey || rawDto.dedup_key || `${cameraId}:${rawDto.zone_id || rawDto.zoneId || 'zone'}:${rawDto.type}`;
    const severity = (rawDto.severity || 'COMPLIANCE').toUpperCase();
    const alertType = rawDto.type || 'unknown';
    const items = Array.isArray(rawDto.items) ? rawDto.items : [];
    const confidence = typeof rawDto.confidence === 'number' ? rawDto.confidence : 0.85;
    const votes = rawDto.votes || null;
    const timestamp = rawDto.ts ? new Date(rawDto.ts) : new Date();

    // 1. Idempotency Check: if alert with this exact ID already exists, return 200 OK (no-op)
    const existing = await this.prisma.alert.findUnique({ where: { id: alertId } });
    if (existing) {
      this.logger.debug(`[IDEMPOTENT] Alert ${alertId} already ingested. Skipping.`);
      return { ok: true, status: 'already_exists' };
    }

    // 2. Secondary Deduplication Window Check
    const floor = new Date(Date.now() - this.cooldownMs);
    const openIncident = await this.prisma.alert.findFirst({
      where: {
        cameraId,
        dedupKey,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        lastSeenAt: { gte: floor },
      },
    });

    let savedAlert: any;
    let eventKind: 'created' | 'updated';

    if (openIncident) {
      // Incident is still open within cooldown window -> Increment hitCount and update confidence
      savedAlert = await this.prisma.alert.update({
        where: { id: openIncident.id },
        data: {
          hitCount: { increment: 1 },
          lastSeenAt: timestamp,
          confidence: Math.max(openIncident.confidence, confidence),
          version: { increment: 1 },
        },
      });
      eventKind = 'updated';
      this.logger.log(`[DEDUP] Updated ongoing incident ${openIncident.id} (${openIncident.dedupKey}, hits: ${savedAlert.hitCount})`);
    } else {
      // New incident -> Save snapshot and create row
      const snapshotPath = await this.saveSnapshot(alertId, snapshotBuffer);
      savedAlert = await this.prisma.alert.create({
        data: {
          id: alertId,
          cameraId,
          dedupKey,
          severity,
          type: alertType,
          items: JSON.stringify(items),
          confidence,
          votes,
          hitCount: 1,
          firstSeenAt: timestamp,
          lastSeenAt: timestamp,
          status: 'OPEN',
          version: 1,
          snapshotPath,
        },
      });
      eventKind = 'created';
      this.logger.warn(`[NEW ALERT] Created ${savedAlert.severity} alert ${savedAlert.id} on camera ${savedAlert.cameraId} (${savedAlert.type})`);
    }

    // 3. Create sequential AlertEvent record to drive gapless WebSocket replay
    const event = await this.prisma.alertEvent.create({
      data: {
        alertId: savedAlert.id,
        kind: eventKind,
        payload: JSON.stringify(savedAlert),
        createdAt: new Date(),
      },
    });

    // 4. Emit event on event bus AFTER commit
    this.eventBus.emit('alert', {
      seq: event.seq,
      type: eventKind === 'created' ? 'alert.created' : 'alert.updated',
      data: savedAlert,
    });

    return { ok: true, alertId: savedAlert.id, seq: event.seq };
  }

  async processHeartbeat(edgeNode: any, dto: HeartbeatDto) {
    const now = new Date();
    const rawDto = dto as any;

    // Update EdgeNode telemetry
    await this.prisma.edgeNode.updateMany({
      where: { id: edgeNode.id },
      data: {
        lastSeenAt: now,
        status: 'online',
        fps: rawDto.fps || null,
        latencyMs: rawDto.latencyMs || null,
      },
    });

    // Update camera statuses
    const cameraList = rawDto.cameras || [];
    if (cameraList.length > 0) {
      for (const cam of cameraList) {
        await this.prisma.camera.updateMany({
          where: { id: cam.id || cam.camera_id },
          data: {
            status: cam.status || 'online',
            lastFrameAt: cam.lastFrameAt ? new Date(cam.lastFrameAt) : now,
          },
        });
      }
    }

    // Unlatching mechanism: find acknowledged/resolved alerts to unlatch physical alarm
    const clearedAlerts = await this.prisma.alert.findMany({
      where: {
        status: { in: ['ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'] },
        camera: { edgeNodeId: edgeNode.id },
      },
      select: { id: true },
    });
    const clearAlarms = clearedAlerts.map((a) => a.id);

    // Get current config version
    const cfg = await this.prisma.configState.findFirst({ where: { id: 1 } });

    return {
      ok: true,
      configVersion: cfg ? cfg.version : 1,
      clearAlarms,
    };
  }

  async getConfig(edgeNode: any) {
    const cameras = await this.prisma.camera.findMany({
      where: { edgeNodeId: edgeNode.id, enabled: true },
      include: { zones: true },
    });

    const activeModel = await this.prisma.modelVersion.findFirst({ where: { active: true } });
    const configState = await this.prisma.configState.findFirst({ where: { id: 1 } });

    const params = configState ? JSON.parse(configState.params) : {};
    const thresholds = activeModel ? JSON.parse(activeModel.thresholds) : {};

    const payload = {
      configVersion: configState ? configState.version : 1,
      cooldownSeconds: params.cooldown_seconds || 60,
      voterParams: {
        fire_window: params.fire_window || 5,
        fire_threshold: params.fire_threshold || 2,
        smoke_window: params.smoke_window || 5,
        smoke_threshold: params.smoke_threshold || 2,
        smoking_window: params.smoking_window || 8,
        smoking_threshold: params.smoking_threshold || 4,
        ppe_window: params.ppe_window || 10,
        ppe_threshold: params.ppe_threshold || 8,
      },
      thresholds,
      activeModel: activeModel ? activeModel.name : 'ppe_v1_s2_yolo11s',
      cameras: cameras.map((c) => ({
        id: c.id,
        name: c.name,
        streamUrl: c.streamUrlEnc, // Sent directly over protected LAN
        zones: c.zones.map((z) => ({
          id: z.id,
          kind: z.kind,
          polygon: JSON.parse(z.polygon),
        })),
      })),
    };

    return payload;
  }
}
