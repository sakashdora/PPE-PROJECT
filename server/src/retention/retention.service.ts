import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeOldData() {
    this.logger.log('[*] Running scheduled data retention cleanup...');

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const deletedEvents = await this.prisma.alertEvent.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });
    this.logger.log(`[RETENTION] Purged ${deletedEvents.count} AlertEvent records older than 90 days.`);
  }
}
