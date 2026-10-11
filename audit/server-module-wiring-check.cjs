// Resolves real Nest modules using an isolated SQLite fixture left by review checks.
// No HTTP server is opened and no application DB is connected.
const fs = require('fs');
const path = require('path');
const server = path.resolve(__dirname, '../server');
const scratch = path.join(__dirname, '.server-review-scratch');
const fixture = fs.readdirSync(scratch).filter(x => /^checks-\d+\.db$/.test(x)).sort().at(-1);
if (!fixture) throw new Error('Run server-review-checks.cjs first to create an isolated fixture');
process.env.DATABASE_URL = 'file:' + path.join(scratch, fixture).replace(/\\/g, '/');
require(path.join(server, 'node_modules/ts-node')).register({ project: path.join(server, 'tsconfig.json'), transpileOnly: true });
const { NestFactory } = require(path.join(server, 'node_modules/@nestjs/core'));
const { AppModule } = require(path.join(server, 'src/app.module.ts'));
const { EventBusService } = require(path.join(server, 'src/common/event-bus.service.ts'));
const modules = ['edge/edge.module.ts', 'alerts/alerts.module.ts', 'health/health.module.ts', 'realtime/realtime.module.ts'];
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const buses = modules.map(file => {
      const exports = require(path.join(server, 'src', file));
      return app.select(Object.values(exports)[0]).get(EventBusService, { strict: true });
    });
    let realtimeReceived = 0;
    buses[3].on('alert', () => realtimeReceived++);
    buses[0].emit('alert', { seq: 1, type: 'alert.created', data: { id: 'isolated-module-check' } });
    const result = { distinctEventBusInstances: new Set(buses).size, modules, realtimeReceivedFromEdge: realtimeReceived };
    fs.writeFileSync(path.join(__dirname, 'server-module-wiring-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await app.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
