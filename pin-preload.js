;(() => {
  'use strict';
  if (process.platform !== 'win32' || window.top !== window) return;
  const { ipcRenderer } = require('electron');
  const QUERY = 'jasen-chatgpt-pin:get';
  const TOGGLE = 'jasen-chatgpt-pin:toggle';
  const STATE = 'jasen-chatgpt-pin:state';
  let button;
  let busy = false;
  let observer;

  function render(state) {
    if (!button || !state || state.supported !== true) return;
    button.setAttribute('aria-pressed', String(state.pinned === true));
    button.setAttribute('aria-label', state.pinned ? '取消置顶' : '置顶');
    button.title = state.pinned ? '取消置顶' : '置顶';
  }

  async function mount() {
    let state;
    try { state = await ipcRenderer.invoke(QUERY); } catch { return; }
    if (!state || state.supported !== true || !document.body) return;
    if (document.getElementById('jasen-chatgpt-pin')) return;
    const host = document.createElement('div');
    host.id = 'jasen-chatgpt-pin';
    host.style.cssText = 'position:fixed;top:4px;right:148px;width:28px;height:28px;z-index:2147483646;-webkit-app-region:no-drag;';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ':host{color:var(--text-primary,var(--app-color-text,#6b6b6b))}button{all:unset;box-sizing:border-box;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;-webkit-app-region:no-drag;color:inherit}button:hover{background:rgba(128,128,128,.18)}button:focus-visible{outline:2px solid #3b82f6;outline-offset:1px}svg{width:16px;height:16px;pointer-events:none}button[aria-pressed="true"] svg{transform:rotate(-35deg)}button[aria-pressed="true"] .pin-head{fill:currentColor}@media(prefers-color-scheme:dark){:host{color:var(--text-primary,var(--app-color-text,#d7d7d7))}}';
    button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="pin-head" d="M9 3h6v6l3 4v2H6v-2l3-4Z"/><path d="M8 3h8M12 15v6"/></svg>';
    button.addEventListener('click', async event => {
      if (!event.isTrusted || busy) return;
      busy = true;
      try { render(await ipcRenderer.invoke(TOGGLE)); } catch {} finally { busy = false; }
    });
    root.append(style, button);
    document.body.append(host);
    render(state);
    const position = () => {
      const overlay = navigator.windowControlsOverlay;
      if (overlay && overlay.visible) {
        const rect = overlay.getTitlebarAreaRect();
        host.style.right = Math.max(4, window.innerWidth - rect.right + 8) + 'px';
        host.style.top = Math.max(2, rect.y + (rect.height - 28) / 2) + 'px';
      } else { host.style.right = '148px'; host.style.top = '4px'; }
      host.style.display = document.fullscreenElement ? 'none' : '';
    };
    position();
    window.addEventListener('resize', position);
    document.addEventListener('fullscreenchange', position);
    navigator.windowControlsOverlay?.addEventListener('geometrychange', position);
    observer = new MutationObserver(() => { if (!host.isConnected && document.body) document.body.append(host); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  ipcRenderer.on(STATE, (_event, state) => render(state));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
