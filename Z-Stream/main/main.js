const { app, ipcMain, nativeImage, session, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const Logger = require('./utils/logger');
const StorageService = require('./services/storage');
const WindowManager = require('./core/window-manager');
const IPCHandlers = require('./ipc/handlers');
const DiscordRPCService = require('./services/discord-rpc');
const WARPProxyService = require('./services/warp-proxy');
const AutoUpdaterService = require('./services/auto-updater');

const logger = new Logger({ level: 'info' });

// Determine root directory
const ROOT = app.isPackaged
  ? path.join(process.resourcesPath)
  : path.join(__dirname, '..', '..');

// Icon path - use PNG (electron-builder converts it)
let iconPath = path.join(ROOT, 'logo.png');
if (!fs.existsSync(iconPath)) {
  iconPath = path.join(ROOT, 'assets', 'logo.png');
}
if (!fs.existsSync(iconPath)) {
  iconPath = path.join(__dirname, '../assets/logo.png');
}

const appIcon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null;

try {
  const pkg = require('../../package.json');
  app.setAppUserModelId((pkg.build && pkg.build.appId) || pkg.name || 'com.zstream.desktop');
} catch {
  app.setAppUserModelId('com.zstream.desktop');
}

let storage;
let windowManager;
let ipcHandlers;
let discordRPC;
let warpProxy;
let autoUpdater;

if (app.isReady()) {
  initialize();
} else {
  app.whenReady().then(initialize);
}

async function initialize() {
  try {
    logger.info('Initializing application');

    storage = new StorageService({ logger });
    
    if (storage.get('hardwareAcceleration', true) === false) {
      app.disableHardwareAcceleration();
    }

    windowManager = new WindowManager({
      store: storage,
      logger,
      appIcon
    });

    ipcHandlers = new IPCHandlers({
      services: {},
      logger,
      ipcMain
    });
    ipcHandlers.register();
    ipcHandlers.setupInterceptors(session.defaultSession, {
      getStreamHostname: () => {
        try {
          const url = storage.get('streamUrl', 'zstream.mov');
          return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        } catch {
          return null;
        }
      }
    });

    discordRPC = new DiscordRPCService({ store: storage, logger });
    await discordRPC.initialize().catch(err => {
      logger.warn('Discord RPC initialization failed', { error: err.message });
    });

    warpProxy = new WARPProxyService({
      logger,
      dataDir: path.join(app.getPath('userData'), 'warp')
    });

    autoUpdater = new AutoUpdaterService({
      logger,
      currentVersion: app.getVersion()
    });

    registerAppIPCHandlers();

    const streamUrl = storage.get('streamUrl');
    if (!streamUrl) {
      const setupWindow = windowManager.createSetupWindow();
      ipcMain.once('set-url', (e, url) => {
        let u = url.trim();
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        storage.set('streamUrl', u);
        setupWindow.close();
        const mainWin = windowManager.createMainWindow(u);
        discordRPC.setTitlebarWebContents(windowManager.getTitlebarContents());
      });
    } else {
      const url = streamUrl.startsWith('http') ? streamUrl : `https://${streamUrl}`;
      windowManager.createMainWindow(url);
      discordRPC.setTitlebarWebContents(windowManager.getTitlebarContents());
    }

    const isConsoleMode = storage.get('consoleMode', false);
    if (isConsoleMode) {
      const win = windowManager.getMainWindow();
      if (win) win.setFullScreen(true);
    }

    if (storage.get('warpLaunchEnabled', false)) {
      warpProxy.enable().catch(err => {
        logger.warn('Failed to enable WARP on launch', { error: err.message });
      });
    }

    // Register global shortcut for settings (Ctrl+, or Cmd+,)
    globalShortcut.register('CommandOrControl+,', () => {
      if (windowManager) {
        windowManager.createSettingsWindow();
      }
    });

    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application', error);
    app.quit();
  }
}

function registerAppIPCHandlers() {
  ipcMain.on('minimize-window', () => {
    const win = windowManager.getMainWindow();
    if (win) win.minimize();
  });

  ipcMain.on('maximize-window', () => {
    const win = windowManager.getMainWindow();
    if (win) {
      win.isMaximized() ? win.unmaximize() : win.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    const win = windowManager.getMainWindow();
    if (win) win.close();
  });

  ipcMain.on('open-settings', () => {
    windowManager.createSettingsWindow();
  });

  ipcMain.on('close-settings', () => {
    const win = windowManager.getSettingsWindow();
    if (win && !win.isDestroyed()) win.close();
  });

  ipcMain.on('reset-url', () => {
    storage.delete('streamUrl');
    app.relaunch();
    app.exit();
  });

  ipcMain.handle('save-domain', (e, domain) => {
    let u = domain.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    storage.set('streamUrl', u);
    app.relaunch();
    app.exit();
  });

  ipcMain.handle('get-stream-url', () => storage.get('streamUrl', ''));
  ipcMain.handle('set-stream-url', (e, url) => {
    storage.set('streamUrl', url);
    return { success: true };
  });

  ipcMain.handle('get-version', () => app.getVersion());

  ipcMain.handle('reset-app', () => {
    storage.clear();
    app.relaunch();
    app.exit();
  });

  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.handle('check-for-updates', async () => {
    try {
      return await autoUpdater.getUpdateInfo();
    } catch (error) {
      return { updateAvailable: false, currentVersion: app.getVersion(), error: error.message };
    }
  });

  ipcMain.handle('install-update', () => {
    return { updateInstalling: false, error: 'Manual update required' };
  });

  ipcMain.handle('open-releases-page', () => {
    require('electron').shell.openExternal('https://github.com/xp-technologies-dev/z-stream/releases');
  });

  ipcMain.handle('get-discord-rpc', () => storage.get('discordRPCEnabled', true));
  ipcMain.handle('set-discord-rpc', async (e, val) => {
    await discordRPC.setEnabled(val);
    return { success: true };
  });

  ipcMain.handle('updateMediaMetadata', async (e, data) => {
    return await discordRPC.handleMediaMetadataUpdate(data);
  });

  ipcMain.handle('set-warp', async (e, val) => {
    try {
      if (val) {
        await warpProxy.enable();
      } else {
        warpProxy.disable();
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-warp-status', () => warpProxy.getStatus());
  ipcMain.handle('set-warp-launch', (e, val) => {
    storage.set('warpLaunchEnabled', val);
    return { success: true };
  });
  ipcMain.handle('get-warp-launch', () => storage.get('warpLaunchEnabled', false));

  ipcMain.handle('set-hw-accel', (e, val) => {
    storage.set('hardwareAcceleration', val);
    app.relaunch();
    return { success: true };
  });
  ipcMain.handle('get-hw-accel', () => storage.get('hardwareAcceleration', true));

  ipcMain.handle('set-console-mode', (e, val) => {
    storage.set('consoleMode', val);
    const win = windowManager.getMainWindow();
    if (win) {
      win.setFullScreen(val);
    }
    const siteContents = windowManager.getSiteContents();
    if (siteContents) {
      siteContents.send('console-mode-changed', val);
    }
    return { success: true, value: val };
  });
  ipcMain.handle('get-console-mode', () => storage.get('consoleMode', false));

  ipcMain.handle('set-volume-boost', (e, val) => {
    storage.set('volumeBoost', val);
    const siteContents = windowManager.getSiteContents();
    if (siteContents && !siteContents.isDestroyed()) {
      applyVolumeBoost(siteContents, val);
    }
    return { success: true, value: val };
  });
  ipcMain.handle('get-volume-boost', () => storage.get('volumeBoost', 1));

  ipcMain.handle('get-cursor-sensitivity', () => storage.get('cursorSensitivity', 45));
  ipcMain.handle('set-cursor-sensitivity', (e, val) => {
    storage.set('cursorSensitivity', val);
    const siteContents = windowManager.getSiteContents();
    if (siteContents && !siteContents.isDestroyed()) {
      siteContents.send('cursor-sensitivity-changed', val);
    }
    return { success: true, value: val };
  });

  ipcMain.handle('uninstall-app', () => {
    return { success: false, error: 'Manual uninstall required' };
  });

  ipcMain.handle('start-download', (e, data) => {
    logger.info('Download requested', { data });
  });

  ipcMain.handle('open-offline', () => {});

  ipcMain.on('simulate-key', (event, keyStr) => {
    if (event.sender) {
      event.sender.sendInputEvent({ type: 'keyDown', keyCode: keyStr });
      event.sender.sendInputEvent({ type: 'keyUp', keyCode: keyStr });
    }
  });

  ipcMain.on('simulate-mouse-move', (event, {x, y}) => {
    if (event.sender) {
      event.sender.sendInputEvent({ type: 'mouseMove', x, y });
    }
  });

  ipcMain.on('simulate-mouse-click', (event, {x, y}) => {
    if (event.sender) {
      event.sender.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      event.sender.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    }
  });

  ipcMain.on('controller-log', (event, msg) => {
    console.log(`[Controller] ${msg}`);
  });
}

function applyVolumeBoost(webContents, val) {
  if (!webContents || webContents.isDestroyed()) return;
  webContents.executeJavaScript(`
    (function() {
      if (!window.__zstreamAudioCtx) {
        try {
          window.__zstreamAudioCtx = new AudioContext();
          window.__zstreamGain = window.__zstreamAudioCtx.createGain();
          window.__zstreamGain.connect(window.__zstreamAudioCtx.destination);
          const _orig = document.createElement.bind(document);
          document.createElement = function(tag) {
            const el = _orig(tag);
            if (tag === 'audio' || tag === 'video') {
              setTimeout(() => {
                try {
                  if (!el.__zstreamHooked) {
                    el.__zstreamHooked = true;
                    const src = window.__zstreamAudioCtx.createMediaElementSource(el);
                    src.connect(window.__zstreamGain);
                  }
                } catch {}
              }, 200);
            }
            return el;
          };
          document.querySelectorAll('audio,video').forEach(el => {
            try {
              if (!el.__zstreamHooked) {
                el.__zstreamHooked = true;
                const src = window.__zstreamAudioCtx.createMediaElementSource(el);
                src.connect(window.__zstreamGain);
              }
            } catch {}
          });
        } catch(e) { console.warn('[ZSTREAM] Audio boost init:', e); }
      }
      if (window.__zstreamGain) {
        window.__zstreamGain.gain.setTargetAtTime(${val}, window.__zstreamAudioCtx.currentTime, 0.01);
      }
    })();
  `).catch(() => {});
}

app.on('window-all-closed', async () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
  
  if (discordRPC) {
    await discordRPC.disconnect().catch(() => {});
  }
  if (warpProxy) {
    warpProxy.cleanup();
  }
  if (windowManager) {
    windowManager.cleanup();
  }
  app.quit();
});

module.exports = { logger, storage, windowManager, discordRPC, warpProxy, autoUpdater };
