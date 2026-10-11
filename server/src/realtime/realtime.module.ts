import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { EventBusService } from '../common/event-bus.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
