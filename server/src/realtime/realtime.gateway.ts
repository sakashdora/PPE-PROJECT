import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService, AlertBroadcastEvent } from '../common/event-bus.service';

@WebSocketGateway({ path: '/ws' })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private clients: Set<WebSocket> = new Set();
  private pingInterval: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  afterInit() {
    this.logger.log('[*] Native WebSocket Gateway initialized at path: /ws');

    // Subscribe to in-process event bus for live alerts and telemetry
    this.eventBus.on('alert', (event: AlertBroadcastEvent) => {
      this.broadcast(event);
    });

    // 5-second keepalive ping (frontend watchdog is 15s)
    this.pingInterval = setInterval(() => {
      this.broadcast({
        seq: 0,
        type: 'ping',
        data: { ts: new Date().toISOString() },
      });
    }, 5000);
  }

  async handleConnection(client: WebSocket, req: IncomingMessage) {
    this.clients.add(client);
    this.logger.log(`[WS] Client connected. Total active: ${this.clients.size}`);

    // Parse ?since=<seq> from connection URL
    const url = new URL(req.url || '', 'http://localhost');
    const sinceParam = url.searchParams.get('since');
    const since = sinceParam ? parseInt(sinceParam, 10) : undefined;

    try {
      if (since !== undefined && !isNaN(since)) {
        // Gapless sequential replay from `since` sequence ID
        const missedEvents = await this.prisma.alertEvent.findMany({
          where: { seq: { gt: since } },
          orderBy: { seq: 'asc' },
          take: 1000,
        });

        if (missedEvents.length >= 1000) {
          // Client is too far behind -> Request resync
          this.sendToClient(client, {
            seq: 0,
            type: 'resync',
            data: { reason: 'TOO_MANY_MISSED_EVENTS' },
          });
        } else {
          for (const ev of missedEvents) {
            let payload = {};
            try {
              payload = JSON.parse(ev.payload);
            } catch {}
            this.sendToClient(client, {
              seq: ev.seq,
              type: ev.kind === 'created' ? 'alert.created' : 'alert.updated',
              data: payload,
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(`[WS] Replay error: ${err}`);
    }

    client.on('message', (msg: string) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'ping') {
          this.sendToClient(client, {
            seq: 0,
            type: 'ping',
            data: { pong: true, ts: new Date().toISOString() },
          });
        }
      } catch {}
    });
  }

  handleDisconnect(client: WebSocket) {
    this.clients.delete(client);
    this.logger.log(`[WS] Client disconnected. Remaining: ${this.clients.size}`);
  }

  private sendToClient(client: WebSocket, envelope: AlertBroadcastEvent) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(envelope));
    }
  }

  broadcast(envelope: AlertBroadcastEvent) {
    const payload = JSON.stringify(envelope);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}
