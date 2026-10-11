import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { OfflineDetectorService } from './offline-detector.service';
import { EventBusService } from '../common/event-bus.service';

@Module({
  controllers: [HealthController],
  providers: [OfflineDetectorService],
  exports: [OfflineDetectorService],
})
export class HealthModule {}
