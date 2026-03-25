import type {
  BrowserWindowLike,
  LogDirectoryService,
  OverlaySettingsStore,
  TrayManager,
} from '../types/main-process';
import type {
  GetOverlaySettingsSyncResult,
  GetPlayerPositionsSyncResult,
  HudActivityPayload,
  LanguageCode,
  LanguagePayload,
  LogDataPayload,
  LogSourceInfo,
  OpenSettingsPayload,
  OverlayHotkeys,
  OverlayModePayload,
  PickDirectoryResult,
  SaveOverlaySettingsResult,
  SavePlayerPositionsResult,
  SkillCatalog,
  WatchStatusPayload,
} from '../types/overlay';

import { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, Tray, Menu } from 'electron';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { disposeParserWorker, parseCombatLog } from './services/parser-runner';
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

interface GameWindowState {
  found: boolean;
  active: boolean;
  visible: boolean;
  minimized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  monitorX: number;
  monitorY: number;
  monitorWidth: number;
  monitorHeight: number;
  workAreaX: number;
  workAreaY: number;
  workAreaWidth: number;
  workAreaHeight: number;
  processName: string | null;
  title: string | null;
}

const GAME_PROCESS_NAME = 'fellowship-Win64-Shipping';
const WINDOW_TRACK_INTERVAL_MS = 1000;
const WINDOW_HIDE_MISS_THRESHOLD = 3;
const SETTINGS_CLOSE_GRACE_MS = 3000;

let win: BrowserWindowLike | null = null;
let clickThroughEnabled = true;
let isQuitting = false;
let settingsModalOpen = false;
let overlayVisibilityRequested = true;
let gameWindowPollTimer: ReturnType<typeof setInterval> | null = null;
let gameWindowPollInFlight = false;
let lastGameWindowState: GameWindowState | null = null;
let lastStableGameWindowState: GameWindowState | null = null;
let consecutiveWindowMisses = 0;
let settingsCloseGraceUntil = 0;
let windowProbeScriptPath: string | null = null;

function getConfiguredHotkeys(): OverlayHotkeys {
  return settingsStore.getOverlaySettings().hotkeys;
}

function isAutoHideWithGameWindowEnabled(): boolean {
  return settingsStore.getOverlaySettings().autoHideWithGameWindow !== false;
}

function resolveSettingsDirectory(): string {
  const portableExecutableDir = String(process.env.PORTABLE_EXECUTABLE_DIR || '').trim();

  if (portableExecutableDir) {
    return portableExecutableDir;
  }

  return app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : fromProjectRoot();
}

function resolveSettingsFilePath(): string {
  return path.join(resolveSettingsDirectory(), 'settings.json');
}

const SETTINGS_FILE: string = resolveSettingsFilePath();
const settingsStore: OverlaySettingsStore = createOverlaySettingsStore({ settingsFile: SETTINGS_FILE });

function getLiveWindow(): BrowserWindowLike | null {
  if (!win) return null;
  if (typeof win.isDestroyed === 'function' && win.isDestroyed()) {
    win = null;
    return null;
  }
  if (win.webContents && typeof win.webContents.isDestroyed === 'function' && win.webContents.isDestroyed()) {
    win = null;
    return null;
  }
  return win;
}
function showWindow(): void {
  const currentWin = getLiveWindow();
  if (!currentWin) return;
  currentWin.show();
  currentWin.focus();
}

function showWindowWithoutFocus(): void {
  const currentWin = getLiveWindow();
  if (!currentWin) return;
  if (typeof currentWin.showInactive === 'function') {
    currentWin.showInactive();
    return;
  }
  currentWin.show();
}

function hideToTray(): void {
  const currentWin = getLiveWindow();
  if (!currentWin) return;
  currentWin.hide();
}

function sendWatchStatus(ok: boolean, message: string): void {
  const payload: WatchStatusPayload = { ok: !!ok, message };
  const currentWin = getLiveWindow();
  currentWin?.webContents.send('watch-status', payload);
}

