const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { parseCombatLog } = require('./parser');

let win = null;
let currentFilePath = null;
let currentWatcher = null;
let reparseTimer = null;
let clickThroughEnabled = true;
let foregroundPollTimer = null;
let lastHudActive = null;
let tray = null;
let isQuitting = false;

const TARGET_GAME_EXE = 'fellowship-win64-shipping.exe';
const FOREGROUND_POLL_INTERVAL_MS = 1000;
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


function getTrayIcon() {
  const iconCandidates = [
    path.join(__dirname, 'tray.png'),
    path.join(__dirname, 'icons_trink', 'empty.png'),
  ];

  for (const iconPath of iconCandidates) {
    if (fs.existsSync(iconPath)) {
      const image = nativeImage.createFromPath(iconPath);
      if (!image.isEmpty()) {
        return image.resize({ width: 16, height: 16 });
      }
    }
  }

  return nativeImage.createEmpty();
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

function createTray() {
  if (tray) return tray;

  tray = new Tray(getTrayIcon());
  tray.setToolTip('Fellowship Overlay');

  const buildMenu = () => Menu.buildFromTemplate([
    { label: win?.isVisible() ? 'Скрыть оверлей' : 'Показать оверлей', click: () => {
      if (!win) return;
      if (win.isVisible()) hideToTray();
      else showWindow();
    } },
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

function stopForegroundPolling() {
  if (foregroundPollTimer) {
    clearInterval(foregroundPollTimer);
    foregroundPollTimer = null;
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

function setClickThrough(enabled) {
  clickThroughEnabled = !!enabled;

  if (!win) return;

  win.setIgnoreMouseEvents(clickThroughEnabled, { forward: true });
  win.webContents.send('overlay-mode', {
    clickThrough: clickThroughEnabled,
    locked: !clickThroughEnabled,
  });
}

function sendHudState(isActive, foregroundExe = null) {
  if (!win) return;
  win.webContents.send('hud-state', {
    active: !!isActive,
    foregroundExe,
    targetExe: TARGET_GAME_EXE,
  });
}

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

async function refreshHudState() {
  const foregroundExe = await getForegroundProcessName();
  const isGameActive = true; //String(foregroundExe || '').toLowerCase() === TARGET_GAME_EXE;

  if (lastHudActive === isGameActive) return;
  lastHudActive = isGameActive;
  sendHudState(isGameActive, foregroundExe);
}

function startForegroundPolling() {
  stopForegroundPolling();
  refreshHudState();
  foregroundPollTimer = setInterval(() => {
    refreshHudState();
  }, FOREGROUND_POLL_INTERVAL_MS);
}

async function chooseFile() {
  if (!win) return { canceled: true };

  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Log files', extensions: ['txt', 'log'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  currentFilePath = result.filePaths[0];
  await parseAndSend(currentFilePath);
  startWatching(currentFilePath);

  return {
    canceled: false,
    filePath: currentFilePath,
  };
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;

  win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'index.html'));
  createTray();

  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    hideToTray();
  });

  win.on('show', () => {
    tray?.setContextMenu(null);
  });

  setClickThrough(true);
  startForegroundPolling();

  globalShortcut.register('F8', () => {
    setClickThrough(!clickThroughEnabled);
  });

  globalShortcut.register('F9', async () => {
    await chooseFile();
  });
}

app.whenReady().then(createWindow);

app.on('will-quit', () => {
  stopWatching();
  stopForegroundPolling();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.handle('pick-log-file', async () => chooseFile());

ipcMain.handle('reload-current-file', async () => {
  if (!currentFilePath) {
    return { ok: false, error: 'Файл не выбран' };
  }

  await parseAndSend(currentFilePath);
  return { ok: true };
});

ipcMain.handle('toggle-overlay-lock', async () => {
  setClickThrough(!clickThroughEnabled);
  return { ok: true, locked: !clickThroughEnabled };
});

ipcMain.handle('get-current-file', async () => ({
  filePath: currentFilePath,
}));

ipcMain.handle('minimize-to-tray', async () => {
  hideToTray();
  return { ok: true };
});

ipcMain.handle('quit-app', async () => {
  isQuitting = true;
  app.quit();
  return { ok: true };
});
