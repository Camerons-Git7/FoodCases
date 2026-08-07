const { contextBridge, ipcRenderer } = require('electron');

// Valid IPC channels for message relay
const VALID_CHANNELS = ['updateMediaMetadata', 'hello', 'openPage', 'prepareStream', 'makeRequest'];

// Message relay system for web app communication
window.addEventListener('message', async (event) => {
  // Security check: only accept messages from the same window
  if (event.source !== window) return;

  const data = event.data;

  // Check for valid channel and prevent relay loops
  if (!data || !data.name || data.relayed) return;

  console.log('[Preload] postMessage received:', data.name);

  if (VALID_CHANNELS.includes(data.name)) {
    try {
      // Forward to Main Process
      const response = await ipcRenderer.invoke(data.name, data.body);

      // updateMediaMetadata is one-way, no reply needed
      if (data.name !== 'updateMediaMetadata') {
        window.postMessage(
          {
            name: data.name,
            relayId: data.relayId,
            instanceId: data.instanceId,
            body: response,
            relayed: true,
          },
          '*',
        );
      }
    } catch (error) {
      console.error(`[Preload] Error handling ${data.name}:`, error);
      if (data.name !== 'updateMediaMetadata') {
        window.postMessage(
          {
            name: data.name,
            relayId: data.relayId,
            instanceId: data.instanceId,
            body: { success: false, error: error.message },
            relayed: true,
          },
          '*',
        );
      }
    }
  }
});

contextBridge.exposeInMainWorld('__ZSTREAM_DESKTOP__', true);
contextBridge.exposeInMainWorld('__MW_DESKTOP__', true);
contextBridge.exposeInMainWorld('__SUDO_DESKTOP__', true);

contextBridge.exposeInMainWorld('electronAPI', {
  openSettings: () => ipcRenderer.send('open-settings'),
  setUrl: (url) => ipcRenderer.send('set-url', url),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  resetUrl: () => ipcRenderer.send('reset-url'),
  onTitleUpdate: (callback) => ipcRenderer.on('update-title', (_e, title) => callback(title)),
});

contextBridge.exposeInMainWorld('ZSTREAMSETUP', {
  saveDomain: (domain) => ipcRenderer.invoke('save-domain', domain),
});

contextBridge.exposeInMainWorld('desktopApi', {
  startDownload: (data) => ipcRenderer.invoke('start-download', data),
  openOffline: () => ipcRenderer.invoke('open-offline'),
});

