import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ConfigService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async bumpConfigVersion() {
    return this.prisma.configState.upsert({
      where: { id: 1 },
      update: { version: { increment: 1 } },
      create: { id: 1, version: 2, params: '{}' },
    });
  }

  // Cameras
  async listCameras() {
    return this.prisma.camera.findMany({
      include: {
        sector: { select: { id: true, name: true } },
        zones: true,
      },
    });
  }

  async updateCamera(id: string, user: any, data: { name?: string; enabled?: boolean; streamUrl?: string }) {
    const cam = await this.prisma.camera.update({
      where: { id },
      data: {
        name: data.name,
        enabled: data.enabled,
        streamUrlEnc: data.streamUrl,
      },
    });
    await this.bumpConfigVersion();
    await this.audit.log({
      userId: user.id,
      action: 'update_camera',
      entity: 'camera',
      entityId: id,
      meta: data,
    });
    return cam;
  }

  // Zones
  async createZone(user: any, data: { cameraId: string; kind: string; polygon: number[][] }) {
    const zone = await this.prisma.zone.create({
      data: {
        cameraId: data.cameraId,
        kind: data.kind,
        polygon: JSON.stringify(data.polygon),
      },
    });
    await this.bumpConfigVersion();
    await this.audit.log({
      userId: user.id,
      action: 'create_zone',
      entity: 'zone',
      entityId: zone.id,
      meta: data,
    });
    return { ...zone, polygon: data.polygon };
  }

  async deleteZone(id: string, user: any) {
    await this.prisma.zone.delete({ where: { id } });
    await this.bumpConfigVersion();
    await this.audit.log({
      userId: user.id,
      action: 'delete_zone',
      entity: 'zone',
      entityId: id,
    });
    return { ok: true };
  }

  // Thresholds & Voter Params
  async updateThresholds(user: any, thresholds: Record<string, number>) {
    // Range and ceiling validations: fire threshold must not exceed 0.85
    if (thresholds.fire !== undefined && thresholds.fire > 0.85) {
      throw new BadRequestException({ code: 'INVALID_THRESHOLD', message: 'Fire detection threshold ceiling cannot exceed 0.85' });
    }

    const activeModel = await this.prisma.modelVersion.findFirst({ where: { active: true } });
    if (activeModel) {
      await this.prisma.modelVersion.update({
        where: { id: activeModel.id },
        data: { thresholds: JSON.stringify(thresholds) },
      });
    }

    await this.bumpConfigVersion();
    await this.audit.log({
      userId: user.id,
      action: 'update_thresholds',
      entity: 'config',
      meta: thresholds,
    });
    return { ok: true, thresholds };
  }

  async updateVoterParams(user: any, params: any) {
    const cfg = await this.prisma.configState.findFirst({ where: { id: 1 } });
    const current = cfg ? JSON.parse(cfg.params) : {};
    const updated = { ...current, ...params };

    await this.prisma.configState.upsert({
      where: { id: 1 },
      update: { params: JSON.stringify(updated), version: { increment: 1 } },
      create: { id: 1, version: 2, params: JSON.stringify(updated) },
    });

    await this.audit.log({
      userId: user.id,
      action: 'update_voter_params',
      entity: 'config',
      meta: params,
    });
    return { ok: true, params: updated };
  }

  // Model Versions
  async listModels() {
    return this.prisma.modelVersion.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async activateModel(id: string, user: any) {
    await this.prisma.modelVersion.updateMany({ data: { active: false } });
    const model = await this.prisma.modelVersion.update({
      where: { id },
      data: { active: true },
    });
    await this.bumpConfigVersion();
    await this.audit.log({
      userId: user.id,
      action: 'activate_model',
      entity: 'model',
      entityId: id,
    });
    return model;
  }
}
