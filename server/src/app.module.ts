import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { EdgeModule } from './edge/edge.module';
import { AlertsModule } from './alerts/alerts.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ConfigModule } from './config/config.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';
import { RetentionModule } from './retention/retention.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    EdgeModule,
    AlertsModule,
    RealtimeModule,
    ConfigModule,
    ReportsModule,
    HealthModule,
    RetentionModule,
  ],
})
export class AppModule {}
