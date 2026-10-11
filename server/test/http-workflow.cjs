const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');require('../node_modules/dotenv').config({path:path.join(root,'server/.env'),quiet:true});
const WebSocket=require('../node_modules/ws');
const base='http://localhost:3000/api/backend';
async function request(path,options={}){const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(20000)});return {response,data:await response.json().catch(()=>null)};}
(async()=>{
 const results=[];const check=async(name,work)=>{await work();results.push(name);console.log('PASS '+name);};
 await check('Unauthenticated dashboard API is rejected',async()=>assert.equal((await request('/reports/overview')).response.status,401));
 await check('Invalid credentials are rejected',async()=>assert.equal((await request('/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:process.env.TEST_EMAIL,password:'invalid-verification-password'})})).response.status,401));
 const login=await request('/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:process.env.TEST_EMAIL,password:process.env.TEST_PASSWORD})});assert.equal(login.response.status,200);
 const cookie=login.response.headers.get('set-cookie').split(';')[0];const headers={cookie,'content-type':'application/json'};
 const overview=(await request('/reports/overview',{headers})).data;
 await check('Authenticated snapshot has complete counts and normalized incidents',async()=>{assert.ok(overview.totals.open>=0);assert.equal(overview.cameras.length,4);assert.ok(overview.alerts.every(a=>Array.isArray(a.items)&&typeof a.version==='number'));});
 await check('Four concurrent authenticated previews serve JPEG data',async()=>{await Promise.all(overview.cameras.map(async camera=>{const response=await fetch('http://localhost:3000'+camera.previewUrl,{headers:{cookie},signal:AbortSignal.timeout(12000)});assert.equal(response.status,200);assert.ok(response.headers.get('content-type').includes('multipart'));const reader=response.body.getReader();const frame=await reader.read();assert.ok(frame.value.byteLength>100);await reader.cancel();}));});
 await check('Unauthenticated WebSocket is closed before incident access',async()=>{await new Promise((resolve,reject)=>{const ws=new WebSocket('ws://localhost:4000/ws');const timer=setTimeout(()=>{ws.terminate();reject(Error('Unauthenticated socket remained open'));},10000);ws.on('message',()=>reject(Error('Unauthenticated incident exposure')));ws.on('close',code=>{clearTimeout(timer);try{assert.equal(code,1008);resolve();}catch(e){reject(e);}});ws.on('error',()=>{});});});
 const ws=new WebSocket('ws://localhost:4000/ws?since='+overview.cursor,{headers:{cookie}});
 const messages=[];ws.on('message',value=>{try{messages.push(JSON.parse(value))}catch{}});
 await new Promise((resolve,reject)=>{ws.on('open',resolve);ws.on('error',reject);});
 const id=crypto.randomUUID();const payload={id,cameraId:'cam-01',severity:'CRITICAL',type:'fire',items:['fire'],confidence:.91,votes:'2/5',ts:new Date().toISOString(),zone_id:'verification-'+id,model_version:'verification-fixture'};
 const snapshot=await fetch('http://localhost:3000/api/preview/cam-01?snapshot=1',{headers:{cookie},signal:AbortSignal.timeout(10000)});assert.equal(snapshot.status,200);
 const form=new FormData();form.append('payload',JSON.stringify(payload));form.append('snapshot',new Blob([await snapshot.arrayBuffer()],{type:'image/jpeg'}),'verification.jpg');
 const ingress=await fetch('http://localhost:4000/edge/alerts',{method:'POST',headers:{'x-edge-api-key':process.env.EDGE_API_KEY},body:form});assert.equal(ingress.status,200);assert.equal((await ingress.json()).alertId,id);
 await check('Authenticated WebSocket receives normalized live ingestion',async()=>{const start=Date.now();while(!messages.some(m=>m.data?.id===id)){if(Date.now()-start>8000)throw Error('No live event received');await new Promise(resolve=>setTimeout(resolve,30));}const event=messages.find(m=>m.data?.id===id);assert.equal(event.data.status,'open');assert.deepEqual(event.data.items,['fire']);assert.ok(event.seq>overview.cursor);});
 const current=(await request('/alerts/'+id,{headers})).data;
 await check('HTTP CAS rejects omission, stale versions and skipped acknowledgment',async()=>{assert.equal((await request('/alerts/'+id,{method:'PATCH',headers,body:JSON.stringify({action:'ack'})})).response.status,400);assert.equal((await request('/alerts/'+id,{method:'PATCH',headers,body:JSON.stringify({action:'ack',expectedVersion:999})})).response.status,409);assert.equal((await request('/alerts/'+id,{method:'PATCH',headers,body:JSON.stringify({action:'resolve',expectedVersion:current.version})})).response.status,409);});
 await check('Evidence endpoint serves the uploaded JPEG',async()=>{const image=await fetch('http://localhost:3000'+current.snapshotUrl,{headers:{cookie}});assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');assert.ok((await image.arrayBuffer()).byteLength>100);});
 ws.close();
 fs.mkdirSync(path.join(root,'.runtime/verification'),{recursive:true});fs.writeFileSync(path.join(root,'.runtime/verification/http-workflow.json'),JSON.stringify({passed:results,checks:results.length,browserIncidentId:id,browserIncidentUrl:'http://localhost:3000/alerts?incident='+id,fixture:'Explicit workflow-verification incident; resolve through browser',modelVersion:'verification-fixture'},null,2));console.log('Browser verification incident: '+id);
})().catch(e=>{console.error(e);process.exitCode=1;});