function sendLogData(payload: LogDataPayload & { updatedAt?: string }): void {
  const currentWin = getLiveWindow();
  currentWin?.webContents.send('log-data', payload);
}

function sendHudActivity(
  active: boolean,
  foregroundExe: string | null = null,
): void {
  const payload: HudActivityPayload = {
    active: !!active,
    foregroundExe,
  };
  const currentWin = getLiveWindow();
  currentWin?.webContents.send('hud-activity', payload);
}

const logDirectoryService: LogDirectoryService = createLogDirectoryService({
  parseCombatLog,
  settingsStore,
  sendWatchStatus,
  sendLogData,
});

function setClickThrough(enabled: boolean): void {
  clickThroughEnabled = !!enabled;

  const currentWin = getLiveWindow();
  if (!currentWin) return;

  currentWin.setIgnoreMouseEvents(clickThroughEnabled, { forward: true });
  const payload: OverlayModePayload = {
    clickThrough: clickThroughEnabled,
    locked: !clickThroughEnabled,
  };
  currentWin.webContents.send('overlay-mode', payload);
}

function getPowerShellWindowProbeScript(): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    "$processes = @(Get-Process -Name '" + GAME_PROCESS_NAME + "' -ErrorAction SilentlyContinue)",
    "Add-Type @'",
    "using System;",
    "using System.Text;",
    "using System.Runtime.InteropServices;",
    "public static class OverlayWinApi {",
    "  [StructLayout(LayoutKind.Sequential)]",
    "  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }",
    "  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]",
    "  public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public int dwFlags; }",
    "  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);",
    "  [DllImport(\"user32.dll\")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);",
    "  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);",
    "  [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);",
    "  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
    "  [DllImport(\"user32.dll\")] public static extern bool IsWindowVisible(IntPtr hWnd);",
    "  [DllImport(\"user32.dll\")] public static extern bool IsIconic(IntPtr hWnd);",
    "  [DllImport(\"user32.dll\")] public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint dwFlags);",
    "  [DllImport(\"user32.dll\", CharSet = CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);",
    "  [DllImport(\"user32.dll\", CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);",
    "}",
    "'@",
    "$pidSet = @{}",
    "foreach ($process in $processes) { $pidSet[[uint32]$process.Id] = $process }",
    "$windows = New-Object System.Collections.ArrayList",
    "$enum = [OverlayWinApi+EnumWindowsProc]{",
    "  param([IntPtr]$hWnd, [IntPtr]$lParam)",
    "  $windowPid = [uint32]0",
    "  [OverlayWinApi]::GetWindowThreadProcessId($hWnd, [ref]$windowPid) | Out-Null",
    "  if (-not $pidSet.ContainsKey($windowPid)) { return $true }",
    "  $rect = New-Object OverlayWinApi+RECT",
    "  $gotRect = [OverlayWinApi]::GetWindowRect($hWnd, [ref]$rect)",
    "  $visible = [OverlayWinApi]::IsWindowVisible($hWnd)",
    "  $minimized = [OverlayWinApi]::IsIconic($hWnd)",
    "  $width = 0",
    "  $height = 0",
    "  if ($gotRect) { $width = [Math]::Max(0, $rect.Right - $rect.Left); $height = [Math]::Max(0, $rect.Bottom - $rect.Top) }",
    "  $text = New-Object System.Text.StringBuilder 512",
    "  [OverlayWinApi]::GetWindowText($hWnd, $text, $text.Capacity) | Out-Null",
    "  $null = $windows.Add([PSCustomObject]@{ handle = [int64]$hWnd; pid = [int]$windowPid; visible = [bool]$visible; minimized = [bool]$minimized; x = if ($gotRect) { $rect.Left } else { 0 }; y = if ($gotRect) { $rect.Top } else { 0 }; width = $width; height = $height; area = ($width * $height); title = $text.ToString() })",
    "  return $true",
    "}",
    "[OverlayWinApi]::EnumWindows($enum, [IntPtr]::Zero) | Out-Null",
    "$foreground = [OverlayWinApi]::GetForegroundWindow()",
    "$foregroundPid = [uint32]0",
    "if ($foreground -ne [IntPtr]::Zero) { [OverlayWinApi]::GetWindowThreadProcessId($foreground, [ref]$foregroundPid) | Out-Null }",
    "$foregroundMatchesProcess = $pidSet.ContainsKey($foregroundPid)",
    "$debug = (($windows | Sort-Object area -Descending | Select-Object -First 8) | ForEach-Object { 'h=' + $_.handle + ' pid=' + $_.pid + ' vis=' + $_.visible + ' min=' + $_.minimized + ' rect=[' + $_.x + ',' + $_.y + ',' + $_.width + 'x' + $_.height + '] title=' + $_.title }) -join ' || '",
    "$candidates = $windows | Where-Object { $_.width -gt 0 -and $_.height -gt 0 }",
    "$best = $candidates | Sort-Object @{ Expression = { if ([IntPtr]::new([int64]$_.handle) -eq $foreground) { 0 } else { 1 } } }, @{ Expression = { if ($_.visible -and -not $_.minimized) { 0 } else { 1 } } }, @{ Expression = { -$_.area } } | Select-Object -First 1",
    "$handle = [IntPtr]::new([int64]$best.handle)",
    "$monitorHandle = [OverlayWinApi]::MonitorFromWindow($handle, 2)",
    "$monitorInfo = New-Object OverlayWinApi+MONITORINFO",
    "$monitorInfo.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf([type][OverlayWinApi+MONITORINFO])",
    "$gotMonitor = $false",
    "if ($monitorHandle -ne [IntPtr]::Zero) { $gotMonitor = [OverlayWinApi]::GetMonitorInfo($monitorHandle, [ref]$monitorInfo) }",
    "$monitorWidth = 0",
    "$monitorHeight = 0",
    "$workAreaWidth = 0",
    "$workAreaHeight = 0",
    "if ($gotMonitor) {",
    "  $monitorWidth = [Math]::Max(0, $monitorInfo.rcMonitor.Right - $monitorInfo.rcMonitor.Left)",
    "  $monitorHeight = [Math]::Max(0, $monitorInfo.rcMonitor.Bottom - $monitorInfo.rcMonitor.Top)",
    "  $workAreaWidth = [Math]::Max(0, $monitorInfo.rcWork.Right - $monitorInfo.rcWork.Left)",
    "  $workAreaHeight = [Math]::Max(0, $monitorInfo.rcWork.Bottom - $monitorInfo.rcWork.Top)",
    "}",
    "@{",
    "  found = $true;",
    "  active = [bool]$foregroundMatchesProcess;",
    "  visible = [bool]$best.visible;",
    "  minimized = [bool]$best.minimized;",
    "  x = [int]$best.x;",
    "  y = [int]$best.y;",
    "  width = [int]$best.width;",
    "  height = [int]$best.height;",
    "  monitorX = if ($gotMonitor) { $monitorInfo.rcMonitor.Left } else { 0 };",
    "  monitorY = if ($gotMonitor) { $monitorInfo.rcMonitor.Top } else { 0 };",
    "  monitorWidth = $monitorWidth;",
    "  monitorHeight = $monitorHeight;",
    "  workAreaX = if ($gotMonitor) { $monitorInfo.rcWork.Left } else { 0 };",
    "  workAreaY = if ($gotMonitor) { $monitorInfo.rcWork.Top } else { 0 };",
    "  workAreaWidth = $workAreaWidth;",
    "  workAreaHeight = $workAreaHeight;",
    "  processName = $processes[0].ProcessName;",
    "  title = [string]$best.title",
    "} | ConvertTo-Json -Compress",
  ].join('\n');
}
function getFallbackGameWindowState(): GameWindowState {
  return {
    found: false,
    active: false,
    visible: false,
    minimized: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    monitorX: 0,
    monitorY: 0,
    monitorWidth: 0,
    monitorHeight: 0,
    workAreaX: 0,
    workAreaY: 0,
    workAreaWidth: 0,
    workAreaHeight: 0,
    processName: null,
    title: null,
  };
}


