const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
function fixture() {
  const handlers = new Map(), files = new Map();
  const electron = { app:{getPath:()=>'/profile'}, ipcMain:{handle:(k,v)=>handlers.set(k,v)} };
  const mockfs = {readFileSync:()=>{throw Error('absent')},mkdirSync(){},writeFileSync:(p,s)=>files.set(p,s),renameSync:(a,b)=>files.set(b,files.get(a))};
  const context = {module:{exports:{}},process:{platform:'win32'},URL,queueMicrotask,require:n=>n==='electron'?electron:n==='node:fs'?mockfs:require(n)};
  vm.runInNewContext(fs.readFileSync(__dirname+'/pin-main.cjs','utf8'),context);
  const win = new EventEmitter();
  win.webContents = new EventEmitter();
  Object.assign(win.webContents,{id:1,mainFrame:{url:'app://-/index.html'},isDestroyed:()=>false,send(){}});
  let pinned=false;
  Object.assign(win,{isDestroyed:()=>false,isAlwaysOnTop:()=>pinned,setAlwaysOnTop:v=>{pinned=v;win.emit('always-on-top-changed')}});
  context.module.exports.attach(win);
  const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
  return {win,event,files,get:()=>handlers.get('jasen-chatgpt-pin:get')(event),toggle:e=>handlers.get('jasen-chatgpt-pin:toggle')(e||event)};
}
test('toggle native topmost and save choice',()=>{
 const f=fixture(); assert.equal(f.get().pinned,false); assert.equal(f.toggle().pinned,true);
 assert.equal(JSON.parse(f.files.get(require('node:path').join('/profile','chatgpt-pin.json'))).pinned,true);
 assert.equal(f.toggle().pinned,false);
});
test('reject subframes, unknown windows and remote documents',()=>{
 const f=fixture();
 assert.equal(f.toggle({...f.event,senderFrame:{url:'app://-/index.html'}}).supported,false);
 assert.equal(f.toggle({sender:{id:99},senderFrame:{}}).supported,false);
 f.event.senderFrame.url='https://example.com/index.html';assert.equal(f.toggle().supported,false);
 f.event.senderFrame.url='app://-/detached-window.html';assert.equal(f.toggle().supported,false);
 assert.equal(f.win.isAlwaysOnTop(),false);
});
test('preserve pin during host focus reset, allow explicit unpin',async()=>{
 const f=fixture();f.toggle();f.win.setAlwaysOnTop(false);await new Promise(queueMicrotask);
 assert.equal(f.win.isAlwaysOnTop(),true);f.toggle();await new Promise(queueMicrotask);
 assert.equal(f.win.isAlwaysOnTop(),false);
});
