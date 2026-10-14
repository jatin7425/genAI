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
const errors=[];let chatRequests=[];let uploadCounter=0;const uploaded=new Map();
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSAAAAABJRU5ErkJggg==','base64');
const personaPrompts=new Map([['Default Assistant','Be helpful.'],['Research partner','Help with research.']]);const memoryEntries=new Map();
const conversations=[{session_id:'test-session',persona:'Default Assistant',model:'gemini-3.5-flash',title:'Planning a research project',updated_at:new Date().toISOString(),turns:[]}];
await context.route('**/V1/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname;
 let body={};
 if(path==='/V1/models') body={models:['gemini-3.5-flash','nvidia/nemotron-3-super-120b-a12b']};
 else if(path==='/V1/personas') body={personas:['Default Assistant','Research partner']};
 else if(path.startsWith('/V1/personas/')) {
  const name=decodeURIComponent(path.split('/').at(-1));
  if(req.method()==='PUT') personaPrompts.set(name,req.postDataJSON().prompt);
  body={name,prompt:personaPrompts.get(name)};
 }
 else if(path==='/V1/memory') { if(req.method()==='DELETE')memoryEntries.clear();body={entries:[...memoryEntries].map(([key,value])=>({key,value}))}; }
 else if(path.startsWith('/V1/memory/')) { const key=decodeURIComponent(path.split('/').at(-1));if(req.method()==='PUT')memoryEntries.set(key,req.postDataJSON().value);if(req.method()==='DELETE')memoryEntries.delete(key); }
 else if(path==='/V1/suggestions') body={suggestions:[{icon:'travel_explore',title:'Explore an idea',description:'Research a topic and turn what you find into clear insights.'},{icon:'code',title:'Build something',description:'Work through a coding problem, one step at a time.'},{icon:'lightbulb',title:'Make a plan',description:'Bring structure to your next project or big decision.'}]};
 else if(path==='/V1/conversations/stream') return route.fulfill({status:200,contentType:'text/event-stream',body:': heartbeat\n\n'});
 else if(path.startsWith('/V1/conversations/') && req.method()==='PUT') { const data=req.postDataJSON();const id=path.split('/').at(-1);const old=conversations.find(c=>c.session_id===id);if(old)Object.assign(old,data);else conversations.push({session_id:id,persona:data.persona,model:data.model,title:data.turns[0]?.text || 'New conversation',turns:data.turns,updated_at:new Date().toISOString()}); }
 else if(path==='/V1/conversations') body={items:[...conversations,...conversations],total:conversations.length,has_more:false};
 else if(!path.includes('test-session') && path.endsWith('/messages')) body={items:conversations.find(item=>item.session_id===path.split('/')[3])?.turns || [],total:0,has_more:false};
 else if(path.endsWith('/messages')) body={items:[{id:'u1',kind:'user',text:'Help me plan a research project.'},{id:'a1',kind:'agent',text:'## A clear starting point\n\nStart with a focused question, then gather reliable sources.\n\n- Define the goal\n- Compare the evidence\n- Write a concise summary\n\n```python\nprint("Hello, Cortex")\n```',status:'done'}],total:2,has_more:false};
 else if(path==='/V1/attachments' && req.method()==='POST') {
  const name=req.postDataBuffer().toString().match(/filename="([^"]+)"/)?.[1] || 'notes.txt';
  body={id:'attachment-'+(++uploadCounter),name,size:30,mime:name.endsWith('.png')?'image/png':'text/plain',kind:name.endsWith('.png')?'image':'file'};uploaded.set(body.id,body);
 }
 else if(path.startsWith('/V1/attachments/') && path.endsWith('/content')) {
  const attachment=uploaded.get(path.split('/')[3]);return route.fulfill({status:200,contentType:attachment?.mime || 'text/plain',body:attachment?.kind==='image'?image:'Fixture file content'});
 }
 else if(path==='/V1/chat') {
  chatRequests.push(req.postDataJSON());
  const message=req.postDataJSON();
  if(message.message==='truncated-stream') return route.fulfill({status:200,contentType:'text/event-stream',body:'event: session\ndata: {"session_id":"new-session"}\n\nevent: token\ndata: {"content":"Partial response"}\n\n'});
  if(message.message==='trigger-limit' && message.model==='gemini-3.5-flash') return route.fulfill({status:200,contentType:'text/event-stream',body:'event: session\ndata: {"session_id":"new-session"}\n\nevent: token\ndata: {"content":"Partial thinking"}\n\nevent: done\ndata: '+JSON.stringify({status:'error',answer:null,sources:[],confidence:'low',provider_issue:{code:'provider_limit',message:'You’ve reached this provider’s limit. Switch models or try again later.',model:message.model}})+'\n\n'});
  return route.fulfill({status:200,contentType:'text/event-stream',body:'event: session\ndata: {"session_id":"new-session"}\n\nevent: token\ndata: {"content":"Here is a thoughtful response."}\n\nevent: done\ndata: {"status":"done","answer":"Here is a thoughtful response.","sources":[],"confidence":"high"}\n\n'});
 }
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
try{
 await page.goto('http://127.0.0.1:4179/login');await page.getByText('Welcome back.').waitFor();await noOverflow();await page.screenshot({path:root+'/cortex-login.png'});
 await page.evaluate(()=>{localStorage.setItem('cortex.authToken','ui-test-fixture');sessionStorage.setItem('cortex.secretWorld','retired-token');sessionStorage.setItem('cortex.companionModel','retired-model')});
 await page.goto('http://127.0.0.1:4179/chat');await page.getByText('Where should we begin?').waitFor();await noOverflow();await page.screenshot({path:root+'/cortex-desktop.png'});
 await page.getByRole('link',{name:'Planning a research project',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Planning a research project',exact:true}).count(),1);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('cortex.secretWorld')),null);assert.equal(await page.evaluate(()=>sessionStorage.getItem('cortex.companionModel')),null);
 for(const phrase of ['Open the secret world of roleplay','Open the secret world of releplay']){await page.getByLabel('Search conversations').fill(phrase);assert.equal(await page.getByLabel('Search conversations').inputValue(),phrase);assert.equal(await page.getByRole('dialog').count(),0)}await page.getByLabel('Search conversations').fill('');
 for(const path of ['/secret-world','/secret-world/retired-character']){await page.goto('http://127.0.0.1:4179'+path);await page.waitForURL('**/chat');await page.getByText('Where should we begin?').waitFor();assert.equal(await page.getByRole('dialog').count(),0)}
 assert(!await page.getByRole('button',{name:'Send message',exact:true}).isEnabled());
 await page.getByLabel('Message Cortex',{exact:true}).fill('First line');await page.getByLabel('Message Cortex',{exact:true}).press('Shift+Enter');assert((await page.getByLabel('Message Cortex',{exact:true}).inputValue()).includes('\n'));assert.equal(chatRequests.length,0);
 await page.getByRole('button',{name:'Choose model'}).click();await page.getByRole('button',{name:'nvidia/nemotron-3-super-120b-a12b',exact:true}).click();assert(await page.getByRole('button',{name:'Choose model'}).innerText().then(s=>s.includes('nvidia/nemotron-3-super-120b-a12b')));
 await page.getByRole('button',{name:'Choose persona'}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Choose persona'}).getAttribute('aria-expanded'),'false');
 await page.getByLabel('Search conversations').fill('no match');await page.getByText('No matching conversations').waitFor();await page.getByLabel('Search conversations').fill('');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByText('Your workspace, your way.').waitFor();await page.getByRole('button',{name:'Dark',exact:true}).click();assert(await page.evaluate(()=>document.documentElement.classList.contains('dark')));await page.reload();await page.getByText('Your workspace, your way.').waitFor();assert(await page.evaluate(()=>document.documentElement.classList.contains('dark')));await page.screenshot({path:root+'/cortex-settings-dark.png'});await page.getByRole('button',{name:'Light',exact:true}).click();
 await page.getByRole('button',{name:'New Persona'}).click();await page.getByRole('dialog',{name:'Create persona'}).waitFor();await page.getByLabel('IDENTITY',{exact:true}).fill('Analyst');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Edit Research partner',exact:true}).click();await page.getByRole('dialog',{name:'Edit persona'}).waitFor();
 assert.equal(await page.getByLabel('SYSTEM PROMPT (BEHAVIOR RULES)').inputValue(),'Help with research.');
 await page.getByLabel('SYSTEM PROMPT (BEHAVIOR RULES)').fill('Provide concise research with sources.');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.getByRole('dialog',{name:'Edit persona'}).waitFor({state:'hidden'});assert.equal(personaPrompts.get('Research partner'),'Provide concise research with sources.');
 await page.getByRole('button',{name:'Edit Research partner',exact:true}).click();await page.getByRole('dialog',{name:'Edit persona'}).waitFor();await page.waitForFunction(()=>document.querySelector('#persona-prompt').value==='Provide concise research with sources.');await page.keyboard.press('Escape');
 await page.getByLabel('Memory key',{exact:true}).fill('language');await page.getByLabel('Memory value',{exact:true}).fill('Hindi');await page.getByRole('button',{name:'Add memory',exact:true}).click();await page.getByRole('button',{name:'Edit memory language',exact:true}).waitFor();
 await page.getByRole('button',{name:'Edit memory language',exact:true}).click();await page.getByLabel('Memory value',{exact:true}).fill('English and Hindi');await page.getByRole('button',{name:'Save memory',exact:true}).click();await page.getByText('English and Hindi',{exact:true}).waitFor();assert.equal(memoryEntries.get('language'),'English and Hindi');
 await page.getByRole('button',{name:'Clear shared memory',exact:true}).click();await page.getByRole('dialog',{name:'Clear shared memory?'}).waitFor();await page.getByRole('button',{name:'Clear memory',exact:true}).click();await page.getByText('No saved details yet.',{exact:true}).waitFor();assert.equal(memoryEntries.size,0);
 assert.equal(await page.getByRole('button',{name:'Documents',exact:true}).count(),0);
 await page.goto('http://127.0.0.1:4179/chat/test-session');await page.getByText('A clear starting point').waitFor();await noOverflow();await page.screenshot({path:root+'/cortex-conversation.png'});
 await page.getByRole('button',{name:'Choose persona'}).click();await page.getByRole('button',{name:'Edit current persona',exact:true}).click();await page.getByRole('dialog',{name:'Edit persona'}).waitFor();await page.keyboard.press('Escape');
 await page.getByRole('link',{name:/New conversation/}).click();await page.getByText('Where should we begin?').waitFor();await page.getByLabel('Message Cortex',{exact:true}).fill('Help me research');await page.getByLabel('Message Cortex',{exact:true}).press('Enter');await page.getByText('Here is a thoughtful response.').waitFor();assert.equal(chatRequests.at(-1).message,'Help me research');
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Stop generating"]'));
 // Files are sent as attachment IDs, retained in history, and preserved on retries.
 await page.getByLabel('Choose attachments',{exact:true}).setInputFiles([{name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('Sample notes')},{name:'image.png',mimeType:'image/png',buffer:image}]);
 await page.getByLabel('Message Cortex',{exact:true}).fill('Summarize these attachments');
 await page.getByRole('button',{name:'Send message',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Send message"]').disabled);
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Download notes.txt"]').length>0);
 assert.equal(chatRequests.at(-1).attachment_ids.length,2);
 await page.getByRole('button',{name:'Download notes.txt'}).waitFor();await page.getByRole('button',{name:'Download image.png'}).waitFor();
 await page.getByRole('button',{name:'Choose model'}).click();await page.getByRole('button',{name:'gemini-3.5-flash',exact:true}).click();
 await page.getByLabel('Message Cortex',{exact:true}).fill('trigger-limit');await page.getByLabel('Message Cortex',{exact:true}).press('Enter');
 await page.getByRole('alert').filter({hasText:'Limit reached'}).waitFor();assert.equal(chatRequests.at(-1).model,'gemini-3.5-flash');
 await page.getByRole('button',{name:'Choose model'}).click();await page.getByRole('button',{name:'nvidia/nemotron-3-super-120b-a12b',exact:true}).click();
 const beforeRetry=chatRequests.length;await page.getByRole('button',{name:'Try again',exact:true}).last().click();
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Stop generating"]'));
 assert.equal(chatRequests.length,beforeRetry+1);assert.equal(chatRequests.at(-1).retry,true);assert.equal(chatRequests.at(-1).model,'nvidia/nemotron-3-super-120b-a12b');
 assert.equal(await page.getByRole('button',{name:'Download notes.txt'}).count(),1);
 await page.getByLabel('Message Cortex',{exact:true}).fill('truncated-stream');await page.getByLabel('Message Cortex',{exact:true}).press('Enter');
 await page.getByText('The connection ended before the response finished. Try again or switch models.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Stop generating'}).count(),0);
 await page.reload();await page.getByRole('button',{name:'Download notes.txt'}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4179/chat');await page.getByText('Where should we begin?').waitFor();await noOverflow();await page.screenshot({path:root+'/cortex-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('dialog',{name:'Navigation'}).waitFor();await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'Navigation'}).count(),0);
 await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('dialog',{name:'Navigation'}).getByRole('link',{name:/New conversation/}).click();assert.equal(await page.getByRole('dialog',{name:'Navigation'}).count(),0);
 await page.setViewportSize({width:320,height:640});await noOverflow();await page.getByLabel('Message Cortex',{exact:true}).fill('Small screen test');assert(await page.getByRole('button',{name:'Send message',exact:true}).isVisible());
 await page.goto('http://127.0.0.1:4179/login');await page.evaluate(()=>localStorage.removeItem('cortex.authToken'));await page.reload();await page.getByText('Welcome back.').waitFor();await noOverflow();
 assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile layouts, login, composer, streamed response, pickers, search, theme persistence, dialogs, persona edits, shared memory controls, attachments, ongoing model switching, provider limits, interrupted streams, conversation rendering; no runtime errors.');
}catch(e){ console.log('DEBUG',JSON.stringify(chatRequests),errors,await page.locator('body').innerText());await page.screenshot({path:root+'/cortex-check-failure.png'});throw e;}finally{await browser.close();server.kill()}
