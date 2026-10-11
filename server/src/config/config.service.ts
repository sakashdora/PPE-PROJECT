import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { cameraDto, cameraInclude, parseJson } from '../common/transport';
const classes = ['person', 'helmet', 'head', 'vest', 'gloves', 'boots', 'no_gloves', 'no_boots', 'fire', 'smoke', 'cigarette'];
@Injectable()
export class ConfigService {
    constructor(private prisma: PrismaService, private audit: AuditService) { }
    async bumpConfigVersion(tx: any = this.prisma) { return tx.configState.upsert({ where: { id: 1 }, update: { version: { increment: 1 } }, create: { id: 1, version: 2, params: '{}' } }); }
    async listCameras(admin = false) { return (await this.prisma.camera.findMany({ include: cameraInclude, orderBy: { id: 'asc' } })).map(c => cameraDto(c, admin)); }
    async change(user: any, action: string, entityId: string | null, work: (tx: any) => Promise<any>) {
        return this.prisma.$transaction(async (tx) => { const result = await work(tx); await this.bumpConfigVersion(tx); await tx.auditLog.create({ data: { userId: user.id, action, entity: 'config', entityId, meta: '{}' } }); return result; });
    }
    source(value: unknown) { if (typeof value !== 'string' || !value.trim() || value.length > 2000)
        throw new BadRequestException('Camera source is required'); return value.trim(); }
    name(value: unknown) { if (typeof value !== 'string' || !value.trim() || value.length > 120)
        throw new BadRequestException('Name must contain 1–120 characters'); return value.trim(); }
    async createCamera(user: any, data: any) {
        const name = this.name(data.name);
        const source = this.source(data.source || data.streamUrl);
        if (!await this.prisma.sector.findUnique({ where: { id: data.sectorId } }) || !await this.prisma.edgeNode.findUnique({ where: { id: data.edgeNodeId } }))
            throw new BadRequestException('Select an existing sector and edge node');
        return this.change(user, 'create_camera', null, async (tx) => cameraDto(await tx.camera.create({ data: { name, streamUrlEnc: source, sectorId: data.sectorId, edgeNodeId: data.edgeNodeId, status: 'unknown' }, include: cameraInclude }), true));
    }
    async updateCamera(id: string, user: any, data: any) {
        if (data.enabled !== undefined && typeof data.enabled !== 'boolean')
            throw new BadRequestException('Enabled must be boolean');
        return this.change(user, 'update_camera', id, async (tx) => cameraDto(await tx.camera.update({ where: { id }, data: { ...(data.name !== undefined ? { name: this.name(data.name) } : {}), ...(data.enabled !== undefined ? { enabled: data.enabled } : {}), ...(data.source !== undefined || data.streamUrl !== undefined ? { streamUrlEnc: this.source(data.source ?? data.streamUrl) } : {}) }, include: cameraInclude }), true));
    }
    zone(data: any) {
        if (!['PPE_REQUIRED', 'SMOKING_RESTRICTED', 'IGNORE'].includes(data.kind))
            throw new BadRequestException('Invalid zone kind');
        if (!Array.isArray(data.polygon) || data.polygon.length < 3 || data.polygon.length > 32 || data.polygon.some((p: any) => !Array.isArray(p) || p.length !== 2 || p.some((v: any) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)))
            throw new BadRequestException('Draw a polygon of 3–32 normalized points');
        const ppe = data.requiredPpe ?? ['helmet', 'vest'];
        if (!Array.isArray(ppe) || ppe.some((v: any) => !['helmet', 'vest', 'gloves', 'boots'].includes(v)))
            throw new BadRequestException('Invalid required PPE');
        return { kind: data.kind, name: this.name(data.name || 'Detection zone'), polygon: JSON.stringify(data.polygon), requiredPpe: JSON.stringify(ppe) };
    }
    async createZone(user: any, data: any) { const validated = this.zone(data); return this.change(user, 'create_zone', data.cameraId, tx => tx.zone.create({ data: { cameraId: data.cameraId, ...validated } })); }
    async updateZone(id: string, user: any, data: any) { const validated = this.zone(data); return this.change(user, 'update_zone', id, tx => tx.zone.update({ where: { id }, data: validated })); }
    async deleteZone(id: string, user: any) { return this.change(user, 'delete_zone', id, async (tx) => { await tx.zone.delete({ where: { id } }); return { ok: true }; }); }
    async state() {
        const config = await this.prisma.configState.findUnique({ where: { id: 1 } });
        const model = await this.prisma.modelVersion.findFirst({ where: { active: true } });
        return { version: config?.version || 1, params: parseJson(config?.params, {}), thresholds: parseJson(model?.thresholds, {}), activeModel: model?.name || null };
    }
    async updateThresholds(user: any, thresholds: Record<string, number>) {
        if (!thresholds || Object.entries(thresholds).some(([k, v]) => !classes.includes(k) || typeof v !== 'number' || !Number.isFinite(v) || v < 0.05 || v > 0.99) || thresholds.fire > 0.85 || thresholds.smoke > 0.85)
            throw new BadRequestException('Thresholds must be 0.05–0.99; fire/smoke may not exceed 0.85');
        return this.change(user, 'update_thresholds', null, async (tx) => { const model = await tx.modelVersion.findFirst({ where: { active: true } }); if (!model)
            throw new BadRequestException('Activate a model first'); const merged = { ...parseJson(model.thresholds, {}), ...thresholds }; await tx.modelVersion.update({ where: { id: model.id }, data: { thresholds: JSON.stringify(merged) } }); return { ok: true, thresholds: merged }; });
    }
    async updateVoterParams(user: any, params: any) {
        const allowed = ['fire_window', 'fire_threshold', 'smoke_window', 'smoke_threshold', 'smoking_window', 'smoking_threshold', 'ppe_window', 'ppe_threshold', 'cooldown_seconds'];
        if (!params || Object.entries(params).some(([k, v]) => !allowed.includes(k) || !Number.isInteger(v) || Number(v) < 1 || Number(v) > (k === 'cooldown_seconds' ? 3600 : 60)))
            throw new BadRequestException('Invalid voting or cooldown settings');
        return this.change(user, 'update_voter_params', null, async (tx) => { const cfg = await tx.configState.findUnique({ where: { id: 1 } }); const merged = { ...parseJson(cfg?.params, {}), ...params }; for (const prefix of ['fire', 'smoke', 'smoking', 'ppe'])
            if (merged[prefix + '_threshold'] > merged[prefix + '_window'])
                throw new BadRequestException('Required votes cannot exceed the window'); await tx.configState.upsert({ where: { id: 1 }, update: { params: JSON.stringify(merged) }, create: { id: 1, version: 1, params: JSON.stringify(merged) } }); return { ok: true, params: merged }; });
    }
    async saveDetection(user: any, body: any) {
        const thresholds = body?.thresholds;
        const params = body?.params;
        const allowed = ['fire_window', 'fire_threshold', 'smoke_window', 'smoke_threshold', 'smoking_window', 'smoking_threshold', 'ppe_window', 'ppe_threshold', 'cooldown_seconds'];
        if (!thresholds || Object.entries(thresholds).some(([key, value]) => !classes.includes(key) || typeof value !== 'number' || !Number.isFinite(value) || value < .05 || value > .99) || thresholds.fire > .85 || thresholds.smoke > .85)
            throw new BadRequestException('Invalid confidence thresholds');
        if (!params || Object.entries(params).some(([key, value]) => !allowed.includes(key) || !Number.isInteger(value) || Number(value) < 1 || Number(value) > (key === 'cooldown_seconds' ? 3600 : 60)))
            throw new BadRequestException('Invalid voting settings');
        return this.change(user, 'save_detection_settings', null, async (tx) => {
            const state = await tx.configState.findUnique({ where: { id: 1 } });
            const merged = { ...parseJson(state?.params, {}), ...params };
            for (const prefix of ['fire', 'smoke', 'smoking', 'ppe'])
                if (merged[prefix + '_threshold'] > merged[prefix + '_window'])
                    throw new BadRequestException('Required votes cannot exceed the window');
            const model = await tx.modelVersion.findFirst({ where: { active: true } });
            if (!model)
                throw new BadRequestException('Activate a model first');
            await tx.modelVersion.update({ where: { id: model.id }, data: { thresholds: JSON.stringify({ ...parseJson(model.thresholds, {}), ...thresholds }) } });
            await tx.configState.upsert({ where: { id: 1 }, update: { params: JSON.stringify(merged) }, create: { id: 1, version: 1, params: JSON.stringify(merged) } });
            return { ok: true };
        });
    }
    async listModels() { return (await this.prisma.modelVersion.findMany({ orderBy: { createdAt: 'desc' } })).map(m => ({ ...m, metrics: parseJson(m.metrics, {}), thresholds: parseJson(m.thresholds, {}) })); }
    async activateModel(id: string, user: any) { return this.change(user, 'activate_model', id, async (tx) => { if (!await tx.modelVersion.findUnique({ where: { id } }))
        throw new NotFoundException('Model not found'); await tx.modelVersion.updateMany({ data: { active: false } }); return tx.modelVersion.update({ where: { id }, data: { active: true } }); }); }
}
