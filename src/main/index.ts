import type {
  BrowserWindowLike,
  LogDirectoryService,
  OverlaySettingsStore,
  TrayManager,
} from '../types/main-process';
import type {
  GetOverlaySettingsSyncResult,
  GetPlayerPositionsSyncResult,
  LanguageCode,
  LanguagePayload,
  LogDataPayload,
  LogSourceInfo,
  OpenSettingsPayload,
  OverlayModePayload,
  PickDirectoryResult,
  SaveOverlaySettingsResult,
  SavePlayerPositionsResult,
  SkillCatalog,
  WatchStatusPayload,
} from '../types/overlay';

import { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, Tray, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { parseCombatLog } from './services/parser';
import { getSkillCatalog } from './services/skill-catalog';
import { getAppIconPath, getTrayIcon } from './utils/icons';
import { fromProjectRoot } from './utils/project-paths';
import { createOverlaySettingsStore } from './config/overlay-settings';
import { createLogDirectoryService } from './services/log-directory';
import { createTrayManager } from './ui/tray';

interface PreventableEventLike {
  preventDefault(): void;
}

interface SyncIpcEventLike {
  returnValue: unknown;
}

interface OpenDialogResultLike {
  canceled: boolean;
  filePaths: string[];
}

let win: BrowserWindowLike | null = null;
let clickThroughEnabled = true;
let isQuitting = false;
let settingsModalOpen = false;

const SETTINGS_FILE: string = path.join(app.getPath('userData'), 'settings.json');
const settingsStore: OverlaySettingsStore = createOverlaySettingsStore({ settingsFile: SETTINGS_FILE });

function showWindow(): void {
  if (!win) return;
  win.show();
  win.focus();
}

function hideToTray(): void {
  if (!win) return;
  win.hide();
}

function sendWatchStatus(ok: boolean, message: string): void {
  const payload: WatchStatusPayload = { ok: !!ok, message };
  win?.webContents.send('watch-status', payload);
}

function sendLogData(payload: LogDataPayload & { updatedAt?: string }): void {
  win?.webContents.send('log-data', payload);
}

const logDirectoryService: LogDirectoryService = createLogDirectoryService({
  parseCombatLog,
  settingsStore,
  sendWatchStatus,
  sendLogData,
});

function openSettingsWindow(): void {
  if (!win) return;
  showWindow();
  settingsModalOpen = true;
  if (clickThroughEnabled) setClickThrough(false);
  const payload: OpenSettingsPayload = {
    filePath: settingsStore.getCurrentFilePath(),
    directoryPath: settingsStore.getCurrentDirectoryPath(),
    watching: !!logDirectoryService.getCurrentWatchState().watching,
    locked: !clickThroughEnabled,
    language: settingsStore.getCurrentLanguage(),
  };
  win.webContents.send('open-settings', payload);
}

function setSettingsModalOpen(open: boolean): void {
  settingsModalOpen = !!open;
  if (settingsModalOpen && clickThroughEnabled) {
    setClickThrough(false);
  }
}

function closeInteractiveModal(): { locked: boolean } {
  settingsModalOpen = false;
  setClickThrough(true);
  return { locked: !clickThroughEnabled };
}

const trayManager: TrayManager = createTrayManager({
  app,
  Menu,
  Tray,
  getTrayIcon,
  getWindow: () => win,
  hideToTray,
  onQuit: () => {
    isQuitting = true;
  },
  openSettingsWindow,
  showWindow,
  t: (key: string): string => settingsStore.t(key),
});

function setClickThrough(enabled: boolean): void {
  clickThroughEnabled = !!enabled;

  if (!win) return;

  win.setIgnoreMouseEvents(clickThroughEnabled, { forward: true });
  const payload: OverlayModePayload = {
    clickThrough: clickThroughEnabled,
    locked: !clickThroughEnabled,
  };
  win.webContents.send('overlay-mode', payload);
}

async function chooseLogDirectory(): Promise<PickDirectoryResult> {
  if (!win) return { canceled: true };

  const result = await dialog.showOpenDialog(win as any, {
    properties: ['openDirectory'],
  }) as OpenDialogResultLike;

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  const directoryPath = result.filePaths[0];
  const activationResult = await logDirectoryService.activateLogDirectory(directoryPath, { forceParse: true });
  return {
    canceled: false,
    directoryPath,
    filePath: activationResult?.filePath || null,
    ok: !!activationResult?.ok,
  };
}

function createWindow(): void {
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
  }) as BrowserWindowLike;

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(fromProjectRoot('src', 'renderer', 'index.html'));

  win.webContents.once('did-finish-load', () => {
    const payload: LanguagePayload = { language: settingsStore.getCurrentLanguage() };
    win?.webContents.send('language-changed', payload);
    void logDirectoryService.restoreLastLogDirectoryIfAvailable();
  });

  win.on('close', (event: PreventableEventLike) => {
    if (!isQuitting) {
      event.preventDefault();
      hideToTray();
    }
  });

  trayManager.createTray();
  setClickThrough(true);
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('F8', () => {
    setClickThrough(!clickThroughEnabled);
  });

  globalShortcut.register('F9', () => {
    void chooseLogDirectory();
  });

  globalShortcut.register('F11', () => {
    if (!win?.isVisible() || !settingsModalOpen) {
      openSettingsWindow();
      return;
    }
    win.webContents.send('request-close-settings');
  });

  ipcMain.handle('pick-log-file', async (): Promise<PickDirectoryResult> => chooseLogDirectory());
  ipcMain.handle('reload-current-file', async () => logDirectoryService.reloadCurrentFile());
  ipcMain.handle('toggle-overlay-lock', async (): Promise<{ locked: boolean }> => {
    setClickThrough(!clickThroughEnabled);
    return { locked: !clickThroughEnabled };
  });
  ipcMain.handle('set-settings-modal-open', async (_: unknown, open: boolean): Promise<{ ok: boolean }> => {
    setSettingsModalOpen(!!open);
    return { ok: true };
  });
  ipcMain.handle('close-interactive-modal', async (): Promise<{ locked: boolean }> => closeInteractiveModal());
  ipcMain.handle('get-current-file', async (): Promise<LogSourceInfo> => ({
    filePath: settingsStore.getCurrentFilePath(),
    directoryPath: settingsStore.getCurrentDirectoryPath(),
  }));
  ipcMain.handle('get-skill-catalog', async (): Promise<SkillCatalog> => getSkillCatalog());
  ipcMain.handle('get-language', async (): Promise<LanguagePayload> => ({ language: settingsStore.getCurrentLanguage() }));
  ipcMain.on('get-player-positions-sync', (event: SyncIpcEventLike) => {
    const result: GetPlayerPositionsSyncResult = { playerPositions: settingsStore.getPlayerPositions() };
    event.returnValue = result;
  });
  ipcMain.handle('save-player-positions', async (_: unknown, playerPositions): Promise<SavePlayerPositionsResult> => ({
    ok: true,
    playerPositions: settingsStore.setPlayerPositions(playerPositions),
  }));
  ipcMain.on('get-overlay-settings-sync', (event: SyncIpcEventLike) => {
    const result: GetOverlaySettingsSyncResult = { settings: settingsStore.getOverlaySettings() };
    event.returnValue = result;
  });
  ipcMain.handle('save-overlay-settings', async (_: unknown, partialSettings): Promise<SaveOverlaySettingsResult> => ({
    ok: true,
    settings: settingsStore.saveOverlaySettings(partialSettings),
  }));
  ipcMain.handle('set-language', async (_: unknown, language: LanguageCode): Promise<LanguagePayload> => {
    const nextLanguage = settingsStore.setCurrentLanguage(language);
    trayManager.refreshTrayTooltip();
    const payload: LanguagePayload = { language: nextLanguage };
    win?.webContents.send('language-changed', payload);

    const currentDirectoryPath = settingsStore.getCurrentDirectoryPath();
    if (currentDirectoryPath && fs.existsSync(currentDirectoryPath)) {
      sendWatchStatus(true, settingsStore.t('watchFolderActive'));
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
  logDirectoryService.stopWatching();
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showWindow();
  }
});

export {};
