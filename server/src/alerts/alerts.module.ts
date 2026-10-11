import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AuthModule } from '../auth/auth.module';
import { EventBusService } from '../common/event-bus.service';

@Module({
  imports: [AuthModule],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
