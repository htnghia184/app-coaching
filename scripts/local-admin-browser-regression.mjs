// Dependency-free Chrome DevTools smoke test of authenticated unpublished drafts.
// Runs only against the disposable Supabase Local stack and Vite dev server.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';

assert.equal(process.env.LOCAL_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.ok(process.env.LOCAL_SUPABASE_ANON_KEY && process.env.LOCAL_PILOT_PASSWORD);
assert.match(execFileSync('docker', ['port', 'supabase_db_codex-coaching', '5432/tcp'], { encoding: 'utf8' }), /:54322\b/);
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
assert.ok(fs.existsSync(chromePath));
const port = 29227;
const browser = spawn(chromePath, ['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${port}`,'--user-data-dir=D:/codex-coaching/.tmp/chrome-admin-regression','about:blank'], { stdio: 'ignore' });
try {
  let targets;
  for (let i=0;i<50;i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; }
    catch { await delay(100); }
  }
  assert.ok(targets);
  const target = targets.find(item => item.type === 'page');
  assert.ok(target?.webSocketDebuggerUrl);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject) => { ws.onopen=resolve; ws.onerror=reject; });
  let sequence=0;
  const pending = new Map();
  ws.onmessage = event => { const message=JSON.parse(event.data); const entry=pending.get(message.id); if (entry) { pending.delete(message.id); message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result); } };
  const send = (method,params={}) => new Promise((resolve,reject) => { const id=++sequence; pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); });
  const evaluate = async expression => {
    const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Page.navigate',{url:'http://127.0.0.1:5174/local-private-drafts'});
  for (let i=0;i<50;i++) { if (await evaluate("document.readyState === 'complete' && !!document.querySelector('#root')")) break; await delay(100); }
  const auth = await evaluate(`(async () => { const {supabase}=await import('/src/lib/supabaseClient.ts'); const result=await supabase.auth.signInWithPassword({email:'local-pilot-admin@example.invalid',password:${JSON.stringify(process.env.LOCAL_PILOT_PASSWORD)}}); return result.error?.message ?? 'ok'; })()`);
  assert.equal(auth,'ok');
  await send('Page.navigate',{url:'http://127.0.0.1:5174/local-private-drafts'});
  let count=0;
  for (let i=0;i<50;i++) { count=await evaluate("document.querySelectorAll('select option').length-1"); if (count===4) break; await delay(100); }
  assert.equal(count,4,'authenticated admin sees four unpublished drafts');
  for (const [moduleKey,index] of [['ielts-speaking-m02',2],['ielts-speaking-m03',0],['ielts-speaking-m04',0]]) {
    await evaluate(`(() => { const select=document.querySelector('select'); select.value=${JSON.stringify(moduleKey)}; select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    for (let i=0;i<30;i++) { if (await evaluate(`document.querySelectorAll('button').length>${index}`)) break; await delay(100); }
    await evaluate(`([...document.querySelectorAll('button')].filter(b=>b.textContent?.includes('Load private media'))[${index}]).click()`);
    let host='';
    for (let i=0;i<50;i++) { host=await evaluate("document.querySelector('iframe') ? new URL(document.querySelector('iframe').src).hostname : ''"); if (host) break; await delay(100); }
    assert.equal(host,'www.youtube-nocookie.com',`${moduleKey} authorized private video`);
  }
  for (const [email, expected] of [['local-pilot-student@example.invalid','Your next action'],['local-pilot-coach@example.invalid','Coach assignment and assessment']]) {
    const result = await evaluate(`(async () => { const {supabase}=await import('/src/lib/supabaseClient.ts'); await supabase.auth.signOut(); const response=await supabase.auth.signInWithPassword({email:${JSON.stringify(email)},password:${JSON.stringify(process.env.LOCAL_PILOT_PASSWORD)}}); return response.error?.message ?? 'ok'; })()`);
    assert.equal(result,'ok');
    await send('Page.navigate',{url:'http://127.0.0.1:5174/local-pilot'});
    let visible=false;
    for (let i=0;i<50;i++) { visible=await evaluate(`document.body.innerText.includes(${JSON.stringify(expected)})`); if (visible) break; await delay(100); }
    assert.ok(visible,`${email} authenticated workspace`);
    if (email.includes('student')) {
      await send('Page.navigate',{url:'http://127.0.0.1:5174/local-private-drafts'});
      for (let i=0;i<30;i++) { visible=await evaluate("document.body.innerText.includes('Local admin preview only.')"); if (visible) break; await delay(100); }
      assert.ok(visible,'student cannot view unpublished admin preview');
    }
  }
  ws.close();
  console.log('PASS authenticated Chrome: admin drafts and three videos, student and coach workspace, student draft denial');
} finally { browser.kill(); }
