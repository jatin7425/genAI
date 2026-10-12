// Fixture-only companion workflow; no live provider or real password required.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4181','--strictPort'],{cwd,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),15000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve()}});server.on('exit',code=>reject(Error('Vite exited '+code)))});
const browser=await chromium.launch({headless:true,executablePath:process.env.CORTEX_CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
let profiles=[],threads=[],lastMessage=null,extractCalls=0;const key='fixture-world-token';
await context.route('**/V1/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 if(path==='/V1/models')return json({models:['gemini-3.5-flash']});
 if(path==='/V1/personas')return json({personas:['Default Assistant']});
 if(path==='/V1/suggestions')return json({suggestions:[]});
 if(path==='/V1/conversations')return json({items:[],total:0,has_more:false});
 if(path==='/V1/conversations/stream')return route.fulfill({status:200,contentType:'text/event-stream',body:': heartbeat\n\n'});
 if(path==='/V1/roleplay/unlock')return req.postDataJSON().password==='world-fixture'?json({token:key}):json({detail:'Incorrect password.'},403);
 if(path.startsWith('/V1/roleplay/') && req.headers()['x-roleplay-token']!==key)return json({detail:'The secret world is locked.'},403);
 if(path==='/V1/roleplay/lock')return json({status:'locked'});
 if(path==='/V1/roleplay/extract'){extractCalls++;return json({attributes:{name:'Mira',height:'165 cm',body_type:'Athletic',favourite_music:'Jazz',extra_detail:'Collects vintage postcards'},missing_fields:['age','personality','relationship']})}
 if(path==='/V1/roleplay/profiles' && req.method()==='POST'){const profile={id:'companion-a',...req.postDataJSON(),updated_at:new Date().toISOString()};profiles.push(profile);return json(profile)}
 if(path==='/V1/roleplay/profiles')return json({profiles});
 if(path==='/V1/roleplay/profiles/companion-a' && req.method()==='PUT'){profiles[0]={...profiles[0],...req.postDataJSON()};return json(profiles[0])}
 if(path.endsWith('/threads'))return json({threads});
 if(path.endsWith('/chat')){lastMessage=req.postDataJSON();const id=lastMessage.session_id||'private-thread';const old=threads.find(t=>t.id===id);threads=[{id,profile_id:'companion-a',updated_at:new Date().toISOString(),turns:[...(old?.turns||[]),{id:crypto.randomUUID(),kind:'user',text:lastMessage.message},{id:crypto.randomUUID(),kind:'agent',text:'Hi, I am Mira. Tell me about your day.'}]}];return route.fulfill({status:200,contentType:'text/event-stream',body:`event: session\ndata: ${JSON.stringify({session_id:id})}\n\nevent: token\ndata: {"content":"Hi, I am Mira. Tell me about your day."}\n\nevent: done\ndata: {"status":"done","answer":"Hi, I am Mira. Tell me about your day.","sources":[],"confidence":"unknown"}\n\n`})}
 return json({});
});
const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
try{
 await page.goto('http://127.0.0.1:4181/login');await page.evaluate(()=>localStorage.setItem('cortex.authToken','fixture-auth'));
 await page.goto('http://127.0.0.1:4181/chat');await page.getByLabel('Search conversations').fill('Open the secret world of releplay');await page.getByRole('dialog',{name:'Unlock secret world'}).waitFor();
 await page.getByLabel('Secret world password',{exact:true}).fill('wrong');await page.getByRole('button',{name:'Enter secret world',exact:true}).click();await page.getByText('Incorrect password.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('cortex.authToken')),'fixture-auth');
 await page.getByLabel('Secret world password',{exact:true}).fill('world-fixture');await page.getByRole('button',{name:'Enter secret world',exact:true}).click();await page.waitForURL('**/secret-world');await page.getByText('Meet someone').waitFor();await noOverflow();
 await page.getByRole('button',{name:'Create your AI girlfriend',exact:false}).click();await page.getByRole('dialog',{name:'Create companion'}).waitFor();
 await page.getByLabel('Character description',{exact:true}).fill('Mira is 165 cm tall, athletic, likes jazz and collects vintage postcards.');await page.getByRole('button',{name:'Extract character details',exact:true}).click();await page.getByText('Please add age, personality, relationship to complete her character.',{exact:true}).waitFor();
 assert.equal(extractCalls,1);assert.equal(await page.getByLabel('Age (18 or older)',{exact:false}).inputValue(),'');assert.equal(await page.getByLabel('body type',{exact:true}).inputValue(),'Athletic');assert.equal(await page.getByLabel('extra detail',{exact:true}).inputValue(),'Collects vintage postcards');assert(!await page.getByRole('button',{name:'Create your companion',exact:true}).isEnabled());
 await page.getByLabel('Age (18 or older)',{exact:false}).fill('24');await page.getByLabel('Personality',{exact:false}).fill('Warm and witty');await page.getByLabel('Relationship with you',{exact:false}).fill('Girlfriend');await page.getByLabel('Extra detail key',{exact:true}).fill('favourite_place');await page.getByLabel('Extra detail value',{exact:true}).fill('Marine Drive');await page.getByRole('button',{name:'Add detail',exact:true}).click();
 await page.getByRole('button',{name:'Create your companion',exact:true}).click();await page.getByRole('dialog',{name:'Create companion'}).waitFor({state:'hidden'});await page.getByLabel('Message your companion',{exact:true}).waitFor();assert.equal(profiles[0].attributes.favourite_place,'Marine Drive');assert(profiles[0].description.includes('postcards'));
 await page.getByLabel('Message your companion',{exact:true}).fill('Hello Mira');await page.getByRole('button',{name:'Send companion message',exact:true}).click();await page.getByText('Hi, I am Mira. Tell me about your day.',{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-label="Message your companion"]').disabled);assert.equal(lastMessage.model,'gemini-3.5-flash');
 await page.getByLabel('Edit companion details',{exact:true}).click();await page.getByRole('dialog',{name:'Edit companion'}).waitFor();await page.getByLabel('Name',{exact:false}).fill('Riya');await page.getByLabel('height',{exact:true}).fill('168 cm');await page.getByRole('button',{name:'Save her character',exact:true}).click();await page.getByRole('dialog',{name:'Edit companion'}).waitFor({state:'hidden'});assert.equal(profiles[0].attributes.name,'Riya');
 await page.reload();await page.getByRole('button',{name:/Riya/}).click();await page.getByText('Hi, I am Mira. Tell me about your day.',{exact:true}).waitFor();await noOverflow();mkdirSync('/tmp/companion-ui',{recursive:true});await page.screenshot({path:'/tmp/companion-ui/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await noOverflow();await page.screenshot({path:'/tmp/companion-ui/mobile.png',fullPage:true});await page.setViewportSize({width:320,height:700});await noOverflow();
 await page.getByRole('button',{name:'Lock secret world',exact:true}).click();await page.waitForURL('**/chat');assert.equal(await page.evaluate(()=>sessionStorage.getItem('cortex.secretWorld')),null);
 await page.goto('http://127.0.0.1:4181/secret-world');await page.getByRole('dialog',{name:'Unlock secret world'}).waitFor();assert.equal(await page.getByLabel('Message your companion',{exact:true}).count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: hidden phrase, password errors, locked route, extraction/missing fields, extra KV, editing, private streaming/history, models, lock/reload, desktop/390/320 layouts; no runtime errors.');
}catch(error){console.log('DEBUG',await page.locator('body').innerText());throw error}finally{await browser.close();server.kill()}
