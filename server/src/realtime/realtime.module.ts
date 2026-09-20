import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { EventBusService } from '../common/event-bus.service';

@Module({
  providers: [RealtimeGateway, EventBusService],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