function ensureWindowProbeScriptPath(): string {
  if (windowProbeScriptPath && fs.existsSync(windowProbeScriptPath)) {
    return windowProbeScriptPath;
  }

  const probePath = path.join(app.getPath('temp'), 'fs-overlay-window-probe.ps1');
  if (!fs.existsSync(probePath)) {
    fs.writeFileSync(probePath, getPowerShellWindowProbeScript(), 'utf8');
  }
  windowProbeScriptPath = probePath;
  return probePath;
}

function fetchGameWindowState(): Promise<GameWindowState> {
  return new Promise((resolve) => {
    const probePath = ensureWindowProbeScriptPath();

    execFile(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probePath],
      { windowsHide: true, timeout: 3000 },
      (error, stdout) => {
        if (error || !stdout) {
          resolve(getFallbackGameWindowState());
          return;
        }

        try {
          const parsed = JSON.parse(String(stdout).trim()) as Partial<GameWindowState>;
          resolve({
            found: !!parsed.found,
            active: !!parsed.active,
            visible: !!parsed.visible,
            minimized: !!parsed.minimized,
            x: Number(parsed.x || 0),
            y: Number(parsed.y || 0),
            width: Number(parsed.width || 0),
            height: Number(parsed.height || 0),
            monitorX: Number(parsed.monitorX || 0),
            monitorY: Number(parsed.monitorY || 0),
            monitorWidth: Number(parsed.monitorWidth || 0),
            monitorHeight: Number(parsed.monitorHeight || 0),
            workAreaX: Number(parsed.workAreaX || 0),
            workAreaY: Number(parsed.workAreaY || 0),
            workAreaWidth: Number(parsed.workAreaWidth || 0),
            workAreaHeight: Number(parsed.workAreaHeight || 0),
            processName: parsed.processName ? String(parsed.processName) : null,
            title: parsed.title ? String(parsed.title) : null,
          });
        } catch {
          resolve(getFallbackGameWindowState());
        }
      },
    );
  });
}

