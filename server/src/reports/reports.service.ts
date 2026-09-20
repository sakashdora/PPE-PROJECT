import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async generateComplianceCsv(query: { from?: string; to?: string; status?: string }): Promise<string> {
    const where: any = {};
    if (query.from || query.to) {
      where.firstSeenAt = {};
      if (query.from) where.firstSeenAt.gte = new Date(query.from);
      if (query.to) where.firstSeenAt.lte = new Date(query.to);
    }
    if (query.status) {
      where.status = query.status;
    }

    const alerts = await this.prisma.alert.findMany({
      where,
      orderBy: { firstSeenAt: 'desc' },
      include: {
        camera: { select: { id: true, name: true, sector: { select: { name: true } } } },
      },
    });

    const headers = [
      'Alert ID',
      'Timestamp (UTC)',
      'Sector',
      'Camera ID',
      'Camera Name',
      'Severity',
      'Violation Type',
      'Missing Items',
      'Confidence (%)',
      'Hit Count',
      'Status',
      'Acknowledged By',
      'Acknowledged At',
      'Supervisor Note',
    ];

    const rows = alerts.map((a) => {
      let itemsList = '';
      try {
        itemsList = JSON.parse(a.items || '[]').join('; ');
      } catch {}

      return [
        a.id,
        a.firstSeenAt.toISOString(),
        `"${a.camera?.sector?.name || ''}"`,
        a.cameraId,
        `"${a.camera?.name || ''}"`,
        a.severity,
        a.type,
        `"${itemsList}"`,
        (a.confidence * 100).toFixed(1),
        a.hitCount,
        a.status,
        a.ackById || 'N/A',
        a.ackAt ? a.ackAt.toISOString() : 'N/A',
        `"${(a.note || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  async getAggregates() {
    const totalAlerts = await this.prisma.alert.count();
    const openCritical = await this.prisma.alert.count({ where: { severity: 'CRITICAL', status: 'OPEN' } });
    const openWarning = await this.prisma.alert.count({ where: { severity: 'WARNING', status: 'OPEN' } });
    const openCompliance = await this.prisma.alert.count({ where: { severity: 'COMPLIANCE', status: 'OPEN' } });

    return {
      totalAlerts,
      openIncidents: {
        critical: openCritical,
        warning: openWarning,
        compliance: openCompliance,
      },
    };
  }
}
