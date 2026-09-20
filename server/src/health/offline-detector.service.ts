import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../common/event-bus.service';
import * as crypto from 'crypto';

@Injectable()
export class OfflineDetectorService {
  private readonly logger = new Logger(OfflineDetectorService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  @Cron('*/5 * * * * *') // Runs every 5 seconds
  async checkHealth() {
    const now = Date.now();
    const nodeTimeoutFloor = new Date(now - 20 * 1000); // 20s heartbeat timeout
    const cameraTimeoutFloor = new Date(now - 15 * 1000); // 15s frame timeout

    // 1. Check Edge Nodes for Dead-man's Switch
    const deadNodes = await this.prisma.edgeNode.findMany({
      where: {
        status: 'online',
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: nodeTimeoutFloor } }],
      },
      include: { site: true },
    });

    for (const node of deadNodes) {
      await this.prisma.edgeNode.update({
        where: { id: node.id },
        data: { status: 'offline' },
      });

      this.logger.warn(`[DEAD-MAN SWITCH] Edge node ${node.id} (${node.name}) has timed out (>20s). Marking OFFLINE.`);

      // Broadcast telemetry
      this.eventBus.emit('alert', {
        seq: 0,
        type: 'edge.health',
        data: { nodeId: node.id, status: 'offline', lastSeenAt: node.lastSeenAt },
      });

      // Raise WARNING system alert
      const alertId = `sys-node-${node.id}-${Math.floor(now / 60000)}`;
      const existing = await this.prisma.alert.findUnique({ where: { id: alertId } });
      if (!existing) {
        const firstCam = await this.prisma.camera.findFirst({ where: { edgeNodeId: node.id } });
        if (firstCam) {
          const sysAlert = await this.prisma.alert.create({
            data: {
              id: alertId,
              cameraId: firstCam.id,
              dedupKey: `sys_node_${node.id}`,
              severity: 'WARNING',
              type: 'system_offline',
              items: JSON.stringify(['edge_node_heartbeat_timeout']),
              confidence: 1.0,
              hitCount: 1,
              firstSeenAt: new Date(),
              lastSeenAt: new Date(),
              status: 'OPEN',
              version: 1,
              note: `Edge node ${node.name} missed heartbeats for >20 seconds. Monitoring unavailable.`,
            },
          });

          const ev = await this.prisma.alertEvent.create({
            data: {
              alertId: sysAlert.id,
              kind: 'created',
              payload: JSON.stringify(sysAlert),
            },
          });

          this.eventBus.emit('alert', {
            seq: ev.seq,
            type: 'alert.created',
            data: sysAlert,
          });
        }
      }
    }

    // 2. Check Cameras for Dead Video Streams
    const stalledCameras = await this.prisma.camera.findMany({
      where: {
        enabled: true,
        status: 'online',
        OR: [{ lastFrameAt: null }, { lastFrameAt: { lt: cameraTimeoutFloor } }],
      },
    });

    for (const cam of stalledCameras) {
      await this.prisma.camera.update({
        where: { id: cam.id },
        data: { status: 'stalled' },
      });

      this.logger.warn(`[CAMERA STALLED] Camera ${cam.id} (${cam.name}) stopped streaming frames (>15s). Marking STALLED.`);

      this.eventBus.emit('alert', {
        seq: 0,
        type: 'camera.status',
        data: { cameraId: cam.id, status: 'stalled', lastFrameAt: cam.lastFrameAt },
      });
    }
  }
}
