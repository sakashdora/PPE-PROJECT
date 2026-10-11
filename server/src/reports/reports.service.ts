import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { alertDto, alertInclude, cameraDto, cameraInclude, parseJson } from '../common/transport';
@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService) { }
    filter(query: any) {
        const where: any = {};
        if (query?.status)
            where.status = query.status.toUpperCase();
        if (query?.from || query?.to) {
            where.firstSeenAt = {};
            for (const [key, value] of [['gte', query.from], ['lte', query.to]])
                if (value) {
                    const date = new Date(value);
                    if (!Number.isFinite(date.getTime()))
                        throw new BadRequestException('Invalid report date');
                    where.firstSeenAt[key] = date;
                }
        }
        return where;
    }
    async overview() {
        return this.prisma.$transaction(async (tx) => {
            const latest = await tx.alertEvent.findFirst({ orderBy: { seq: 'desc' } });
            const groups = await tx.alert.groupBy({ by: ['status', 'severity'], _count: { _all: true } });
            const totals = { open: 0, acknowledged: 0, critical: 0, compliance: 0 };
            for (const group of groups) {
                if (group.status === 'OPEN') {
                    totals.open += group._count._all;
                    if (group.severity === 'CRITICAL')
                        totals.critical += group._count._all;
                    if (group.severity === 'COMPLIANCE')
                        totals.compliance += group._count._all;
                }
                if (group.status === 'ACKNOWLEDGED')
                    totals.acknowledged += group._count._all;
            }
            const alerts = await tx.alert.findMany({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, orderBy: { firstSeenAt: 'desc' }, include: alertInclude, take: 1000 });
            const recent = await tx.alert.findMany({ orderBy: { firstSeenAt: 'desc' }, include: alertInclude, take: 20 });
            const cameras = await tx.camera.findMany({ include: cameraInclude, orderBy: { id: 'asc' } });
            const nodes = await tx.edgeNode.findMany({ select: { id: true, name: true, status: true, lastSeenAt: true, fps: true, latencyMs: true, detectorMode: true, appliedConfigVersion: true, alarmAdapter: true, activeAlarmCount: true } });
            const models = await tx.modelVersion.findMany({ orderBy: { createdAt: 'desc' } });
            const config = await tx.configState.findUnique({ where: { id: 1 } });
            const sectors = await tx.sector.findMany({ select: { id: true, name: true } });
            return { cursor: latest?.seq || 0, serverTime: new Date().toISOString(), totals, truncatedActive: totals.open + totals.acknowledged > 1000, alerts: alerts.map(alertDto), recent: recent.map(alertDto), cameras: cameras.map(c => cameraDto(c)), nodes: nodes.map(n => ({ ...n, status: !n.lastSeenAt ? 'unknown' : Date.now() - n.lastSeenAt.getTime() > 20000 ? 'offline' : n.status })), models: models.map(m => ({ ...m, thresholds: parseJson(m.thresholds, {}), metrics: parseJson(m.metrics, {}) })), config: { version: config?.version || 1, params: parseJson(config?.params, {}) }, sectors };
        });
    }
    async generateComplianceCsv(query: any): Promise<string> {
        const rows = await this.prisma.alert.findMany({ where: this.filter(query), orderBy: { firstSeenAt: 'desc' }, include: alertInclude, take: 50000 });
        const encode = (value: any) => { let text = String(value ?? ''); if (/^[=+@-]/.test(text))
            text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
        const header = ['Alert ID', 'Timestamp (UTC)', 'Sector', 'Camera ID', 'Camera Name', 'Severity', 'Type', 'Items', 'Confidence (%)', 'Hits', 'Status', 'Acknowledged by', 'Acknowledged at', 'Note'];
        return [header, ...rows.map(a => [a.id, a.firstSeenAt.toISOString(), a.camera.sector.name, a.cameraId, a.camera.name, a.severity, a.type, parseJson<string[]>(a.items, []).join('; '), (a.confidence * 100).toFixed(1), a.hitCount, a.status, a.ackById, a.ackAt?.toISOString(), a.note])].map(row => row.map(encode).join(',')).join('\r\n');
    }
    async getAggregates(query: any = {}) {
        const where = this.filter(query);
        const groups = await this.prisma.alert.groupBy({ by: ['status', 'severity'], where, _count: { _all: true } });
        const rows = await this.prisma.alert.findMany({ where, orderBy: { firstSeenAt: 'desc' }, include: alertInclude, take: 10000 });
        const totals = { total: 0, open: 0, acknowledged: 0, resolved: 0, false_alarm: 0 };
        const severity = { CRITICAL: 0, WARNING: 0, COMPLIANCE: 0 };
        for (const g of groups) {
            totals.total += g._count._all;
            totals[g.status.toLowerCase()] += g._count._all;
            severity[g.severity] += g._count._all;
        }
        const days: Record<string, any> = {};
        const sectors: Record<string, number> = {};
        for (const a of rows) {
            const date = a.firstSeenAt.toISOString().slice(0, 10);
            days[date] ??= { date, CRITICAL: 0, WARNING: 0, COMPLIANCE: 0 };
            days[date][a.severity]++;
            const name = a.camera.sector.name;
            sectors[name] = (sectors[name] || 0) + 1;
        }
        return { ...totals, severity, daily: Object.values(days).sort((a: any, b: any) => a.date.localeCompare(b.date)), sectors: Object.entries(sectors).map(([name, count]) => ({ name, count })), analyzedCount: rows.length, hasMore: totals.total > rows.length };
    }
}