contextBridge.exposeInMainWorld('settings', {
  getStreamUrl: () => ipcRenderer.invoke('get-stream-url'),
  setStreamUrl: (url) => ipcRenderer.invoke('set-stream-url', url),
  getVersion: () => ipcRenderer.invoke('get-version'),
  resetApp: () => ipcRenderer.invoke('reset-app'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openReleasesPage: () => ipcRenderer.invoke('open-releases-page'),
  setDiscordRPCEnabled: (val) => ipcRenderer.invoke('set-discord-rpc', val),
  getDiscordRPCEnabled: () => ipcRenderer.invoke('get-discord-rpc'),
  setWarpEnabled: (val) => ipcRenderer.invoke('set-warp', val),
  setWarpLaunchEnabled: (val) => ipcRenderer.invoke('set-warp-launch', val),
  getWarpLaunchEnabled: () => ipcRenderer.invoke('get-warp-launch'),
  getWarpStatus: () => ipcRenderer.invoke('get-warp-status'),
  setHardwareAcceleration: (val) => ipcRenderer.invoke('set-hw-accel', val),
  getHardwareAcceleration: () => ipcRenderer.invoke('get-hw-accel'),
  setConsoleMode: (val) => ipcRenderer.invoke('set-console-mode', val),
  getConsoleMode: () => ipcRenderer.invoke('get-console-mode'),
  setVolumeBoost: (val) => ipcRenderer.invoke('set-volume-boost', val),
  getVolumeBoost: () => ipcRenderer.invoke('get-volume-boost'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  uninstallApp: () => ipcRenderer.invoke('uninstall-app'),
  closeSettings: () => ipcRenderer.invoke('close-settings'),
  getCursorSensitivity: () => ipcRenderer.invoke('get-cursor-sensitivity'),
  setCursorSensitivity: (val) => ipcRenderer.invoke('set-cursor-sensitivity', val),
  onProgress: (cb) => ipcRenderer.on('update-progress', (_e, data) => cb(data)),
});

// Expose updateMediaMetadata for Discord RPC
contextBridge.exposeInMainWorld('updateMediaMetadata', (data) => {
  return ipcRenderer.invoke('updateMediaMetadata', data);
});

// Inject postMessage hook before page scripts run
function injectEarlyScript() {
  const script = document.createElement('script');
  script.textContent = `
    Object.defineProperty(window, '__activeExtension', {
      value: true, writable: false, configurable: false
    });
    const _origPostMessage = window.postMessage.bind(window);
    window.postMessage = function(data, ...args) {
      _origPostMessage(data, ...args);
      // Only auto-reply to hello/handshake messages, never to updateMediaMetadata
      if (data && data.name !== 'updateMediaMetadata' &&
          (data.relayId || data.name === 'hello' || JSON.stringify(data)?.includes('hello'))) {
        setTimeout(() => {
          _origPostMessage({
            relayId: data.relayId,
            name: data.name,
            body: { success: true, allowed: true, hasPermission: true, version: '2.0.0' }
          }, '*');
        }, 50);
      }
    };
  `;
  (document.head || document.documentElement)?.appendChild(script);
  script.remove();
}

// Inject Z-Stream userscript for additional sources
function injectUserscript() {
  const script = document.createElement('script');
  script.src = 'https://raw.githubusercontent.com/xp-technologies-dev/userscript/main/z-stream.user.js';
  (document.head || document.documentElement)?.appendChild(script);
}

// Site injection for native app detection
function patchSite() {
  document.querySelectorAll('*').forEach(el => {
    if (el.children.length === 0 && el.textContent?.trim() === 'Native app') {
      const row = el.closest('li, [class*="item"], [class*="row"], div') || el.parentElement;
      if (!row) return;
      const indicator = row.querySelector('[class*="circle"], [class*="status"], [class*="dot"], svg');
      if (indicator) {
        indicator.style.cssText += 'color:#4ade80!important;fill:#4ade80!important;stroke:#4ade80!important;';
        const wrap = indicator.parentElement;
        if (wrap) wrap.style.cssText += 'color:#4ade80!important;';
      }
      const banner = document.querySelector('[class*="setup"][class*="card"], [class*="warning"], [class*="banner"]');
      if (banner && banner.textContent?.includes("haven't gone through setup")) {
        banner.style.display = 'none';
      }
    }
  });
}

// Gamepad Controller Support
let consoleLegend = null;

function updateConsoleModeLegend(isConsole) {
  if (isConsole) {
    if (!consoleLegend) {
      consoleLegend = document.createElement('div');
      consoleLegend.id = 'zstream-console-legend';
      consoleLegend.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 999999;
        display: flex; gap: 15px; background: rgba(0,0,0,0.85);
        padding: 12px 24px; border-radius: 12px; backdrop-filter: blur(10px);
        font-family: 'Inter', sans-serif; font-size: 14px; color: white; font-weight: 600;
        pointer-events: none; border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      `;
      consoleLegend.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="background:#4ade80;color:black;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">A</div> Select
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="background:#ef4444;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">B</div> Back
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="background:#3b82f6;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">X</div> Play/Pause
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="background:#facc15;color:black;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">Y</div> Fullscreen
        </div>
      `;
      document.body.appendChild(consoleLegend);
    }
    consoleLegend.style.display = 'flex';
  } else {
    if (consoleLegend) consoleLegend.style.display = 'none';
  }
}

ipcRenderer.on('console-mode-changed', (_e, val) => {
  updateConsoleModeLegend(val);
});

function initGamepadController() {
  let gamepadState = {};
  let lastAxisState = { active: false, lastFire: 0, isFirst: true, wasScrolling: false };
  let virtualCursor = null;
  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight / 2;
  let lastCursorSentX = -1;
  let lastCursorSentY = -1;
  let cursorSensitivity = 45;

  ipcRenderer.invoke('get-cursor-sensitivity').then(val => { cursorSensitivity = val; });
  ipcRenderer.on('cursor-sensitivity-changed', (_e, val) => { cursorSensitivity = val; });
  let lastGyroMode = false;

  function focusNearestVisibleElement() {
    const focusable = Array.from(document.querySelectorAll('a, button, input, [tabindex], [role="button"], [role="menuitem"], [role="link"]')).filter(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (rect.width === 0 || rect.height === 0 || style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none') return false;
      return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0 && rect.right <= window.innerWidth;
    });

    if (focusable.length > 0) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      focusable.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        const distA = Math.pow(rectA.x + rectA.width/2 - centerX, 2) + Math.pow(rectA.y + rectA.height/2 - centerY, 2);
        const distB = Math.pow(rectB.x + rectB.width/2 - centerX, 2) + Math.pow(rectB.y + rectB.height/2 - centerY, 2);
        return distA - distB;
      });
      
      const target = focusable[0];
      target.focus({ preventScroll: true });
      
      // Move OS mouse to the element to trigger hover/active states for SPAs
      const rect = target.getBoundingClientRect();
      ipcRenderer.send('simulate-mouse-move', { 
        x: Math.round(rect.x + rect.width / 2), 
        y: Math.round(rect.y + rect.height / 2) 
      });
    }
  }

  function updateVirtualCursor(dx, dy) {
    if (!virtualCursor) {
      virtualCursor = document.createElement('div');
      virtualCursor.id = 'zstream-virtual-cursor';
      virtualCursor.style.cssText = `
        position: fixed;
        width: 16px;
        height: 16px;
        background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(74,222,128,1) 100%);
        border: 2px solid white;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999999;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        display: none;
      `;
      document.body.appendChild(virtualCursor);
    }
    
    cursorX += dx * cursorSensitivity;
    cursorY += dy * cursorSensitivity;
    
    cursorX = Math.max(0, Math.min(window.innerWidth, cursorX));
    cursorY = Math.max(0, Math.min(window.innerHeight, cursorY));
    
    let roundedX = Math.round(cursorX);
    let roundedY = Math.round(cursorY);
    
    virtualCursor.style.left = `${roundedX}px`;
    virtualCursor.style.top = `${roundedY}px`;
    virtualCursor.style.display = 'block';
    
    if (dx !== 0 || dy !== 0) {
      if (roundedX !== lastCursorSentX || roundedY !== lastCursorSentY) {
        ipcRenderer.send('simulate-mouse-move', { x: roundedX, y: roundedY });
        lastCursorSentX = roundedX;
        lastCursorSentY = roundedY;
      }
    }
  }

  function hideVirtualCursor() {
    if (virtualCursor) {
      virtualCursor.style.display = 'none';
    }
  }

  function clickVirtualCursor() {
    if (virtualCursor && virtualCursor.style.display !== 'none') {
      ipcRenderer.send('simulate-mouse-click', { x: Math.round(cursorX), y: Math.round(cursorY) });
    }
  }
  
  const KEY_MAPPING = {
    0: 'Enter', // A
    1: 'Escape', // B
    2: 'Space', // X - Play/Pause
    3: 'F', // Y - Fullscreen
    12: 'Up', // D-pad Up
    13: 'Down', // D-pad Down
    14: 'Left', // D-pad Left
    15: 'Right', // D-pad Right
  };

  function checkGamepad() {
    requestAnimationFrame(checkGamepad);

    try {
      if (!document.hasFocus()) return;

      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(gamepads).find(g => g !== null);
      if (!gp) return;

      const now = Date.now();

      const isCursorMode = virtualCursor && virtualCursor.style.display !== 'none';

      // Check Buttons
      gp.buttons.forEach((button, index) => {
        const isPressed = typeof button === 'object' ? button.pressed : button === 1.0;
        if (isPressed) {
          if (!gamepadState[index]) {
            gamepadState[index] = { pressed: true, lastFire: now, isFirst: true };
            ipcRenderer.send('controller-log', `Button ${index} pressed`);
            if (isCursorMode && index === 0) {
              clickVirtualCursor();
            } else if (KEY_MAPPING[index]) {
              if (index >= 12 && index <= 15) hideVirtualCursor();
              if (!isCursorMode || index !== 0) {
                ipcRenderer.send('simulate-key', KEY_MAPPING[index]);
              }
            }
          } else {
            // Key repeat for D-pad (12-15)
            if (index >= 12 && index <= 15 && KEY_MAPPING[index]) {
              const state = gamepadState[index];
              const delay = state.isFirst ? 400 : 100;
              if (now - state.lastFire > delay) {
                hideVirtualCursor();
                ipcRenderer.send('simulate-key', KEY_MAPPING[index]);
                state.lastFire = now;
                state.isFirst = false;
              }
            }
          }
        } else if (!isPressed && gamepadState[index]) {
          ipcRenderer.send('controller-log', `Button ${index} released`);
          gamepadState[index] = false;
        }
      });

      // Check HAT switch for Navigation
      let hatX = 0;
      let hatY = 0;
      if (gp.axes[9] !== undefined && gp.axes[9] !== 0) {
        const hat = gp.axes[9];
        if (hat === -1 || hat === -0.7142857313156128 || hat === 0.7142857313156128) hatY = -1; // Up
        if (hat === 0.1428571492433548 || hat === 0.4285714626312256 || hat === 1) hatY = 1; // Down
        if (hat === 0.7142857313156128 || hat === 1 || hat === -1) hatX = -1; // Left
        if (hat === -0.42857140294142857 || hat === -0.1428571492433548 || hat === 0.1428571492433548) hatX = 1; // Right
      }

      const navThreshold = 0.5;
      if (Math.abs(hatX) > navThreshold || Math.abs(hatY) > navThreshold) {
        hideVirtualCursor();
        const delay = lastAxisState.isFirst ? 400 : 100;
        if (!lastAxisState.active || now - lastAxisState.lastFire > delay) {
          if (hatX > navThreshold) ipcRenderer.send('simulate-key', KEY_MAPPING[15]);
          else if (hatX < -navThreshold) ipcRenderer.send('simulate-key', KEY_MAPPING[14]);
          
          if (hatY > navThreshold) ipcRenderer.send('simulate-key', KEY_MAPPING[13]);
          else if (hatY < -navThreshold) ipcRenderer.send('simulate-key', KEY_MAPPING[12]);
          
          lastAxisState.isFirst = !lastAxisState.active;
          lastAxisState.active = true;
          lastAxisState.lastFire = now;
        }
      } else {
        lastAxisState.active = false;
        lastAxisState.isFirst = true;
      }

      // Check Left Joystick for Scrolling
      const scrollDeadzone = 0.15;
      let lx = Math.abs(gp.axes[0]) > scrollDeadzone ? gp.axes[0] : 0;
      let ly = Math.abs(gp.axes[1]) > scrollDeadzone ? gp.axes[1] : 0;
      
      if (lx !== 0 || ly !== 0) {
        hideVirtualCursor();
        const speedX = Math.sign(lx) * Math.pow(Math.abs(lx), 2) * 40;
        const speedY = Math.sign(ly) * Math.pow(Math.abs(ly), 2) * 40;
        
        let scrollXRemaining = speedX;
        let scrollYRemaining = speedY;
        
        if (document.activeElement && document.activeElement !== document.body) {
          let parent = document.activeElement.parentElement;
          while (parent && parent !== document.documentElement && parent !== document.body) {
            if (scrollXRemaining === 0 && scrollYRemaining === 0) break;
            
            const style = window.getComputedStyle(parent);
            const canScrollY = (style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight;
            const canScrollX = (style.overflowX === 'auto' || style.overflowX === 'scroll') && parent.scrollWidth > parent.clientWidth;
            
            if (canScrollX && Math.abs(scrollXRemaining) > 0) {
              parent.scrollBy({ left: scrollXRemaining, behavior: 'auto' });
              scrollXRemaining = 0;
            }
            
            if (canScrollY && Math.abs(scrollYRemaining) > 0) {
              parent.scrollBy({ top: scrollYRemaining, behavior: 'auto' });
              scrollYRemaining = 0;
            }
            
            parent = parent.parentElement;
          }
        }
        
        if (Math.abs(scrollXRemaining) > 0 || Math.abs(scrollYRemaining) > 0) {
          window.scrollBy({ left: scrollXRemaining, top: scrollYRemaining, behavior: 'auto' });
        }
        lastAxisState.wasScrolling = true;
      } else {
        if (lastAxisState.wasScrolling) {
          focusNearestVisibleElement();
          lastAxisState.wasScrolling = false;
        }
      }

      // Check Axes for Cursor Control (Right Joystick)
      const cursorDeadzone = 0.15;
      let rx = Math.abs(gp.axes[2]) > cursorDeadzone ? gp.axes[2] : (gp.axes[3] === undefined && gp.axes[5] !== undefined ? gp.axes[5] : 0);
      let ry = Math.abs(gp.axes[3]) > cursorDeadzone ? gp.axes[3] : 0;
      
      if (rx !== 0 || ry !== 0) {
        // Apply easing curve for smoother aiming and less jitter on small movements
        let smoothRx = Math.sign(rx) * Math.pow(Math.abs(rx), 2);
        let smoothRy = Math.sign(ry) * Math.pow(Math.abs(ry), 2);
        updateVirtualCursor(smoothRx, smoothRy);
      }
    } catch (error) {
      ipcRenderer.send('controller-log', 'CRASH IN GAMEPAD LOOP: ' + error.stack);
    }
  }

  window.addEventListener("gamepadconnected", (e) => {
    console.log("[Z-Stream] Gamepad connected:", e.gamepad.id);
  });

  // Keep focused items centered on screen so spatial navigation feels like a native TV app
  document.addEventListener('focusin', (e) => {
    if (e.target && typeof e.target.scrollIntoView === 'function') {
      // Small timeout ensures SPA has finished rendering/updating before we scroll it
      setTimeout(() => {
        try {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch (err) {}
      }, 50);
    }
  });

  requestAnimationFrame(checkGamepad);
}

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  injectEarlyScript();
  injectUserscript();
  initGamepadController();
  
  if (window.location.protocol.startsWith('http')) {
    ipcRenderer.invoke('get-console-mode').then(val => updateConsoleModeLegend(val));
  }

  const observer = new MutationObserver(patchSite);
  observer.observe(document.body, { childList: true, subtree: true });
  patchSite();

  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, a, li, [role="button"], [role="menuitem"]');
    if (!el) return;
    const text = el.textContent?.trim().replace(/\s+/g, ' ');
    if (text === 'App Settings' || (text?.includes('App Settings') && text.length < 30)) {
      e.preventDefault();
      e.stopPropagation();
      ipcRenderer.send('open-settings');
    } else if (text === 'Offline Downloads' || text?.includes('Offline Downloads')) {
      e.preventDefault();
      e.stopPropagation();
      ipcRenderer.invoke('open-offline');
    }
  }, true);
});

// Extension detection flags
contextBridge.exposeInMainWorld('__EXTENSION_ACTIVE__', true);
contextBridge.exposeInMainWorld('__ZSTREAM_EXTENSION__', true);
contextBridge.exposeInMainWorld('__ZSTREAM_EXTENSION_CACHED__', true);

contextBridge.exposeInMainWorld('__zstreamExtension', {
  isActive: () => true,
  sendMessage: () => Promise.resolve({ success: true }),
});

window.addEventListener('DOMContentLoaded', () => {
  window.__EXTENSION_ACTIVE__ = true;

  window.addEventListener('zstream-extension-ping', () => {
    window.dispatchEvent(new CustomEvent('zstream-extension-pong', {
      detail: { active: true }
    }));
  });

  window.addEventListener('message', (e) => {
    if (e.data?.type === 'ZSTREAM_EXTENSION_CHECK' || e.data?.type === 'MW_EXTENSION_CHECK') {
      window.postMessage({ type: 'ZSTREAM_EXTENSION_RESPONSE', active: true }, '*');
    }
  });
});

console.log('Z-Stream Desktop Preload Loaded');
