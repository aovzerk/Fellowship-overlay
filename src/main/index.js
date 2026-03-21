const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { parseCombatLog } = require('./services/parser');
const { getSkillCatalog } = require('./services/skill-catalog');
const { getAppIconPath, getTrayIcon } = require('./utils/icons');
const { fromProjectRoot } = require('./utils/project-paths');

let win = null;
let currentFilePath = null;
let currentDirectoryPath = null;
let currentFileWatcher = null;
let currentDirectoryWatcher = null;
let reparseTimer = null;
let directoryRescanTimer = null;
let clickThroughEnabled = true;
let tray = null;
let isQuitting = false;
let parseInFlight = false;
let pendingParseFilePath = null;

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_PULL_PANEL_POSITION = { x: 16, y: 12 };
const DEFAULT_RECENT_SKILLS_PANEL_POSITION = { x: 16, y: 200 };
const DEFAULT_RECENT_SKILLS_LIMIT = 7;
const CARD_SCALE_MIN = 0.75;
const CARD_SCALE_MAX = 1.8;
const DEFAULT_CARD_SCALE = 1;
const LOG_FILE_EXTENSIONS = new Set(['.txt', '.log']);

const I18N = {
  en: {
    trayTooltip: 'Fellowship Overlay',
    trayHide: 'Hide overlay',
    trayShow: 'Show overlay',
    traySettings: 'Settings',
    trayExit: 'Exit',
    watchFileUnavailable: 'Selected log file is unavailable',
    watchFolderUnavailable: 'Selected folder is unavailable',
    watchFolderActive: 'Watching folder for the newest log file',
    noLogFiles: 'No .log or .txt files found in the selected folder',
    logFolder: 'Log folder',
  },
  ru: {
    trayTooltip: 'Fellowship Overlay',
    trayHide: 'Скрыть оверлей',
    trayShow: 'Показать оверлей',
    traySettings: 'Настройки',
    trayExit: 'Выход',
    watchFileUnavailable: 'Текущий лог-файл недоступен',
    watchFolderUnavailable: 'Выбранная папка недоступна',
    watchFolderActive: 'Слежение за папкой и последним логом активно',
    noLogFiles: 'В выбранной папке не найдено файлов .log или .txt',
    logFolder: 'Папка с логами',
  },
};

function normalizeLanguage(value) {
  return String(value || '').toLowerCase() === 'ru' ? 'ru' : 'en';
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

function normalizeStoredPath(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeCurrentFilePath(value) {
  return normalizeStoredPath(value);
}

function normalizeDirectoryPath(value) {
  return normalizeStoredPath(value);
}

function normalizeSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const legacyCurrentFilePath = normalizeCurrentFilePath(source.currentFilePath);
  const logDirectoryPath = normalizeDirectoryPath(source.logDirectoryPath)
    || (legacyCurrentFilePath ? path.dirname(legacyCurrentFilePath) : null);

  return {
    language: normalizeLanguage(source.language),
    logDirectoryPath,
    currentFilePath: legacyCurrentFilePath,
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
  } catch {}
}

let settings = loadSettings();
currentDirectoryPath = settings.logDirectoryPath || null;
currentFilePath = settings.currentFilePath || null;

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
  currentDirectoryPath = settings.logDirectoryPath || null;
  return getOverlaySettings();
}

function setCurrentFilePath(filePath) {
  const normalized = normalizeCurrentFilePath(filePath);
  currentFilePath = normalized;
  settings = mergeSettings(settings, { currentFilePath: normalized });
  saveSettings(settings);
  return currentFilePath;
}

function setCurrentDirectoryPath(directoryPath) {
  const normalized = normalizeDirectoryPath(directoryPath);
  currentDirectoryPath = normalized;
  settings = mergeSettings(settings, { logDirectoryPath: normalized });
  saveSettings(settings);
  return currentDirectoryPath;
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
    directoryPath: currentDirectoryPath,
    watching: !!(currentDirectoryWatcher || currentFileWatcher),
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

function isSupportedLogFile(filePath) {
  if (!filePath) return false;

  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return false;
    return LOG_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
  } catch {
    return false;
  }
}

