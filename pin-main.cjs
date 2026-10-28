'use strict';

// This module runs inside the application's main process.
const { app, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const windows = new Map();
const QUERY = 'jasen-chatgpt-pin:get';
const TOGGLE = 'jasen-chatgpt-pin:toggle';
const STATE = 'jasen-chatgpt-pin:state';
let initialized = false;
let saved = false;

function settingsPath() {
  return path.join(app.getPath('userData'), 'chatgpt-pin.json');
}

function trusted(record, event) {
  if (!record || record.window.isDestroyed()) return false;
  const contents = record.window.webContents;
  if (contents.isDestroyed() || event.sender !== contents || event.senderFrame !== contents.mainFrame) return false;
  try {
    const url = new URL(event.senderFrame.url);
    return url.protocol === 'app:' && url.hostname === '-' && url.pathname === '/index.html' &&
      !url.username && !url.password && !url.port;
  } catch { return false; }
}

function state(record) {
  return { supported: true, pinned: record.window.isAlwaysOnTop() };
}

function publish(record) {
  if (record.window.isDestroyed() || record.window.webContents.isDestroyed()) return;
  record.window.webContents.send(STATE, state(record));
}

function persist(value) {
  saved = value;
  try {
    const target = settingsPath();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target + '.tmp', JSON.stringify({ pinned: value }) + '\n', { mode: 0o600 });
    fs.renameSync(target + '.tmp', target);
  } catch { /* A read-only profile must not prevent toggling the window. */ }
}

function initialize() {
  if (initialized) return;
  initialized = true;
  try { saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')).pinned === true; } catch {}
  ipcMain.handle(QUERY, event => {
    const record = windows.get(event.sender.id);
    return trusted(record, event) ? state(record) : { supported: false };
  });
  ipcMain.handle(TOGGLE, event => {
    const record = windows.get(event.sender.id);
    if (!trusted(record, event)) return { supported: false };
    const next = !record.window.isAlwaysOnTop();
    record.wanted = next;
    record.window.setAlwaysOnTop(next);
    const actual = record.window.isAlwaysOnTop();
    record.wanted = actual;
    persist(actual);
    publish(record);
    return state(record);
  });
}

function attach(window) {
  if (process.platform !== 'win32' || window.isDestroyed() || windows.has(window.webContents.id)) return;
  initialize();
  const record = { window, wanted: saved };
  const id = window.webContents.id;
  windows.set(id, record);
  if (saved) window.setAlwaysOnTop(true);
  window.on('always-on-top-changed', () => {
    // The host briefly resets topmost while focusing a window on Windows.
    // Preserve an explicit pin until the user clicks the button again.
    if (record.wanted && !window.isDestroyed() && !window.isAlwaysOnTop()) {
      queueMicrotask(() => {
        if (record.wanted && !window.isDestroyed() && !window.isAlwaysOnTop()) window.setAlwaysOnTop(true);
        publish(record);
      });
    } else publish(record);
  });
  window.webContents.on('did-finish-load', () => publish(record));
  window.once('closed', () => windows.delete(id));
}

module.exports = { attach };