function resolveOverlayBoundsForGameWindow(state: GameWindowState): { x: number; y: number; width: number; height: number } {
  const fallbackBounds = { x: state.x, y: state.y, width: state.width, height: state.height };
  if (state.width <= 0 || state.height <= 0) return fallbackBounds;

  const bounds = {
    x: state.monitorX,
    y: state.monitorY,
    width: state.monitorWidth,
    height: state.monitorHeight,
  };
  const workArea = {
    x: state.workAreaX,
    y: state.workAreaY,
    width: state.workAreaWidth,
    height: state.workAreaHeight,
  };

  if (bounds.width <= 0 || bounds.height <= 0) {
    return fallbackBounds;
  }

  const edgeTolerance = 12;
  const areaCoverage = (state.width * state.height) / Math.max(1, bounds.width * bounds.height);

  const stateLeft = state.x;
  const stateTop = state.y;
  const stateRight = state.x + state.width;
  const stateBottom = state.y + state.height;

  const boundsRight = bounds.x + bounds.width;
  const boundsBottom = bounds.y + bounds.height;
  const workAreaRight = workArea.x + workArea.width;
  const workAreaBottom = workArea.y + workArea.height;

  const edgeMatches = (value, primary, secondary) =>
    Math.abs(value - primary) <= edgeTolerance || Math.abs(value - secondary) <= edgeTolerance;

  const fillsMonitorLikeFullscreen =
    areaCoverage >= 0.85 &&
    edgeMatches(stateLeft, bounds.x, workArea.x) &&
    edgeMatches(stateTop, bounds.y, workArea.y) &&
    edgeMatches(stateRight, boundsRight, workAreaRight) &&
    edgeMatches(stateBottom, boundsBottom, workAreaBottom);

  if (fillsMonitorLikeFullscreen) {
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }

  return fallbackBounds;
}

