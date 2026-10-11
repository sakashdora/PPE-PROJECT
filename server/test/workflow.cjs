// Meaningful regression checks against a fresh, disposable database and real Nest services.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),server=path.join(root,'server');
require(path.join(server,'node_modules/dotenv')).config({path:path.join(server,'.env'),quiet:true});
fs.mkdirSync(path.join(root,'.runtime/tests'),{recursive:true});
process.env.DATABASE_URL='file:'+path.join(root,'.runtime/tests/workflow-'+Date.now()+'.db').replace(/\\/g,'/');
const pushed=spawnSync(process.execPath,[path.join(server,'node_modules/prisma/build/index.js'),'migrate','diff','--from-empty','--to-schema-datamodel',path.join(server,'prisma/schema.prisma'),'--script'],{cwd:server,env:process.env,encoding:'utf8'});
if(pushed.status!==0)throw Error(pushed.stdout+pushed.stderr);
const {DatabaseSync}=require('node:sqlite');const fixture=new DatabaseSync(process.env.DATABASE_URL.slice(5));fixture.exec(pushed.stdout);fixture.close();
require(path.join(server,'node_modules/ts-node')).register({project:path.join(server,'tsconfig.json'),transpileOnly:true});
const {NestFactory}=require(path.join(server,'node_modules/@nestjs/core'));
const {AppModule}=require(path.join(server,'src/app.module'));
const {PrismaService}=require(path.join(server,'src/prisma/prisma.service'));
const {EdgeService}=require(path.join(server,'src/edge/edge.service'));
const {AlertsService}=require(path.join(server,'src/alerts/alerts.service'));
const {ConfigService}=require(path.join(server,'src/config/config.service'));
const {ReportsService}=require(path.join(server,'src/reports/reports.service'));
const {RealtimeGateway}=require(path.join(server,'src/realtime/realtime.gateway'));
const {AuthService}=require(path.join(server,'src/auth/auth.service'));
const {JwtAuthGuard}=require(path.join(server,'src/auth/guards/jwt-auth.guard'));
const bcrypt=require(path.join(server,'node_modules/bcrypt'));
async function run(){
 const app=await NestFactory.createApplicationContext(AppModule,{logger:false});const db=app.get(PrismaService),edge=app.get(EdgeService),alerts=app.get(AlertsService),config=app.get(ConfigService),reports=app.get(ReportsService);const results=[];
 const check=async(name,work)=>{await work();results.push(name);console.log('PASS '+name);};
 try{
  const site=await db.site.create({data:{name:'Verification plant'}});const sector=await db.sector.create({data:{siteId:site.id,name:'Test sector'}});
  const key=crypto.randomUUID();const node=await db.edgeNode.create({data:{id:'test-edge',siteId:site.id,name:'Verification edge',apiKeyHash:crypto.createHash('sha256').update(key).digest('hex')}});
  const foreignNode=await db.edgeNode.create({data:{id:'foreign-edge',siteId:site.id,name:'Other edge',apiKeyHash:'not-the-key'}});
  const camera=await db.camera.create({data:{id:'test-camera',sectorId:sector.id,edgeNodeId:node.id,name:'Test camera',streamUrlEnc:'synthetic'}});
  const password=crypto.randomUUID();const user=await db.user.create({data:{email:'test@example.invalid',name:'Verifier',role:'SUPERVISOR',passwordHash:await bcrypt.hash(password,4)}});
  const admin={...user,role:'ADMIN'};
  await db.modelVersion.create({data:{name:'best_s5',active:true,metrics:'{}',thresholds:'{"fire":0.3,"smoke":0.25}'}});
  await db.configState.create({data:{id:1,params:'{"fire_window":5,"fire_threshold":2}'}});
  const payload={id:crypto.randomUUID(),cameraId:camera.id,severity:'CRITICAL',type:'fire',items:['fire'],confidence:.91,votes:'2/5',ts:new Date().toISOString(),zone_id:'verification'};
  const messages=[];app.get(RealtimeGateway).eventBus.on('alert',message=>messages.push(message));
  await check('Shared event bus delivers a normalized live incident',async()=>{const result=await edge.ingestAlert(node,payload);assert.equal(result.alertId,payload.id);assert.equal(messages.at(-1).data.status,'open');assert.deepEqual(messages.at(-1).data.items,['fire']);assert.equal(edge.eventBus,app.get(RealtimeGateway).eventBus);});
  await check('UUID retries are idempotent',async()=>{const before=await db.alertEvent.count();assert.equal((await edge.ingestAlert(node,payload)).status,'already_exists');assert.equal(await db.alertEvent.count(),before);});
  const alias={...payload,id:crypto.randomUUID()};
  await check('Dedup receipts retain edge IDs and count aliases once',async()=>{assert.equal((await edge.ingestAlert(node,alias)).alertId,payload.id);await edge.ingestAlert(node,alias);assert.equal((await db.alert.findUnique({where:{id:payload.id}})).hitCount,2);assert.equal(await db.alertReceipt.count({where:{alertId:payload.id}}),2);});
  let current=await alerts.getAlertById(payload.id);
  await check('Missing CAS version is rejected',()=>assert.rejects(alerts.transition(payload.id,user,{action:'ack'}),e=>e.getStatus()===400));
  await check('OPEN cannot skip acknowledgment',()=>assert.rejects(alerts.transition(payload.id,user,{action:'resolve',expectedVersion:current.version}),e=>e.getStatus()===409));
  await check('Stale CAS version is rejected',()=>assert.rejects(alerts.transition(payload.id,user,{action:'ack',expectedVersion:999}),e=>e.getStatus()===409));
  await check('Concurrent supervisor actions have one winner',async()=>{const outcomes=await Promise.allSettled([alerts.transition(payload.id,user,{action:'ack',expectedVersion:current.version,note:'Verified test'}),alerts.transition(payload.id,user,{action:'ack',expectedVersion:current.version})]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);assert.equal(outcomes.find(x=>x.status==='rejected').reason.getStatus(),409);current=await alerts.getAlertById(payload.id);assert.equal(current.status,'acknowledged');});
  await check('Heartbeat clears canonical and deduplicated edge IDs',async()=>{const result=await edge.processHeartbeat(node,{cameras:[{id:camera.id,status:'online',lastFrameAt:new Date().toISOString()}],activeAlertIds:[payload.id,alias.id],detectorMode:'onnx'});assert.deepEqual(new Set(result.clearAlarms),new Set([payload.id,alias.id]));});
  await check('Resolution preserves acknowledgment attribution',async()=>{const ackAt=current.ackAt;const result=await alerts.transition(payload.id,{id:user.id,name:'Second supervisor',role:'SUPERVISOR'},{action:'resolve',expectedVersion:current.version});assert.equal(result.status,'resolved');assert.equal(result.ackBy,user.name);assert.equal(String(result.ackAt),String(ackAt));assert.ok(result.resolvedAt);});
  await check('Edge camera ownership is enforced',()=>assert.rejects(edge.ingestAlert(foreignNode,{...payload,id:crypto.randomUUID()}),e=>e.getStatus()===403));
  await check('Snapshot path traversal and invalid content are rejected',async()=>{await assert.rejects(edge.ingestAlert(node,{...payload,id:'../../escape'}),e=>e.getStatus()===400);await assert.rejects(edge.ingestAlert(node,{...payload,id:crypto.randomUUID()},Buffer.from('not-jpeg')),e=>e.getStatus()===400);});
  await check('Invalid model activation leaves the current model active',async()=>{await assert.rejects(config.activateModel('missing',admin));assert.equal((await db.modelVersion.findFirst({where:{active:true}})).name,'best_s5');});
  await check('Detection settings validate and commit atomically',async()=>{const version=(await config.state()).version;await assert.rejects(config.saveDetection(admin,{thresholds:{fire:.3},params:{fire_window:1,fire_threshold:2}}));assert.equal((await config.state()).version,version);await config.saveDetection(admin,{thresholds:{fire:.4},params:{fire_window:5,fire_threshold:2}});assert.equal((await config.state()).version,version+1);assert.equal((await config.state()).thresholds.fire,.4);});
  await check('Camera and zone configuration is durable and normalized',async()=>{const created=await config.createCamera(admin,{name:'Added camera',source:'synthetic',sectorId:sector.id,edgeNodeId:node.id});const zone=await config.createZone(admin,{cameraId:created.id,name:'PPE area',kind:'PPE_REQUIRED',polygon:[[0,0],[1,0],[1,1]],requiredPpe:['helmet']});const read=(await config.listCameras(true)).find(c=>c.id===created.id);assert.equal(read.zones[0].name,'PPE area');assert.deepEqual(read.zones[0].polygon,[[0,0],[1,0],[1,1]]);await config.deleteZone(zone.id,admin);});
  await check('Opaque UUID pagination and date filters work',async()=>{await edge.ingestAlert(node,{...payload,id:crypto.randomUUID(),zone_id:'other'});const first=await alerts.listAlerts({limit:1});const second=await alerts.listAlerts({limit:1,cursor:first.nextCursor});assert.notEqual(first.items[0].id,second.items[0].id);assert.equal((await alerts.listAlerts({limit:10,from:'2099-01-01'})).items.length,0);});
  await check('Real authentication and current-user validation work',async()=>{const login=await app.get(AuthService).login(user.email,password);const req={headers:{authorization:'Bearer '+login.token}};await app.get(JwtAuthGuard).canActivate({switchToHttp:()=>({getRequest:()=>req})});assert.equal(req.user.role,'SUPERVISOR');await assert.rejects(app.get(AuthService).login(user.email,'incorrect'));});
  await check('Reports and overview share incident contracts',async()=>{const view=await reports.overview();assert.equal(view.totals.open,1);assert.equal(view.totals.critical,1);assert.ok(view.recent.every(a=>Array.isArray(a.items)));assert.ok((await reports.generateComplianceCsv({})).includes('Verified test'));const metrics=await reports.getAggregates();assert.equal(metrics.total,2);assert.equal(metrics.resolved,1);});
  fs.mkdirSync(path.join(root,'.runtime/verification'),{recursive:true});fs.writeFileSync(path.join(root,'.runtime/verification/server-workflow.json'),JSON.stringify({checks:results.length,passed:results,scope:'Fresh isolated SQLite database and actual Nest services'},null,2));
  console.log(results.length+' workflow checks passed');
 }finally{await app.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