function getFileCreatedAt(stats) {
  const birthtimeMs = Number(stats?.birthtimeMs || 0);
  if (Number.isFinite(birthtimeMs) && birthtimeMs > 0) return birthtimeMs;
  const ctimeMs = Number(stats?.ctimeMs || 0);
  const mtimeMs = Number(stats?.mtimeMs || 0);
  return Math.max(ctimeMs, mtimeMs, 0);
}

function findLatestLogFile(directoryPath) {
  const normalizedDirectoryPath = normalizeDirectoryPath(directoryPath);
  if (!normalizedDirectoryPath || !fs.existsSync(normalizedDirectoryPath)) return null;

  const candidates = [];
  const entries = fs.readdirSync(normalizedDirectoryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry?.isFile?.()) continue;

    const filePath = path.join(normalizedDirectoryPath, entry.name);
    if (!isSupportedLogFile(filePath)) continue;

    try {
      const stats = fs.statSync(filePath);
      candidates.push({
        filePath,
        createdAt: getFileCreatedAt(stats),
        modifiedAt: Number(stats.mtimeMs || 0),
      });
    } catch {}
  }

  if (!candidates.length) return null;

  candidates.sort((left, right) => {
    if (right.createdAt !== left.createdAt) return right.createdAt - left.createdAt;
    if (right.modifiedAt !== left.modifiedAt) return right.modifiedAt - left.modifiedAt;
    return right.filePath.localeCompare(left.filePath);
  });

  return candidates[0].filePath;
}

