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
let parseInFlight = false;
let pendingParseFilePath = null;

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_LANGUAGE = 'ru';
const DEFAULT_PULL_PANEL_POSITION = { x: 16, y: 12 };
const DEFAULT_RECENT_SKILLS_PANEL_POSITION = { x: 16, y: 200 };
const DEFAULT_VISIBILITY_SETTINGS = { showParty: true, showPull: true, showRecentSkills: true };
const DEFAULT_RECENT_SKILLS_LIMIT = 7;
const CARD_SCALE_MIN = 0.75;
const CARD_SCALE_MAX = 1.8;
const DEFAULT_CARD_SCALE = 1;

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function t(key) {
  const lang = getCurrentLanguage();
  return I18N[lang]?.[key] || I18N[DEFAULT_LANGUAGE]?.[key] || key;
}

function normalizePosition(value, fallback) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { x: fallback.x, y: fallback.y };
  }
  return { x: Math.round(x), y: Math.round(y) };
}

function normalizePlayerPositions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  Object.entries(value).forEach(([key, position]) => {
    const x = Number(position?.x);
    const y = Number(position?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    normalized[String(key)] = { x: Math.round(x), y: Math.round(y) };
  });
  return normalized;
}

function normalizePanelPositions(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    pullInfo: normalizePosition(source.pullInfo, DEFAULT_PULL_PANEL_POSITION),
    recentSkills: normalizePosition(source.recentSkills, DEFAULT_RECENT_SKILLS_PANEL_POSITION),
  };
}

function normalizeVisibilitySettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    showParty: source.showParty !== false,
    showPull: source.showPull !== false,
    showRecentSkills: source.showRecentSkills !== false,
  };
}

function normalizeRecentSkillsLimit(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return DEFAULT_RECENT_SKILLS_LIMIT;
  return Math.round(clamp(normalized, 1, 20));
}

function normalizeSkillSelections(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  Object.entries(value).forEach(([classId, abilityIds]) => {
    const parsedClassId = String(Number(classId));
    if (!parsedClassId || parsedClassId === 'NaN') return;
    normalized[parsedClassId] = (Array.isArray(abilityIds) ? abilityIds : [])
      .map((id) => String(Number(id)))
      .filter((id) => id && id !== 'NaN');
  });
  return normalized;
}

function normalizeCardScale(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return DEFAULT_CARD_SCALE;
  return Math.round(clamp(normalized, CARD_SCALE_MIN, CARD_SCALE_MAX) * 100) / 100;
}

function normalizeCurrentFilePath(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    language: normalizeLanguage(source.language),
    currentFilePath: normalizeCurrentFilePath(source.currentFilePath),
    playerPositions: normalizePlayerPositions(source.playerPositions),
    panelPositions: normalizePanelPositions(source.panelPositions),
    visibilitySettings: normalizeVisibilitySettings(source.visibilitySettings),
    recentSkillsLimit: normalizeRecentSkillsLimit(source.recentSkillsLimit),
    selectedSkillsByClass: normalizeSkillSelections(source.selectedSkillsByClass),
    cardScale: normalizeCardScale(source.cardScale),
  };
}

function mergeSettings(baseSettings, partialSettings) {
  const base = normalizeSettings(baseSettings);
  const partial = partialSettings && typeof partialSettings === 'object' && !Array.isArray(partialSettings) ? partialSettings : {};

  return normalizeSettings({
    ...base,
    ...partial,
    panelPositions: {
      ...base.panelPositions,
      ...(partial.panelPositions && typeof partial.panelPositions === 'object' ? partial.panelPositions : {}),
    },
    visibilitySettings: {
      ...base.visibilitySettings,
      ...(partial.visibilitySettings && typeof partial.visibilitySettings === 'object' ? partial.visibilitySettings : {}),
    },
    playerPositions: partial.playerPositions === undefined ? base.playerPositions : partial.playerPositions,
    selectedSkillsByClass: partial.selectedSkillsByClass === undefined ? base.selectedSkillsByClass : partial.selectedSkillsByClass,
  });
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return normalizeSettings(JSON.parse(raw || '{}'));
  } catch {
    return normalizeSettings({});
  }
}

function saveSettings(nextSettings) {
  try {
    const normalized = normalizeSettings(nextSettings);
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  } catch {
    // Ignore write errors; UI can still work for the current session.
  }
}

let settings = loadSettings();

function getCurrentLanguage() {
  return normalizeLanguage(settings.language);
}

function setCurrentLanguage(language) {
  settings = mergeSettings(settings, { language: normalizeLanguage(language) });
  saveSettings(settings);
  if (tray) tray.setToolTip(t('trayTooltip'));
  return getCurrentLanguage();
}

function getPlayerPositions() {
  return normalizePlayerPositions(settings.playerPositions);
}

function setPlayerPositions(playerPositions) {
  settings = mergeSettings(settings, { playerPositions });
  saveSettings(settings);
  return getPlayerPositions();
}

function getOverlaySettings() {
  return normalizeSettings(settings);
}

function saveOverlaySettings(partialSettings) {
  settings = mergeSettings(settings, partialSettings);
  saveSettings(settings);
  currentFilePath = settings.currentFilePath || null;
  return getOverlaySettings();
}

function setCurrentFilePath(filePath) {
  const normalized = normalizeCurrentFilePath(filePath);
  currentFilePath = normalized;
  settings = mergeSettings(settings, { currentFilePath: normalized });
  saveSettings(settings);
  return currentFilePath;
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

async function runParseOnce(filePath) {
  try {
    const data = await parseCombatLog(filePath);
    win?.webContents.send('log-data', {
      ok: true,
      filePath,
      data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    win?.webContents.send('log-data', {
      ok: false,
      filePath,
      error: error?.stack || error?.message || String(error),
    });
  }
}

async function parseAndSend(filePath) {
  if (!win || !filePath) return;

  pendingParseFilePath = filePath;
  if (parseInFlight) return;

  parseInFlight = true;
  try {
    while (pendingParseFilePath) {
      const nextFilePath = pendingParseFilePath;
      pendingParseFilePath = null;
      await runParseOnce(nextFilePath);
    }
  } finally {
    parseInFlight = false;
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

  setCurrentFilePath(result.filePaths[0]);
  await parseAndSend(currentFilePath);
  startWatching(currentFilePath);
  return { canceled: false, filePath: currentFilePath };
}

async function restoreLastLogFileIfAvailable() {
  const savedFilePath = normalizeCurrentFilePath(settings.currentFilePath);
  if (!savedFilePath) return;

  if (!fs.existsSync(savedFilePath)) {
    setCurrentFilePath(null);
    win?.webContents.send('watch-status', {
      ok: false,
      message: t('watchFileUnavailable'),
    });
    return;
  }

  currentFilePath = savedFilePath;
  await parseAndSend(currentFilePath);
  startWatching(currentFilePath);
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
    restoreLastLogFileIfAvailable();
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
  ipcMain.on('get-player-positions-sync', (event) => {
    event.returnValue = { playerPositions: getPlayerPositions() };
  });
  ipcMain.handle('save-player-positions', async (_, playerPositions) => ({
    ok: true,
    playerPositions: setPlayerPositions(playerPositions),
  }));
  ipcMain.on('get-overlay-settings-sync', (event) => {
    event.returnValue = { settings: getOverlaySettings() };
  });
  ipcMain.handle('save-overlay-settings', async (_, partialSettings) => ({
    ok: true,
    settings: saveOverlaySettings(partialSettings),
  }));
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