function applyGameWindowBounds(state: GameWindowState): void {
  const currentWin = getLiveWindow();
  if (!currentWin || !state.found || state.width <= 0 || state.height <= 0) return;

  const currentBounds = currentWin.getBounds();
  const nextBounds = resolveOverlayBoundsForGameWindow(state);

  if (
    currentBounds.x !== nextBounds.x ||
    currentBounds.y !== nextBounds.y ||
    currentBounds.width !== nextBounds.width ||
    currentBounds.height !== nextBounds.height
  ) {
    currentWin.setBounds(nextBounds);
  }
}

function applyTrackedOverlayState(state: GameWindowState | null): void {
  const rawState = state || getFallbackGameWindowState();
  const currentGood = rawState.found && rawState.visible && !rawState.minimized && rawState.active && rawState.width > 0 && rawState.height > 0;

  if (currentGood) {
    consecutiveWindowMisses = 0;
    lastStableGameWindowState = rawState;
  } else if (!settingsModalOpen) {
    consecutiveWindowMisses += 1;
  }

  const canReuseLastStable = !!lastStableGameWindowState && consecutiveWindowMisses < WINDOW_HIDE_MISS_THRESHOLD;
  const withinSettingsCloseGrace = Date.now() < settingsCloseGraceUntil;
  const effectiveState = currentGood ? rawState : (canReuseLastStable ? lastStableGameWindowState! : rawState);

  applyGameWindowBounds(effectiveState);

  const autoHideWithGameWindow = isAutoHideWithGameWindowEnabled();
  const keepVisibleDuringMissGrace = autoHideWithGameWindow && overlayVisibilityRequested && !settingsModalOpen && canReuseLastStable;
  const keepVisibleAfterSettingsClose = autoHideWithGameWindow && overlayVisibilityRequested && !settingsModalOpen && withinSettingsCloseGrace && !!lastStableGameWindowState;
  const shouldShow = autoHideWithGameWindow
    ? (settingsModalOpen || (overlayVisibilityRequested && currentGood) || keepVisibleDuringMissGrace || keepVisibleAfterSettingsClose)
    : (settingsModalOpen || overlayVisibilityRequested);

  if (shouldShow) {
    showWindowWithoutFocus();
  } else {
    hideToTray();
  }

  const processName = effectiveState.processName || rawState.processName;
  const foregroundExe = processName ? `${processName}.exe` : null;
  const hudActive = shouldShow;
  sendHudActivity(hudActive, foregroundExe);
}

async function syncOverlayWithGameWindow(): Promise<void> {
  if (gameWindowPollInFlight) return;
  gameWindowPollInFlight = true;

  try {
    const state = await fetchGameWindowState();
    lastGameWindowState = state;
    applyTrackedOverlayState(state);
  } finally {
    gameWindowPollInFlight = false;
  }
}

function startGameWindowTracking(): void {
  if (gameWindowPollTimer) return;
  void syncOverlayWithGameWindow();
  gameWindowPollTimer = setInterval(() => {
    void syncOverlayWithGameWindow();
  }, WINDOW_TRACK_INTERVAL_MS);
}

function stopGameWindowTracking(): void {
  if (!gameWindowPollTimer) return;
  clearInterval(gameWindowPollTimer);
  gameWindowPollTimer = null;
}

function toggleOverlayVisibility(): boolean {
  overlayVisibilityRequested = !overlayVisibilityRequested;
  applyTrackedOverlayState(lastGameWindowState);
  return !!win?.isVisible();
}

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
  const currentWin = getLiveWindow();
  currentWin?.webContents.send('open-settings', payload);
}

