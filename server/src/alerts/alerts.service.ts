import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../common/event-bus.service';
import { AuditService } from '../audit/audit.service';
import * as fs from 'fs';
import * as path from 'path';

export interface TransitionDto {
  action?: 'ack' | 'resolve' | 'false_alarm';
  status?: string;
  expectedVersion: number;
  note?: string;
}

@Injectable()
export class AlertsService {
  private readonly allowedFrom = {
    ack: ['OPEN'],
    resolve: ['OPEN', 'ACKNOWLEDGED'],
    false_alarm: ['OPEN', 'ACKNOWLEDGED'],
  } as const;

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private audit: AuditService,
  ) {}

  async listAlerts(query: {
    status?: string;
    severity?: string;
    cameraId?: string;
    camera_id?: string;
    from?: string;
    to?: string;
    cursor?: any;
    limit?: number;
  }) {
    const take = Math.min(query.limit || 50, 100);
    const cursor = query.cursor ? (typeof query.cursor === 'string' ? { id: query.cursor } : undefined) : undefined;

    const where: any = {};
    if (query.status) where.status = query.status.toUpperCase();
    if (query.severity) where.severity = query.severity.toUpperCase();
    if (query.camera_id || query.cameraId) where.cameraId = query.camera_id || query.cameraId;

    if (query.from || query.to) {
      where.firstSeenAt = {};
      if (query.from) where.firstSeenAt.gte = new Date(query.from);
      if (query.to) where.firstSeenAt.lte = new Date(query.to);
    }

    const items = await this.prisma.alert.findMany({
      where,
      orderBy: [{ firstSeenAt: 'desc' }, { id: 'desc' }],
      take,
      cursor,
      skip: cursor ? 1 : 0,
      include: {
        camera: { select: { id: true, name: true, sector: { select: { id: true, name: true } } } },
      },
    });

    return items.map((a) => ({
      ...a,
      items: JSON.parse(a.items || '[]'),
    }));
  }

  async getAlertById(id: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: {
        camera: { select: { id: true, name: true, sector: { select: { id: true, name: true } } } },
      },
    });
    if (!alert) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: `Alert ${id} not found` });
    }
    return {
      ...alert,
      items: JSON.parse(alert.items || '[]'),
    };
  }

  async getSnapshotPath(id: string): Promise<string> {
    const alert = await this.prisma.alert.findUnique({ where: { id }, select: { snapshotPath: true } });
    if (!alert || !alert.snapshotPath) {
      throw new NotFoundException({ code: 'SNAPSHOT_NOT_FOUND', message: 'Snapshot does not exist for this alert' });
    }
    const resolvedPath = path.resolve(alert.snapshotPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'Snapshot file missing from storage' });
    }
    return resolvedPath;
  }

  async transition(id: string, user: any, dto: TransitionDto) {
    let action = dto.action;
    if (!action && dto.status) {
      const s = String(dto.status).toUpperCase();
      if (s === 'ACKNOWLEDGED' || s === 'ACK') action = 'ack';
      else if (s === 'RESOLVED' || s === 'RESOLVE') action = 'resolve';
      else if (s === 'FALSE_ALARM') action = 'false_alarm';
    }

    if (!action || !this.allowedFrom[action]) {
      throw new BadRequestException({ code: 'INVALID_ACTION', message: `Unknown action or status ${action || dto.status}` });
    }

    const nextStatusMap = {
      ack: 'ACKNOWLEDGED',
      resolve: 'RESOLVED',
      false_alarm: 'FALSE_ALARM',
    };
    const nextStatus = nextStatusMap[action];

    const current = await this.prisma.alert.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: `Alert ${id} not found` });
    }

    // CRITICAL alerts cannot be auto-resolved; only supervisor can clear
    if (dto.action === 'resolve' && current.severity === 'CRITICAL' && user.role === 'VIEWER') {
      throw new ConflictException({ code: 'FORBIDDEN', message: 'CRITICAL alerts require Supervisor or Admin resolution' });
    }

    // Compare-and-swap update
    const updateResult = await this.prisma.$transaction(async (tx) => {
      const r = await tx.alert.updateMany({
        where: {
          id,
          version: dto.expectedVersion,
          status: { in: this.allowedFrom[action] as any },
        },
        data: {
          status: nextStatus,
          version: { increment: 1 },
          ackById: user.id,
          ackAt: new Date(),
          note: dto.note || current.note,
        },
      });

      if (r.count === 0) {
        throw new ConflictException({
          code: 'STALE_OR_INVALID_TRANSITION',
          message: `Alert version mismatch or invalid status transition. Expected version ${dto.expectedVersion}, current version is ${current.version}.`,
        });
      }

      const updated = await tx.alert.findUniqueOrThrow({ where: { id } });

      const ev = await tx.alertEvent.create({
        data: {
          alertId: id,
          kind: 'updated',
          payload: JSON.stringify(updated),
          createdAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: action,
          entity: 'alert',
          entityId: id,
          meta: JSON.stringify({ from: current.status, to: nextStatus, note: dto.note }),
          at: new Date(),
        },
      });

      return { alert: updated, seq: ev.seq };
    });

    // Emit event on WebSocket bus AFTER commit
    this.eventBus.emit('alert', {
      seq: updateResult.seq,
      type: 'alert.updated',
      data: updateResult.alert,
    });

    return {
      ...updateResult.alert,
      items: JSON.parse(updateResult.alert.items || '[]'),
    };
  }
}
