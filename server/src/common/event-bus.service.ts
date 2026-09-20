import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface AlertBroadcastEvent {
  seq: number;
  type: 'alert.created' | 'alert.updated' | 'camera.status' | 'edge.health' | 'ping' | 'resync';
  data: any;
}

@Injectable()
export class EventBusService {
  private emitter = new EventEmitter();

  emit(channel: string, event: AlertBroadcastEvent) {
    this.emitter.emit(channel, event);
  }

  on(channel: string, listener: (event: AlertBroadcastEvent) => void) {
    this.emitter.on(channel, listener);
  }

  off(channel: string, listener: (event: AlertBroadcastEvent) => void) {
    this.emitter.off(channel, listener);
  }
}
