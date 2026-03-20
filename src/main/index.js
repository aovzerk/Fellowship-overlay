// Main Electron process.
// Responsible for creating the overlay window, tray integration,
// file selection, log watching, keyboard shortcuts, and IPC bridge handlers.
const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { parseCombatLog } = require('./services/parser');
const { getSkillCatalog } = require('./services/skill-catalog');
const { getAppIconPath, getTrayIcon } = require('./utils/icons');
const { fromProjectRoot } = require('./utils/project-paths');

// Runtime state shared across the main process.
let win = null;
let currentFilePath = null;
let currentWatcher = null;
let reparseTimer = null;
let clickThroughEnabled = true;
let foregroundPollTimer = null;
let lastHudActive = null;
let tray = null;
let isQuitting = false;

// Name of the game executable used for HUD visibility checks.
const TARGET_GAME_EXE = 'fellowship-win64-shipping.exe';
const FOREGROUND_POLL_INTERVAL_MS = 1000;

// Tiny PowerShell helper that returns the executable name of the current
// foreground window. This is used to detect when the game is active.
const FOREGROUND_EXE_SCRIPT = String.raw`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win32ForegroundWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@;

$hwnd = [Win32ForegroundWindow]::GetForegroundWindow();
if ($hwnd -eq [IntPtr]::Zero) {
  return
}

$pid = 0
[void][Win32ForegroundWindow]::GetWindowThreadProcessId($hwnd, [ref]$pid)
if ($pid -le 0) {
  return
}

try {
  $proc = Get-Process -Id $pid -ErrorAction Stop
  if ($proc -and $proc.ProcessName) {
    Write-Output ($proc.ProcessName + '.exe')
  }
} catch {
}
`;

// Show and focus the overlay window.
function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

// Hide the window without quitting the app.
function hideToTray() {
  if (!win) return;
  win.hide();
}

// Create tray icon and menu once.
function createTray() {
  if (tray) return tray;

  tray = new Tray(getTrayIcon());
  tray.setToolTip('Fellowship Overlay');

  const buildMenu = () => Menu.buildFromTemplate([
    // Toggle current overlay visibility.
    { label: win?.isVisible() ? 'Скрыть оверлей' : 'Показать оверлей', click: () => {
      if (!win) return;
      if (win.isVisible()) hideToTray();
      else showWindow();
    } },
    // Toggle drag/edit mode.
    { label: clickThroughEnabled ? 'Разблокировать оверлей' : 'Заблокировать оверлей', click: () => setClickThrough(!clickThroughEnabled) },
    { type: 'separator' },
    { label: 'Выбрать лог', click: () => chooseFile() },
    { label: 'Обновить', click: () => currentFilePath && parseAndSend(currentFilePath) },
    { type: 'separator' },
    { label: 'Выход', click: () => { isQuitting = true; app.quit(); } },
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

// Parse the selected combat log and push fresh data to the renderer.
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

// Stop file watcher and pending debounced reparses.
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

// Stop polling for foreground window changes.
function stopForegroundPolling() {
  if (foregroundPollTimer) {
    clearInterval(foregroundPollTimer);
    foregroundPollTimer = null;
  }
}

// Debounce log reparsing so bursts of fs.watch events do not overload the app.
function scheduleParse(filePath, delay = 120) {
  clearTimeout(reparseTimer);
  reparseTimer = setTimeout(() => {
    parseAndSend(filePath);
  }, delay);
}

// Watch the active log file and trigger reparsing on changes.
function startWatching(filePath) {
  stopWatching();

  try {
    currentWatcher = fs.watch(filePath, { persistent: true }, (eventType) => {
      if (eventType === 'rename' && !fs.existsSync(filePath)) {
        win?.webContents.send('watch-status', {
          ok: false,
          message: 'Файл недоступен',
        });
        return;
      }
      scheduleParse(filePath, 100);
    });

    win?.webContents.send('watch-status', {
      ok: true,
      message: 'Слежение активно',
    });
  } catch (error) {
    win?.webContents.send('watch-status', {
      ok: false,
      message: error?.message || String(error),
    });
  }
}

// Click-through mode lets the overlay ignore mouse input while staying visible.
function setClickThrough(enabled) {
  clickThroughEnabled = !!enabled;

  if (!win) return;

  win.setIgnoreMouseEvents(clickThroughEnabled, { forward: true });
  win.webContents.send('overlay-mode', {
    clickThrough: clickThroughEnabled,
    locked: !clickThroughEnabled,
  });
}

// Send current HUD visibility state to renderer.
function sendHudState(isActive, foregroundExe = null) {
  if (!win) return;
  win.webContents.send('hud-state', {
    active: !!isActive,
    foregroundExe,
    targetExe: TARGET_GAME_EXE,
  });
}

// Resolve current foreground executable on Windows.
function getForegroundProcessName() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null);
      return;
    }

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', FOREGROUND_EXE_SCRIPT],
      { windowsHide: true, timeout: 2500, maxBuffer: 64 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const value = String(stdout || '').trim();
        resolve(value || null);
      }
    );
  });
}

