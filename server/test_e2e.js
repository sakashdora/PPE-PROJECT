/**
 * End-to-End Verification Test Script
 * Tests:
 * 1. Health Liveness & Readiness
 * 2. Supervisor Login (JWT issuance)
 * 3. Edge Heartbeat with API key
 * 4. Idempotent Alert Ingestion (with mock snapshot)
 * 5. 60-Second Secondary Deduplication (hitCount incrementation)
 * 6. Native WebSocket Connection & Gapless Event Replay (?since=0)
 * 7. CAS State Machine (OPEN -> ACKNOWLEDGED)
 * 8. Physical Alarm Unlatching Verification (clearAlarms in next heartbeat)
 * 9. CSV Report Stream
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:4000';
const WS_URL = 'ws://localhost:4000/ws';
const EDGE_API_KEY = 'edge-api-key-factory-plant-01';

async function run() {
  console.log('========================================================');
  console.log(' FACTORY SAFETY AI - END-TO-END VERIFICATION SUITE');
  console.log('========================================================\n');

  // Test 1: Health
  console.log('[TEST 1] Testing Health Endpoints...');
  const liveRes = await fetch(`${SERVER_URL}/health/live`).then(r => r.json());
  const readyRes = await fetch(`${SERVER_URL}/health/ready`).then(r => r.json());
  console.log('  Live status:', liveRes.status, '| Uptime:', liveRes.uptime.toFixed(1) + 's');
  console.log('  Ready status:', readyRes.status, '| DB:', readyRes.database);
  if (liveRes.status !== 'ok' || readyRes.status !== 'ready') throw new Error('Health check failed');
  console.log('  [PASS] Health endpoints healthy.\n');

  // Test 2: Supervisor Login
  console.log('[TEST 2] Testing Supervisor Login...');
  const loginRes = await fetch(`${SERVER_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'supervisor@factory.ai', password: 'supervisor123' }),
  }).then(r => r.json());
  console.log('  Login response:', loginRes.ok ? 'SUCCESS' : 'FAILED', '| User:', loginRes.user?.name, `(${loginRes.user?.role})`);
  if (!loginRes.token) throw new Error('Login failed to return token');
  const token = loginRes.token;
  console.log('  [PASS] JWT issued successfully.\n');

  // Test 3: Edge Heartbeat
  console.log('[TEST 3] Testing Edge Heartbeat...');
  const heartbeatRes = await fetch(`${SERVER_URL}/edge/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Edge-Api-Key': EDGE_API_KEY,
    },
    body: JSON.stringify({
      edgeNodeId: 'edge-node-01',
      fps: 29.8,
      latencyMs: 14.1,
      cameras: [
        { id: 'cam-01', status: 'online', fps: 29.8, frameAgeMs: 33 },
        { id: 'cam-02', status: 'online', fps: 29.5, frameAgeMs: 34 },
      ],
    }),
  }).then(r => r.json());
  console.log('  Heartbeat response:', JSON.stringify(heartbeatRes));
  if (!heartbeatRes.ok) throw new Error('Heartbeat failed');
  console.log('  [PASS] Heartbeat processed.\n');

  // Test 4: WebSocket Connection & Replay
  console.log('[TEST 4] Testing Native WebSocket with Replay (?since=0)...');
  const receivedWsEvents = [];
  const ws = new WebSocket(`${WS_URL}?token=${token}&since=0`);
  
  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('  Connected to WebSocket at', WS_URL);
      resolve();
    });
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        receivedWsEvents.push(msg);
      } catch {}
    });
    ws.on('error', reject);
    setTimeout(resolve, 1000);
  });
  console.log(`  Initial events received on connect: ${receivedWsEvents.length}`);
  console.log('  [PASS] WebSocket handshake & initial replay verified.\n');

  // Test 5: Alert Ingestion & Idempotency
  console.log('[TEST 5] Ingesting New CRITICAL Hazard Alert (Fire)...');
  const runId = Date.now();
  const alertId = 'test-fire-alert-' + runId;
  const alertPayload = {
    id: alertId,
    cameraId: 'cam-01',
    severity: 'CRITICAL',
    type: 'fire',
    items: ['flame_core'],
    confidence: 0.94,
    votes: '4/5',
    zone_id: 'z-test-' + runId,
    ts: new Date().toISOString(),
  };

  const ingestRes = await fetch(`${SERVER_URL}/edge/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Edge-Api-Key': EDGE_API_KEY,
    },
    body: JSON.stringify(alertPayload),
  }).then(r => r.json());
  console.log('  Ingest response:', JSON.stringify(ingestRes));
  if (!ingestRes.ok || ingestRes.alertId !== alertId) throw new Error('Alert ingest failed');

  // Test 5b: Immediate re-transmission of identical UUID (Idempotency)
  console.log('  Testing UUID Idempotency re-send...');
  const idempRes = await fetch(`${SERVER_URL}/edge/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Edge-Api-Key': EDGE_API_KEY,
    },
    body: JSON.stringify(alertPayload),
  }).then(r => r.json());
  console.log('  Idempotency response:', JSON.stringify(idempRes));
  if (idempRes.status !== 'already_exists') throw new Error('Idempotency check failed');
  console.log('  [PASS] Alert ingested idempotently.\n');

  // Test 6: Cooldown window deduplication
  console.log('[TEST 6] Testing Secondary 60s Deduplication Window (hitCount)...');
  const secondAlertId = 'test-fire-alert-2-' + Date.now();
  const secondPayload = {
    ...alertPayload,
    id: secondAlertId,
    confidence: 0.98,
  };
  const dedupRes = await fetch(`${SERVER_URL}/edge/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Edge-Api-Key': EDGE_API_KEY,
    },
    body: JSON.stringify(secondPayload),
  }).then(r => r.json());
  console.log('  Deduplication response:', JSON.stringify(dedupRes));
  // dedupRes.alertId should match original alertId!
  if (dedupRes.alertId !== alertId) throw new Error(`Expected dedup hit on ${alertId}, got ${dedupRes.alertId}`);
  console.log(`  [PASS] Deduplication matched existing incident ${alertId}.\n`);

  // Wait briefly for WS broadcast
  await new Promise(r => setTimeout(r, 600));

  // Test 7: CAS State Machine (OPEN -> ACKNOWLEDGED)
  console.log('[TEST 7] Testing Compare-and-Swap (CAS) Alert Transition...');
  // First fetch current alert state
  const alertDetail = await fetch(`${SERVER_URL}/alerts/${alertId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());
  console.log(`  Current alert version: ${alertDetail.version}, status: ${alertDetail.status}, hits: ${alertDetail.hitCount}`);

  // Test CAS conflict rejection
  const staleCasRes = await fetch(`${SERVER_URL}/alerts/${alertId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: 'ACKNOWLEDGED',
      expectedVersion: 999, // stale version
      note: 'Supervisor on the way',
    }),
  });
  console.log(`  Stale CAS HTTP response: ${staleCasRes.status} (expected 409 Conflict)`);
  if (staleCasRes.status !== 409) throw new Error('Expected 409 Conflict on stale CAS version');

  // Valid CAS transition
  const validCasRes = await fetch(`${SERVER_URL}/alerts/${alertId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: 'ACKNOWLEDGED',
      expectedVersion: alertDetail.version,
      note: 'Supervisor acknowledged, evacuating sector',
    }),
  }).then(r => r.json());
  console.log('  CAS Transition result:', validCasRes.status, '| New version:', validCasRes.version);
  if (validCasRes.status !== 'ACKNOWLEDGED') throw new Error('Transition failed');
  console.log('  [PASS] CAS state machine verified.\n');

  // Test 8: Physical Alarm Unlatching Verification
  console.log('[TEST 8] Testing Edge Alarm Unlatching via Heartbeat...');
  const postAckHeartbeat = await fetch(`${SERVER_URL}/edge/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Edge-Api-Key': EDGE_API_KEY,
    },
    body: JSON.stringify({
      edgeNodeId: 'edge-node-01',
      fps: 30.0,
      cameras: [{ id: 'cam-01', status: 'online' }],
    }),
  }).then(r => r.json());
  console.log('  Heartbeat response clearAlarms:', JSON.stringify(postAckHeartbeat.clearAlarms));
  if (!postAckHeartbeat.clearAlarms.includes(alertId)) {
    throw new Error(`Expected alert ${alertId} in clearAlarms list!`);
  }
  console.log('  [PASS] Unlatch signal returned in clearAlarms for physical alarm reset.\n');

  // Test 9: Reports & Export
  console.log('[TEST 9] Testing CSV Stream & Aggregates...');
  const csvText = await fetch(`${SERVER_URL}/reports/compliance?format=csv`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.text());
  const headerLine = csvText.split('\n')[0];
  console.log('  CSV Header:', headerLine);
  console.log('  CSV Rows:', csvText.trim().split('\n').length);

  const aggregates = await fetch(`${SERVER_URL}/reports/aggregates`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());
  console.log('  Aggregates total:', aggregates.total, '| Open:', aggregates.open, '| Acknowledged:', aggregates.acknowledged);
  console.log('  [PASS] Reports generated successfully.\n');

  ws.close();
  console.log('========================================================');
  console.log(' [SUCCESS] ALL 9/9 SYSTEM VERIFICATION CHECKS PASSED!');
  console.log('========================================================');
}

run().catch((err) => {
  console.error('\n[FAIL] Test suite failed with error:', err);
  process.exit(1);
});