function setSettingsModalOpen(open: boolean): void {
  settingsModalOpen = !!open;
  if (settingsModalOpen) {
    settingsCloseGraceUntil = 0;
    if (clickThroughEnabled) setClickThrough(false);
  } else {
    settingsCloseGraceUntil = Date.now() + SETTINGS_CLOSE_GRACE_MS;
    if (lastStableGameWindowState) consecutiveWindowMisses = 0;
  }
  applyTrackedOverlayState(lastGameWindowState);
}

function closeInteractiveModal(): { locked: boolean } {
  settingsModalOpen = false;
  settingsCloseGraceUntil = Date.now() + SETTINGS_CLOSE_GRACE_MS;
  if (lastStableGameWindowState) {
    consecutiveWindowMisses = 0;
  }
  setClickThrough(true);
  applyTrackedOverlayState(lastGameWindowState);
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
  const { width, height } = primaryDisplay.bounds;

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
    const currentWin = getLiveWindow();
    currentWin?.webContents.send('language-changed', payload);
    void logDirectoryService.restoreLastLogDirectoryIfAvailable();
    applyTrackedOverlayState(lastGameWindowState);
  });

  win.on('close', (event: PreventableEventLike) => {
    if (!isQuitting) {
      event.preventDefault();
      overlayVisibilityRequested = false;
      hideToTray();
    }
  });

  win.on('closed', () => {
    win = null;
  });

  trayManager.createTray();
  setClickThrough(true);
}

function registerConfiguredHotkeys(): void {
  globalShortcut.unregisterAll();

  const hotkeys = getConfiguredHotkeys();
  const registrations: Array<[string, () => void]> = [
    [hotkeys.toggleInteraction, () => {
      setClickThrough(!clickThroughEnabled);
    }],
    [hotkeys.pickLog, () => {
      void chooseLogDirectory();
    }],
    [hotkeys.toggleVisibility, () => {
      toggleOverlayVisibility();
    }],
    [hotkeys.openSettings, () => {
      if (!win?.isVisible() || !settingsModalOpen) {
        openSettingsWindow();
        return;
      }
      const currentWin = getLiveWindow();
      currentWin?.webContents.send('request-close-settings');
    }],
  ];

  registrations.forEach(([accelerator, handler]) => {
    if (!accelerator) return;
    try {
      globalShortcut.register(accelerator, handler);
    } catch {}
  });
}

app.whenReady().then(() => {
  createWindow();
  registerConfiguredHotkeys();
  startGameWindowTracking();

  ipcMain.handle('pick-log-file', async (): Promise<PickDirectoryResult> => chooseLogDirectory());
  ipcMain.handle('reload-current-file', async () => logDirectoryService.reloadCurrentFile());
  ipcMain.handle('toggle-overlay-lock', async (): Promise<{ locked: boolean }> => {
    setClickThrough(!clickThroughEnabled);
    return { locked: !clickThroughEnabled };
  });
  ipcMain.handle('toggle-overlay-visibility', async (): Promise<{ visible: boolean }> => ({
    visible: toggleOverlayVisibility(),
  }));
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
    settings: (() => {
      const nextSettings = settingsStore.saveOverlaySettings(partialSettings);
      if (partialSettings && typeof partialSettings === 'object' && 'hotkeys' in (partialSettings as Record<string, unknown>)) {
        registerConfiguredHotkeys();
      }
      applyTrackedOverlayState(lastGameWindowState);
      return nextSettings;
    })(),
  }));
  ipcMain.handle('set-language', async (_: unknown, language: LanguageCode): Promise<LanguagePayload> => {
    const nextLanguage = settingsStore.setCurrentLanguage(language);
    trayManager.refreshTrayTooltip();
    const payload: LanguagePayload = { language: nextLanguage };
    const currentWin = getLiveWindow();
    currentWin?.webContents.send('language-changed', payload);

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
  stopGameWindowTracking();
  logDirectoryService.stopWatching();
  void disposeParserWorker();
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
