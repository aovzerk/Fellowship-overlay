const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { parseCombatLog } = require('./services/parser');
const { getSkillCatalog } = require('./services/skill-catalog');
const { getAppIconPath, getTrayIcon } = require('./utils/icons');
const { fromProjectRoot } = require('./utils/project-paths');

let win = null;
let currentFilePath = null;
let currentWatcher = null;
let reparseTimer = null;
let clickThroughEnabled = true;
let tray = null;
let isQuitting = false;

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_LANGUAGE = 'ru';

const I18N = {
  en: {
    trayTooltip: 'Fellowship Overlay',
    trayHide: 'Hide overlay',
    trayShow: 'Show overlay',
    traySettings: 'Settings',
    trayExit: 'Exit',
    watchFileUnavailable: 'File is unavailable',
    watchActive: 'Watching active',
    logFiles: 'Log files',
    allFiles: 'All files',
  },
  ru: {
    trayTooltip: 'Fellowship Overlay',
    trayHide: 'Скрыть оверлей',
    trayShow: 'Показать оверлей',
    traySettings: 'Настройки',
    trayExit: 'Выход',
    watchFileUnavailable: 'Файл недоступен',
    watchActive: 'Слежение активно',
    logFiles: 'Логи',
    allFiles: 'Все файлы',
  },
};

function normalizeLanguage(value) {
  return String(value || '').toLowerCase() === 'en' ? 'en' : 'ru';
}

function t(key) {
  const lang = getCurrentLanguage();
  return I18N[lang]?.[key] || I18N[DEFAULT_LANGUAGE]?.[key] || key;
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return {
      language: normalizeLanguage(parsed.language),
    };
  } catch {
    return { language: DEFAULT_LANGUAGE };
  }
}

function saveSettings(nextSettings) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(nextSettings, null, 2), 'utf8');
  } catch {
    // Ignore write errors; UI can still work for the current session.
  }
}

let settings = loadSettings();

function getCurrentLanguage() {
  return normalizeLanguage(settings.language);
}

function setCurrentLanguage(language) {
  settings = { ...settings, language: normalizeLanguage(language) };
  saveSettings(settings);
  if (tray) tray.setToolTip(t('trayTooltip'));
  return getCurrentLanguage();
}

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function hideToTray() {
  if (!win) return;
  win.hide();
}


function openSettingsWindow() {
  if (!win) return;
  showWindow();
  win.webContents.send('open-settings', {
    filePath: currentFilePath,
    watching: !!currentWatcher,
    locked: !clickThroughEnabled,
    language: getCurrentLanguage(),
  });
}

function createTray() {
  if (tray) return tray;

  tray = new Tray(getTrayIcon());
  tray.setToolTip(t('trayTooltip'));

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: win?.isVisible() ? t('trayHide') : t('trayShow'),
      click: () => {
        if (!win) return;
        if (win.isVisible()) hideToTray();
        else showWindow();
      },
    },
    {
      label: t('traySettings'),
      click: () => openSettingsWindow(),
    },
    { type: 'separator' },
    { label: t('trayExit'), click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.on('click', () => {
    if (!win) return;
    if (win.isVisible()) hideToTray();
    else showWindow();
  });

  tray.on('right-click', () => {
    tray.popUpContextMenu(buildMenu());
  });

  return tray;
}

async function parseAndSend(filePath) {
  if (!win || !filePath) return;

  try {
    const data = await parseCombatLog(filePath);
    win.webContents.send('log-data', {
      ok: true,
      filePath,
      data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    win.webContents.send('log-data', {
      ok: false,
      filePath,
      error: error?.stack || error?.message || String(error),
    });
  }
}

function stopWatching() {
  if (reparseTimer) {
    clearTimeout(reparseTimer);
    reparseTimer = null;
  }
  if (currentWatcher) {
    currentWatcher.close();
    currentWatcher = null;
  }
}


function scheduleParse(filePath, delay = 120) {
  clearTimeout(reparseTimer);
  reparseTimer = setTimeout(() => {
    parseAndSend(filePath);
  }, delay);
}

function startWatching(filePath) {
  stopWatching();

  try {
    currentWatcher = fs.watch(filePath, { persistent: true }, (eventType) => {
      if (eventType === 'rename' && !fs.existsSync(filePath)) {
        win?.webContents.send('watch-status', {
          ok: false,
          message: t('watchFileUnavailable'),
        });
        return;
      }
      scheduleParse(filePath, 100);
    });

    win?.webContents.send('watch-status', {
      ok: true,
      message: t('watchActive'),
    });
  } catch (error) {
    win?.webContents.send('watch-status', {
      ok: false,
      message: error?.message || String(error),
    });
  }
}

function setClickThrough(enabled) {
  clickThroughEnabled = !!enabled;

  if (!win) return;

  win.setIgnoreMouseEvents(clickThroughEnabled, { forward: true });
  win.webContents.send('overlay-mode', {
    clickThrough: clickThroughEnabled,
    locked: !clickThroughEnabled,
  });
}


async function chooseFile() {
  if (!win) return { canceled: true };

  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: t('logFiles'), extensions: ['txt', 'log'] },
      { name: t('allFiles'), extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  currentFilePath = result.filePaths[0];
  await parseAndSend(currentFilePath);
  startWatching(currentFilePath);
  return { canceled: false, filePath: currentFilePath };
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const appIcon = getAppIconPath();

  win = new BrowserWindow({
    width,
    height,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: false,
    icon: appIcon || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(fromProjectRoot('src', 'renderer', 'index.html'));

  win.webContents.once('did-finish-load', () => {
    win?.webContents.send('language-changed', { language: getCurrentLanguage() });
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideToTray();
    }
  });

  createTray();
  setClickThrough(true);
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('F8', () => {
    setClickThrough(!clickThroughEnabled);
  });

  globalShortcut.register('F9', () => {
    chooseFile();
  });

  ipcMain.handle('pick-log-file', async () => chooseFile());
  ipcMain.handle('reload-current-file', async () => {
    if (currentFilePath) await parseAndSend(currentFilePath);
    return { ok: !!currentFilePath };
  });
  ipcMain.handle('toggle-overlay-lock', async () => {
    setClickThrough(!clickThroughEnabled);
    return { locked: !clickThroughEnabled };
  });
  ipcMain.handle('get-current-file', async () => ({ filePath: currentFilePath }));
  ipcMain.handle('get-skill-catalog', async () => getSkillCatalog());
  ipcMain.handle('get-language', async () => ({ language: getCurrentLanguage() }));
  ipcMain.handle('set-language', async (_, language) => {
    const nextLanguage = setCurrentLanguage(language);
    win?.webContents.send('language-changed', { language: nextLanguage });
    if (currentFilePath && fs.existsSync(currentFilePath)) {
      win?.webContents.send('watch-status', { ok: true, message: t('watchActive') });
    }
    return { language: nextLanguage };
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopWatching();
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showWindow();
  }
});
