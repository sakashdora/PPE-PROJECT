import { Module } from '@nestjs/common';
import { EdgeController } from './edge.controller';
import { EdgeService } from './edge.service';
import { EdgeAuthGuard } from './edge-auth.guard';
import { EventBusService } from '../common/event-bus.service';

@Module({
  controllers: [EdgeController],
  providers: [EdgeService, EdgeAuthGuard, EventBusService],
  exports: [EdgeService, EventBusService],
})
export class EdgeModule {}
