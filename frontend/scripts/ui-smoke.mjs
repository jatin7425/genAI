// UI regression checks use fixture APIs; no live account or backend is required.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const frontend=fileURLToPath(new URL('../', import.meta.url));
const root=process.env.CORTEX_SCREENSHOT_DIR || resolve(tmpdir(), 'cortex-ui-check');
mkdirSync(root, {recursive:true});
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4179','--strictPort'],{cwd:frontend,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{ const timeout=setTimeout(()=>reject(Error('Vite startup timeout')),15000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timeout);resolve()}});server.on('exit',c=>reject(Error('Vite exited '+c))); });
const browser=await chromium.launch({headless:true,executablePath:process.env.CORTEX_CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const errors=[];let chatRequests=[];
const conversations=[{session_id:'test-session',persona:'Default Assistant',model:'gpt-4.1',title:'Planning a research project',updated_at:new Date().toISOString(),turns:[]}];
await context.route('**/V1/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname;
 let body={};
 if(path==='/V1/models') body={models:['gpt-4.1','Claude Sonnet']};
 else if(path==='/V1/personas') body={personas:['Default Assistant','Research partner']};
 else if(path==='/V1/suggestions') body={suggestions:[{icon:'travel_explore',title:'Explore an idea',description:'Research a topic and turn what you find into clear insights.'},{icon:'code',title:'Build something',description:'Work through a coding problem, one step at a time.'},{icon:'lightbulb',title:'Make a plan',description:'Bring structure to your next project or big decision.'}]};
 else if(path==='/V1/conversations/stream') return route.fulfill({status:200,contentType:'text/event-stream',body:': heartbeat\n\n'});
 else if(path.startsWith('/V1/conversations/') && req.method()==='PUT') { const data=req.postDataJSON();const id=path.split('/').at(-1);const old=conversations.find(c=>c.session_id===id);if(old)Object.assign(old,data);else conversations.push({session_id:id,persona:data.persona,model:data.model,title:data.turns[0]?.text || 'New conversation',turns:data.turns,updated_at:new Date().toISOString()}); }
 else if(path==='/V1/conversations') body={items:conversations,total:1,has_more:false};
 else if(!path.includes('test-session') && path.endsWith('/messages')) body={items:[],total:0,has_more:false};
 else if(path.endsWith('/messages')) body={items:[{id:'u1',kind:'user',text:'Help me plan a research project.'},{id:'a1',kind:'agent',text:'## A clear starting point\n\nStart with a focused question, then gather reliable sources.\n\n- Define the goal\n- Compare the evidence\n- Write a concise summary\n\n```python\nprint("Hello, Cortex")\n```',status:'done'}],total:2,has_more:false};
 else if(path==='/V1/documents/list') body={items:[{_id:'doc-1',filename:'Research notes.pdf',status:'indexed',chunk_count:4}],total:1,has_more:false};
 else if(path.startsWith('/V1/documents/chunks/list')) body={items:[{_id:'chunk-1',document_id:'doc-1',chunk_index:0,modality:'text',text:'This is a sample research document for interface verification.',page:1}],total:1,has_more:false};
 else if(path==='/V1/chat') {
  chatRequests.push(req.postDataJSON());
  return route.fulfill({status:200,contentType:'text/event-stream',body:'event: session\ndata: {"session_id":"new-session"}\n\nevent: token\ndata: {"content":"Here is a thoughtful response."}\n\nevent: done\ndata: {"status":"done","answer":"Here is a thoughtful response.","sources":[],"confidence":"high"}\n\n'});
 }
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
try{
 await page.goto('http://127.0.0.1:4179/login');await page.getByText('Welcome back.').waitFor();await noOverflow();await page.screenshot({path:root+'/cortex-login.png'});
 await page.evaluate(()=>localStorage.setItem('cortex.authToken','ui-test-fixture'));
 await page.goto('http://127.0.0.1:4179/chat');await page.getByText('Where should we begin?').waitFor();await noOverflow();await page.screenshot({path:root+'/cortex-desktop.png'});
 assert(!await page.getByRole('button',{name:'Send message',exact:true}).isEnabled());
 await page.getByLabel('Message Cortex',{exact:true}).fill('First line');await page.getByLabel('Message Cortex',{exact:true}).press('Shift+Enter');assert((await page.getByLabel('Message Cortex',{exact:true}).inputValue()).includes('\n'));assert.equal(chatRequests.length,0);
 await page.getByRole('button',{name:'Choose model'}).click();await page.getByRole('button',{name:'Claude Sonnet',exact:true}).click();assert(await page.getByRole('button',{name:'Choose model'}).innerText().then(s=>s.includes('Claude Sonnet')));
 await page.getByRole('button',{name:'Choose persona'}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Choose persona'}).getAttribute('aria-expanded'),'false');
 await page.getByLabel('Search conversations').fill('no match');await page.getByText('No matching conversations').waitFor();await page.getByLabel('Search conversations').fill('');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByText('Your workspace, your way.').waitFor();await page.getByRole('button',{name:'Dark',exact:true}).click();assert(await page.evaluate(()=>document.documentElement.classList.contains('dark')));await page.reload();await page.getByText('Your workspace, your way.').waitFor();assert(await page.evaluate(()=>document.documentElement.classList.contains('dark')));await page.screenshot({path:root+'/cortex-settings-dark.png'});await page.getByRole('button',{name:'Light',exact:true}).click();
 await page.getByRole('button',{name:'New Persona'}).click();await page.getByRole('dialog',{name:'Create persona'}).waitFor();await page.getByLabel('IDENTITY',{exact:true}).fill('Analyst');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Documents',exact:true}).click();await page.getByRole('link',{name:/Research notes/}).click();await page.getByText('This is a sample research document for interface verification.').waitFor();await noOverflow();
 await page.goto('http://127.0.0.1:4179/chat/test-session');await page.getByText('A clear starting point').waitFor();await noOverflow();await page.screenshot({path:root+'/cortex-conversation.png'});
 await page.getByRole('link',{name:/New conversation/}).click();await page.getByText('Where should we begin?').waitFor();await page.getByLabel('Message Cortex',{exact:true}).fill('Help me research');await page.getByLabel('Message Cortex',{exact:true}).press('Enter');await page.getByText('Here is a thoughtful response.').waitFor();assert.equal(chatRequests.at(-1).message,'Help me research');
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4179/chat');await page.getByText('Where should we begin?').waitFor();await noOverflow();await page.screenshot({path:root+'/cortex-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('dialog',{name:'Navigation'}).waitFor();await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'Navigation'}).count(),0);
 await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('dialog',{name:'Navigation'}).getByRole('link',{name:/New conversation/}).click();assert.equal(await page.getByRole('dialog',{name:'Navigation'}).count(),0);
 await page.setViewportSize({width:320,height:640});await noOverflow();await page.getByLabel('Message Cortex',{exact:true}).fill('Small screen test');assert(await page.getByRole('button',{name:'Send message',exact:true}).isVisible());
 await page.goto('http://127.0.0.1:4179/login');await page.evaluate(()=>localStorage.removeItem('cortex.authToken'));await page.reload();await page.getByText('Welcome back.').waitFor();await noOverflow();
 assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile layouts, login, composer, streamed response, pickers, search, theme persistence, dialogs, documents, conversation rendering; no runtime errors.');
}catch(e){ console.log('DEBUG',JSON.stringify(chatRequests),errors,await page.locator('body').innerText());await page.screenshot({path:root+'/cortex-check-failure.png'});throw e;}finally{await browser.close();server.kill()}
