import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService, AlertBroadcastEvent } from '../common/event-bus.service';
import { parseJson, alertDto, alertInclude } from '../common/transport';
@WebSocketGateway({ path: '/ws' })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
    @WebSocketServer()
    server: Server;
    private clients = new Map<WebSocket, {
        replaying: boolean;
        queued: AlertBroadcastEvent[];
        cursor: number;
    }>();
    private pingInterval: NodeJS.Timeout;
    private listener = (event: AlertBroadcastEvent) => this.broadcast(event);
    constructor(private prisma: PrismaService, private eventBus: EventBusService, private jwt: JwtService) { }
    afterInit() { this.eventBus.on('alert', this.listener); this.pingInterval = setInterval(() => this.broadcast({ seq: 0, type: 'ping', data: { ts: new Date().toISOString() } }), 5000); }
    onModuleDestroy() { clearInterval(this.pingInterval); this.eventBus.off('alert', this.listener); for (const client of this.clients.keys())
        client.close(1001); }
    async handleConnection(client: WebSocket, req: IncomingMessage) {
        const state = { replaying: true, queued: [] as AlertBroadcastEvent[], cursor: 0 };
        try {
            const origin = req.headers.origin;
            const allowed = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
            const isLocalOrLan = !origin || allowed.includes(origin) || origin === 'http://127.0.0.1:3000' || /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):3000$/.test(origin);
            if (!isLocalOrLan)
                throw Error('Origin rejected');
            const cookie = req.headers.cookie?.split(';').find(c => c.trim().startsWith('token='))?.trim().slice(6);
            const url = new URL(req.url || '/ws', 'http://localhost');
            const token = cookie || url.searchParams.get('token');
            if (!token)
                throw Error('Session required');
            const user = await this.jwt.verifyAsync(token);
            if (!await this.prisma.user.findUnique({ where: { id: user.id } }))
                throw Error('Session invalid');
            const cursor = Number(url.searchParams.get('since') || 0);
            if (!Number.isSafeInteger(cursor) || cursor < 0)
                throw Error('Invalid cursor');
            state.cursor = cursor;
            this.clients.set(client, state);
            const events = await this.prisma.alertEvent.findMany({ where: { seq: { gt: cursor } }, orderBy: { seq: 'asc' }, take: 1001 });
            if (events.length > 1000)
                this.send(client, { seq: 0, type: 'resync', data: { reason: 'SNAPSHOT_REQUIRED' } });
            else
                for (const event of events) {
                    let data = parseJson<any>(event.payload, {});
                    if (!data.ts || typeof data.items === 'string') {
                        const row = await this.prisma.alert.findUnique({ where: { id: event.alertId }, include: alertInclude });
                        if (!row)
                            continue;
                        data = alertDto(row);
                    }
                    this.send(client, { seq: event.seq, type: event.kind === 'created' ? 'alert.created' : 'alert.updated', data });
                }
            state.replaying = false;
            for (const event of state.queued.sort((a, b) => a.seq - b.seq))
                this.send(client, event);
            state.queued = [];
        }
        catch {
            this.clients.delete(client);
            client.close(1008, 'Authentication or replay failed');
        }
    }
    handleDisconnect(client: WebSocket) { this.clients.delete(client); }
    private send(client: WebSocket, event: AlertBroadcastEvent) {
        const state = this.clients.get(client);
        if (!state || client.readyState !== WebSocket.OPEN)
            return;
        if (event.seq > 0 && event.seq <= state.cursor)
            return;
        if (event.seq > 0)
            state.cursor = event.seq;
        client.send(JSON.stringify(event));
    }
    broadcast(event: AlertBroadcastEvent) { for (const [client, state] of this.clients) {
        if (state.replaying)
            state.queued.push(event);
        else
            this.send(client, event);
    } }
}
