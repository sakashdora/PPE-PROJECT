import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../common/event-bus.service';
import { alertDto, alertInclude } from '../common/transport';
@Injectable()
export class OfflineDetectorService {
    constructor(private prisma: PrismaService, private bus: EventBusService) { }
    @Cron('*/5 * * * * *')
    async checkHealth() {
        const nodes = await this.prisma.edgeNode.findMany({ where: { status: 'online', OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 20000) } }] } });
        for (const node of nodes) {
            const result = await this.prisma.$transaction(async (tx) => {
                const update = await tx.edgeNode.updateMany({ where: { id: node.id, status: 'online' }, data: { status: 'offline' } });
                if (!update.count)
                    return null;
                const camera = await tx.camera.findFirst({ where: { edgeNodeId: node.id, enabled: true } });
                if (!camera)
                    return null;
                const saved = await tx.alert.create({ data: { id: 'sys-' + node.id + '-' + Date.now(), cameraId: camera.id, dedupKey: 'offline:' + node.id, severity: 'WARNING', type: 'system_offline', items: JSON.stringify(['edge_connection']), confidence: 1, firstSeenAt: new Date(), lastSeenAt: new Date(), note: 'Monitoring unavailable: edge heartbeat timed out.' }, include: alertInclude });
                const data = alertDto(saved);
                const event = await tx.alertEvent.create({ data: { alertId: saved.id, kind: 'created', payload: JSON.stringify(data) } });
                return { data, seq: event.seq };
            });
            if (result)
                this.bus.emit('alert', { seq: result.seq, type: 'alert.created', data: result.data });
            this.bus.emit('alert', { seq: 0, type: 'edge.health', data: { id: node.id, status: 'offline' } });
        }
        const cameras = await this.prisma.camera.findMany({ where: { enabled: true, status: 'online', OR: [{ lastFrameAt: null }, { lastFrameAt: { lt: new Date(Date.now() - 15000) } }] } });
        for (const camera of cameras) {
            await this.prisma.camera.update({ where: { id: camera.id }, data: { status: 'stalled' } });
            this.bus.emit('alert', { seq: 0, type: 'camera.status', data: { cameraId: camera.id, status: 'stalled' } });
        }
    }
}
