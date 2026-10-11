import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../common/event-bus.service';
import { AuditService } from '../audit/audit.service';
import { alertDto, alertInclude } from '../common/transport';
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
    constructor(private prisma: PrismaService, private eventBus: EventBusService, private audit: AuditService) { }
    async listAlerts(query: any) {
        const limit = query.limit ?? 50;
        if (!Number.isInteger(limit) || limit < 1 || limit > 100)
            throw new BadRequestException('Limit must be between 1 and 100');
        const where: any = {};
        if (query.status)
            where.status = query.status.toLowerCase() === 'active' ? { in: ['OPEN', 'ACKNOWLEDGED'] } : query.status.toUpperCase();
        if (query.severity)
            where.severity = query.severity.toUpperCase();
        if (query.cameraId || query.camera_id)
            where.cameraId = query.cameraId || query.camera_id;
        if (query.from || query.to) {
            where.firstSeenAt = {};
            for (const [key, value] of [['gte', query.from], ['lte', query.to]])
                if (value) {
                    const date = new Date(value);
                    if (!Number.isFinite(date.getTime()))
                        throw new BadRequestException('Invalid date filter');
                    where.firstSeenAt[key] = date;
                }
        }
        const rows = await this.prisma.alert.findMany({ where, take: limit + 1, orderBy: [{ firstSeenAt: 'desc' }, { id: 'desc' }], ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}), include: alertInclude });
        return { items: rows.slice(0, limit).map(alertDto), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
    }
    async getAlertById(id: string) {
        const alert = await this.prisma.alert.findUnique({ where: { id }, include: alertInclude });
        if (!alert)
            throw new NotFoundException('Incident not found');
        return alertDto(alert);
    }
    async getSnapshotPath(id: string) {
        const alert = await this.prisma.alert.findUnique({ where: { id } });
        if (!alert?.snapshotPath)
            throw new NotFoundException('No evidence snapshot for this incident');
        const root = path.resolve(process.env.SNAPSHOTS_DIR || 'snapshots');
        const target = path.resolve(alert.snapshotPath);
        if (!target.startsWith(root + path.sep) || !fs.existsSync(target))
            throw new NotFoundException('Snapshot is unavailable');
        return target;
    }
    async transition(id: string, user: any, dto: TransitionDto) {
        if (!Number.isInteger(dto?.expectedVersion) || dto.expectedVersion < 1)
            throw new BadRequestException('A positive integer expectedVersion is required');
        if (dto.note !== undefined && (typeof dto.note !== 'string' || dto.note.length > 2000))
            throw new BadRequestException('Notes must be at most 2000 characters');
        const action = dto.action || ({ ACKNOWLEDGED: 'ack', RESOLVED: 'resolve', FALSE_ALARM: 'false_alarm' }[String(dto.status).toUpperCase()]);
        if (!['ack', 'resolve', 'false_alarm'].includes(action))
            throw new BadRequestException('Invalid incident action');
        const from = action === 'ack' ? 'OPEN' : 'ACKNOWLEDGED';
        const next = { ack: 'ACKNOWLEDGED', resolve: 'RESOLVED', false_alarm: 'FALSE_ALARM' }[action];
        const result = await this.prisma.$transaction(async (tx) => {
            const current = await tx.alert.findUnique({ where: { id } });
            if (!current)
                throw new NotFoundException('Incident not found');
            const update = await tx.alert.updateMany({ where: { id, version: dto.expectedVersion, status: from }, data: { status: next, version: { increment: 1 }, note: dto.note ?? current.note, ...(action === 'ack' ? { ackById: user.name || user.id, ackAt: new Date() } : { resolvedById: user.id, resolvedAt: new Date() }) } });
            if (!update.count)
                throw new ConflictException('This incident changed or requires acknowledgment first. Refresh and try again.');
            const saved = await tx.alert.findUniqueOrThrow({ where: { id }, include: alertInclude });
            const data = alertDto(saved);
            const event = await tx.alertEvent.create({ data: { alertId: id, kind: 'updated', payload: JSON.stringify(data) } });
            await tx.auditLog.create({ data: { userId: user.id, action, entity: 'alert', entityId: id, meta: JSON.stringify({ from: current.status, to: next, note: dto.note }) } });
            return { data, seq: event.seq };
        });
        this.eventBus.emit('alert', { seq: result.seq, type: 'alert.updated', data: result.data });
        return result.data;
    }
}
