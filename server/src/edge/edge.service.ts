import { BadRequestException, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../common/event-bus.service';
import { alertDto, alertInclude, parseJson } from '../common/transport';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
export interface AlertIngestDto {
    id: string;
    cameraId?: string;
    camera_id?: string;
    severity: string;
    type: string;
    items?: string[];
    confidence: number;
    [key: string]: any;
}
export interface HeartbeatDto {
    cameras?: any[];
    [key: string]: any;
}
@Injectable()
export class EdgeService {
    constructor(private prisma: PrismaService, private eventBus: EventBusService) { }
    async saveSnapshot(_id: string, buffer?: Buffer) {
        if (!buffer?.length)
            return null;
        if (buffer.length > 8 * 1024 * 1024 || buffer[0] !== 0xff || buffer[1] !== 0xd8)
            throw new BadRequestException('A JPEG snapshot of at most 8 MB is required');
        const root = path.resolve(process.env.SNAPSHOTS_DIR || 'snapshots');
        const directory = path.join(root, new Date().toISOString().slice(0, 10));
        await fs.promises.mkdir(directory, { recursive: true });
        const target = path.join(directory, randomUUID() + '.jpg');
        await fs.promises.writeFile(target, buffer);
        return target;
    }
    async ingestAlert(edgeNode: any, dto: AlertIngestDto, snapshotBuffer?: Buffer) {
        const cameraId = dto?.cameraId || dto?.camera_id;
        if (!dto || typeof dto.id !== 'string' || !/^[\w-]{1,128}$/.test(dto.id) || typeof cameraId !== 'string')
            throw new BadRequestException('Valid incident and camera IDs are required');
        if (!['CRITICAL', 'WARNING', 'COMPLIANCE'].includes(dto.severity) || !['fire', 'smoke', 'smoking', 'missing_ppe', 'ppe_missing'].includes(dto.type))
            throw new BadRequestException('Invalid incident severity or type');
        if (typeof dto.confidence !== 'number' || !Number.isFinite(dto.confidence) || dto.confidence < 0 || dto.confidence > 1 || !Array.isArray(dto.items) || dto.items.some(x => typeof x !== 'string' || x.length > 64))
            throw new BadRequestException('Invalid confidence or items');
        const ts = dto.ts ? new Date(dto.ts) : new Date();
        if (!Number.isFinite(ts.getTime()))
            throw new BadRequestException('Invalid incident timestamp');
        const camera = await this.prisma.camera.findFirst({ where: { id: cameraId, edgeNodeId: edgeNode.id, enabled: true } });
        if (!camera)
            throw new ForbiddenException('Camera does not belong to this edge node');
        const existing = await this.prisma.alertReceipt.findUnique({ where: { id: dto.id } });
        if (existing)
            return { ok: true, status: 'already_exists', alertId: existing.alertId };
        const legacy = await this.prisma.alert.findUnique({ where: { id: dto.id } });
        if (legacy)
            return { ok: true, status: 'already_exists', alertId: legacy.id };
        const snapshotPath = await this.saveSnapshot(dto.id, snapshotBuffer);
        const dedupKey = [dto.type, [...dto.items].sort().join(','), dto.zone_id || dto.zoneId || 'global'].join(':');
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                const receipt = await tx.alertReceipt.findUnique({ where: { id: dto.id } });
                if (receipt)
                    return { duplicate: true, alertId: receipt.alertId };
                const incident = await tx.alert.findFirst({ where: { cameraId, dedupKey, severity: dto.severity, status: 'OPEN', lastSeenAt: { gte: new Date(ts.getTime() - 60000), lte: ts } }, orderBy: { lastSeenAt: 'desc' } });
                const saved = incident
                    ? await tx.alert.update({ where: { id: incident.id }, data: { hitCount: { increment: 1 }, lastSeenAt: ts, version: { increment: 1 }, confidence: Math.max(incident.confidence, dto.confidence), ...(snapshotPath ? { snapshotPath } : {}) }, include: alertInclude })
                    : await tx.alert.create({ data: { id: dto.id, cameraId, dedupKey, severity: dto.severity, type: dto.type, items: JSON.stringify(dto.items), confidence: dto.confidence, votes: dto.votes, firstSeenAt: ts, lastSeenAt: ts, snapshotPath, modelVersion: dto.model_version || dto.modelVersion, zoneId: dto.zone_id || dto.zoneId, bbox: dto.bbox ? JSON.stringify(dto.bbox) : null }, include: alertInclude });
                await tx.alertReceipt.create({ data: { id: dto.id, alertId: saved.id } });
                const data = alertDto(saved);
                const type = incident ? 'alert.updated' : 'alert.created';
                const event = await tx.alertEvent.create({ data: { alertId: saved.id, kind: incident ? 'updated' : 'created', payload: JSON.stringify(data) } });
                return { duplicate: false, alertId: saved.id, seq: event.seq, type, data };
            });
            if (!result.duplicate)
                this.eventBus.emit('alert', { seq: result.seq, type: result.type as any, data: result.data });
            return { ok: true, status: result.duplicate ? 'already_exists' : 'accepted', alertId: result.alertId, seq: result.seq };
        }
        catch (error) {
            const receipt = await this.prisma.alertReceipt.findUnique({ where: { id: dto.id } });
            if (receipt)
                return { ok: true, status: 'already_exists', alertId: receipt.alertId };
            throw error;
        }
    }
    async processHeartbeat(edgeNode: any, dto: HeartbeatDto) {
        const now = new Date();
        const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
        const node = await this.prisma.edgeNode.update({ where: { id: edgeNode.id }, data: { lastSeenAt: now, status: 'online', fps: numeric(dto.fps), latencyMs: numeric(dto.latencyMs), ...(Number.isInteger(dto.appliedConfigVersion) ? { appliedConfigVersion: dto.appliedConfigVersion } : {}), detectorMode: ['onnx', 'mock', 'unavailable'].includes(dto.detectorMode) ? dto.detectorMode : 'unknown' } });
        await this.prisma.edgeNode.update({ where: { id: edgeNode.id }, data: { alarmAdapter: dto.alarmAdapter === 'gpio' ? 'gpio' : 'unconfigured', activeAlarmCount: Array.isArray(dto.activeAlertIds) ? dto.activeAlertIds.length : 0 } });
        for (const camera of dto.cameras || []) {
            const lastFrameAt = camera.lastFrameAt ? new Date(camera.lastFrameAt) : typeof camera.frameAgeMs === 'number' && camera.frameAgeMs >= 0 ? new Date(now.getTime() - camera.frameAgeMs) : null;
            if (lastFrameAt && !Number.isFinite(lastFrameAt.getTime()))
                throw new BadRequestException('Invalid frame timestamp');
            const recent = lastFrameAt && now.getTime() - lastFrameAt.getTime() <= 15000;
            const updated = await this.prisma.camera.updateMany({ where: { id: camera.id || camera.camera_id, edgeNodeId: edgeNode.id }, data: { status: recent && camera.status === 'online' ? 'online' : 'stalled', ...(lastFrameAt ? { lastFrameAt } : {}), fps: numeric(camera.fps), latencyMs: numeric(camera.latencyMs) } });
            if (!updated.count)
                throw new ForbiddenException('Heartbeat camera does not belong to this node');
        }
        const cleared = await this.prisma.alert.findMany({ where: { status: { in: ['ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'] }, camera: { edgeNodeId: edgeNode.id } }, select: { id: true, receipts: { select: { id: true } } } });
        const requested = Array.isArray(dto.activeAlertIds) ? new Set(dto.activeAlertIds) : null;
        const clearAlarms = [...new Set(cleared.flatMap(x => [x.id, ...x.receipts.map(r => r.id)]))].filter(id => !requested || requested.has(id));
        const cfg = await this.prisma.configState.findUnique({ where: { id: 1 } });
        this.eventBus.emit('alert', { seq: 0, type: 'edge.health', data: { id: node.id, lastSeenAt: node.lastSeenAt, status: node.status } });
        return { ok: true, configVersion: cfg?.version || 1, clearAlarms };
    }
    async getConfig(edgeNode: any) {
        const cameras = await this.prisma.camera.findMany({ where: { edgeNodeId: edgeNode.id, enabled: true }, include: { zones: true, sector: true } });
        const model = await this.prisma.modelVersion.findFirst({ where: { active: true } });
        const state = await this.prisma.configState.findUnique({ where: { id: 1 } });
        const params = parseJson<Record<string, any>>(state?.params, {});
        const defaults = { fire_window: 5, fire_threshold: 2, smoke_window: 5, smoke_threshold: 2, smoking_window: 8, smoking_threshold: 4, ppe_window: 10, ppe_threshold: 8 };
        const voter = Object.fromEntries(Object.keys(defaults).map(key => [key, params[key] ?? defaults[key]]));
        return { configVersion: state?.version || 1, node_id: edgeNode.id, cooldown_seconds: params.cooldown_seconds ?? 60, voter, thresholds: parseJson(model?.thresholds, {}), activeModel: model?.name || null,
            cameras: cameras.map(c => ({ id: c.id, name: c.name, sector: c.sector.name, source: c.streamUrlEnc, fps_target: 10, zones: c.zones.map(z => ({ id: z.id, name: z.name, type: z.kind === 'SMOKING_RESTRICTED' ? 'smoking_restricted' : z.kind === 'IGNORE' ? 'exclusion' : 'mandatory_ppe', polygon: parseJson(z.polygon, []), required_ppe: parseJson(z.requiredPpe, ['helmet', 'vest']), severity: 'COMPLIANCE' })) })) };
    }
}