function sendWatchStatus(ok, message) {
  win?.webContents.send('watch-status', { ok: !!ok, message });
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

function stopFileWatcher() {
  if (reparseTimer) {
    clearTimeout(reparseTimer);
    reparseTimer = null;
  }
  if (currentFileWatcher) {
    currentFileWatcher.close();
    currentFileWatcher = null;
  }
}

function stopDirectoryWatcher() {
  if (directoryRescanTimer) {
    clearTimeout(directoryRescanTimer);
    directoryRescanTimer = null;
  }
  if (currentDirectoryWatcher) {
    currentDirectoryWatcher.close();
    currentDirectoryWatcher = null;
  }
}

function stopWatching() {
  stopFileWatcher();
  stopDirectoryWatcher();
}

function scheduleParse(filePath, delay = 120) {
  clearTimeout(reparseTimer);
  reparseTimer = setTimeout(() => {
    parseAndSend(filePath);
  }, delay);
}

function scheduleDirectoryRescan(delay = 200) {
  clearTimeout(directoryRescanTimer);
  directoryRescanTimer = setTimeout(() => {
    syncLatestFileFromDirectory();
  }, delay);
}

function startFileWatcher(filePath) {
  stopFileWatcher();
  if (!filePath) return;

  try {
    currentFileWatcher = fs.watch(filePath, { persistent: true }, (eventType) => {
      if (eventType === 'rename' && !fs.existsSync(filePath)) {
        stopFileWatcher();
        sendWatchStatus(false, t('watchFileUnavailable'));
        scheduleDirectoryRescan(100);
        return;
      }
      scheduleParse(filePath, 100);
    });
  } catch (error) {
    sendWatchStatus(false, error?.message || String(error));
  }
}

function startDirectoryWatcher(directoryPath) {
  stopDirectoryWatcher();
  if (!directoryPath) return;

  try {
    currentDirectoryWatcher = fs.watch(directoryPath, { persistent: true }, () => {
      scheduleDirectoryRescan(150);
    });
    sendWatchStatus(true, t('watchFolderActive'));
  } catch (error) {
    sendWatchStatus(false, error?.message || String(error));
  }
}

async function syncLatestFileFromDirectory(options = {}) {
  const normalizedDirectoryPath = normalizeDirectoryPath(options.directoryPath || currentDirectoryPath);
  if (!normalizedDirectoryPath) return { ok: false, filePath: null, directoryPath: null };

  if (!fs.existsSync(normalizedDirectoryPath)) {
    stopWatching();
    setCurrentFilePath(null);
    setCurrentDirectoryPath(null);
    sendWatchStatus(false, t('watchFolderUnavailable'));
    return { ok: false, filePath: null, directoryPath: null };
  }

  const latestFilePath = findLatestLogFile(normalizedDirectoryPath);
  if (!latestFilePath) {
    stopFileWatcher();
    setCurrentFilePath(null);
    sendWatchStatus(false, t('noLogFiles'));
    return { ok: false, filePath: null, directoryPath: normalizedDirectoryPath };
  }

  const shouldSwitchFile = latestFilePath !== currentFilePath || !currentFileWatcher;
  if (shouldSwitchFile) {
    setCurrentFilePath(latestFilePath);
    startFileWatcher(latestFilePath);
  }

  if (shouldSwitchFile || options.forceParse) {
    await parseAndSend(latestFilePath);
  }

  sendWatchStatus(true, t('watchFolderActive'));
  return { ok: true, filePath: latestFilePath, directoryPath: normalizedDirectoryPath };
}

async function activateLogDirectory(directoryPath, options = {}) {
  const normalizedDirectoryPath = normalizeDirectoryPath(directoryPath);
  if (!normalizedDirectoryPath) return { ok: false, filePath: null, directoryPath: null };

  setCurrentDirectoryPath(normalizedDirectoryPath);
  startDirectoryWatcher(normalizedDirectoryPath);
  return syncLatestFileFromDirectory({
    directoryPath: normalizedDirectoryPath,
    forceParse: options.forceParse !== false,
  });
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

async function chooseLogDirectory() {
  if (!win) return { canceled: true };

  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  const directoryPath = result.filePaths[0];
  const activationResult = await activateLogDirectory(directoryPath, { forceParse: true });
  return {
    canceled: false,
    directoryPath,
    filePath: activationResult?.filePath || null,
    ok: !!activationResult?.ok,
  };
}

async function restoreLastLogDirectoryIfAvailable() {
  const savedDirectoryPath = normalizeDirectoryPath(settings.logDirectoryPath)
    || (settings.currentFilePath ? path.dirname(settings.currentFilePath) : null);
  if (!savedDirectoryPath) return;

  if (!fs.existsSync(savedDirectoryPath)) {
    setCurrentFilePath(null);
    setCurrentDirectoryPath(null);
    sendWatchStatus(false, t('watchFolderUnavailable'));
    return;
  }

  await activateLogDirectory(savedDirectoryPath, { forceParse: true });
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
    restoreLastLogDirectoryIfAvailable();
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
    chooseLogDirectory();
  });

  ipcMain.handle('pick-log-file', async () => chooseLogDirectory());
  ipcMain.handle('reload-current-file', async () => {
    if (currentDirectoryPath) {
      const result = await syncLatestFileFromDirectory({ forceParse: true });
      return { ok: !!result?.filePath, filePath: result?.filePath || null, directoryPath: currentDirectoryPath };
    }
    if (currentFilePath) await parseAndSend(currentFilePath);
    return { ok: !!currentFilePath, filePath: currentFilePath, directoryPath: currentDirectoryPath };
  });
  ipcMain.handle('toggle-overlay-lock', async () => {
    setClickThrough(!clickThroughEnabled);
    return { locked: !clickThroughEnabled };
  });
  ipcMain.handle('get-current-file', async () => ({ filePath: currentFilePath, directoryPath: currentDirectoryPath }));
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
    if (currentDirectoryPath && fs.existsSync(currentDirectoryPath)) {
      sendWatchStatus(true, t('watchFolderActive'));
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