// Re-evaluate whether the overlay should be visible as HUD.
async function refreshHudState() {
  const foregroundExe = await getForegroundProcessName();
  const isGameActive = true;

  if (lastHudActive === isGameActive) return;
  lastHudActive = isGameActive;
  sendHudState(isGameActive, foregroundExe);
}

// Start periodic HUD checks.
function startForegroundPolling() {
  stopForegroundPolling();
  refreshHudState();
  foregroundPollTimer = setInterval(() => {
    refreshHudState();
  }, FOREGROUND_POLL_INTERVAL_MS);
}

// Ask the user to pick a combat log file and start watching it.
async function chooseFile() {
  if (!win) return { canceled: true };

  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Log files', extensions: ['txt', 'log'] },
      { name: 'All files', extensions: ['*'] },
    ],
    defaultPath: currentFilePath || fromProjectRoot(),
  });

  if (result.canceled || !result.filePaths?.[0]) return { canceled: true };

  currentFilePath = result.filePaths[0];
  startWatching(currentFilePath);
  await parseAndSend(currentFilePath);
  return { canceled: false, filePath: currentFilePath };
}

// Create the transparent always-on-top overlay window.
function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width,
    height: 900,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    icon: getAppIconPath() || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  setClickThrough(true);

  // Closing the window hides it to tray unless the app is exiting.
  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    hideToTray();
  });

  win.on('closed', () => {
    win = null;
  });
}

// Register IPC calls used by the renderer UI.
function registerIpc() {
  ipcMain.handle('pick-log-file', () => chooseFile());
  ipcMain.handle('reload-current-file', async () => {
    if (currentFilePath) await parseAndSend(currentFilePath);
    return { filePath: currentFilePath };
  });
  ipcMain.handle('toggle-overlay-lock', () => {
    setClickThrough(!clickThroughEnabled);
    return { clickThrough: clickThroughEnabled, locked: !clickThroughEnabled };
  });
  ipcMain.handle('get-current-file', () => ({ filePath: currentFilePath }));
  ipcMain.handle('minimize-to-tray', () => {
    hideToTray();
    return { ok: true };
  });
  ipcMain.handle('quit-app', () => {
    isQuitting = true;
    app.quit();
    return { ok: true };
  });
  ipcMain.handle('get-skill-catalog', () => getSkillCatalog());
}

// Global shortcuts for quick overlay control while the game is focused.
function registerShortcuts() {
  globalShortcut.register('F8', () => {
    setClickThrough(!clickThroughEnabled);
  });

  globalShortcut.register('F9', () => {
    chooseFile();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerIpc();
  registerShortcuts();
  startForegroundPolling();

  app.on('activate', () => {
    if (!win) createWindow();
    else showWindow();
  });
});

app.on('window-all-closed', (event) => {
  // Prevent auto-exit on Windows/Linux because the app should live in tray.
  event.preventDefault();
});

app.on('before-quit', () => {
  isQuitting = true;
  stopWatching();
  stopForegroundPolling();
  globalShortcut.unregisterAll();
});
