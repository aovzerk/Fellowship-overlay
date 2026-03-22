import type {
  LogDirectorySelectionResult,
  LogDirectoryService,
  LogDirectoryServiceDeps,
  LogDirectorySyncOptions,
} from '../../types/main-process';

import * as fs from 'fs';
import * as path from 'path';
import { LOG_FILE_EXTENSIONS } from '../config/overlay-settings';

interface FileWatcherLike {
  close(): void;
}

interface FileCandidate {
  filePath: string;
  createdAt: number;
  modifiedAt: number;
}

function createLogDirectoryService({
  parseCombatLog,
  settingsStore,
  sendWatchStatus,
  sendLogData,
}: LogDirectoryServiceDeps): LogDirectoryService & {
  syncLatestFileFromDirectory(options?: LogDirectorySyncOptions): Promise<LogDirectorySelectionResult>;
} {
  let currentFileWatcher: FileWatcherLike | null = null;
  let currentDirectoryWatcher: FileWatcherLike | null = null;
  let reparseTimer: ReturnType<typeof setTimeout> | null = null;
  let directoryRescanTimer: ReturnType<typeof setTimeout> | null = null;
  let parseInFlight = false;
  let pendingParseFilePath: string | null = null;

  function isSupportedLogFile(filePath: string | null | undefined): boolean {
    if (!filePath) return false;

    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) return false;
      return LOG_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
    } catch {
      return false;
    }
  }

  function getFileCreatedAt(stats: { birthtimeMs?: number; ctimeMs?: number; mtimeMs?: number }): number {
    const birthtimeMs = Number(stats?.birthtimeMs || 0);
    if (Number.isFinite(birthtimeMs) && birthtimeMs > 0) return birthtimeMs;
    const ctimeMs = Number(stats?.ctimeMs || 0);
    const mtimeMs = Number(stats?.mtimeMs || 0);
    return Math.max(ctimeMs, mtimeMs, 0);
  }

  function findLatestLogFile(directoryPath: string | null | undefined): string | null {
    const normalizedDirectoryPath = settingsStore.normalizeDirectoryPath(directoryPath);
    if (!normalizedDirectoryPath || !fs.existsSync(normalizedDirectoryPath)) return null;

    const candidates: FileCandidate[] = [];
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

  async function runParseOnce(filePath: string): Promise<void> {
    try {
      const data = await parseCombatLog(filePath);
      sendLogData({
        ok: true,
        filePath,
        data,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const typedError = error as { stack?: string; message?: string } | null;
      sendLogData({
        ok: false,
        filePath,
        error: typedError?.stack || typedError?.message || String(error),
      });
    }
  }

  async function parseAndSend(filePath: string | null | undefined): Promise<void> {
    if (!filePath) return;

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

  function stopFileWatcher(): void {
    if (reparseTimer) {
      clearTimeout(reparseTimer);
      reparseTimer = null;
    }
    if (currentFileWatcher) {
      currentFileWatcher.close();
      currentFileWatcher = null;
    }
  }

  function stopDirectoryWatcher(): void {
    if (directoryRescanTimer) {
      clearTimeout(directoryRescanTimer);
      directoryRescanTimer = null;
    }
    if (currentDirectoryWatcher) {
      currentDirectoryWatcher.close();
      currentDirectoryWatcher = null;
    }
  }

  function stopWatching(): void {
    stopFileWatcher();
    stopDirectoryWatcher();
  }

  function scheduleParse(filePath: string, delay = 120): void {
    if (reparseTimer) clearTimeout(reparseTimer);
    reparseTimer = setTimeout(() => {
      void parseAndSend(filePath);
    }, delay);
  }

  function scheduleDirectoryRescan(delay = 200): void {
    if (directoryRescanTimer) clearTimeout(directoryRescanTimer);
    directoryRescanTimer = setTimeout(() => {
      void syncLatestFileFromDirectory();
    }, delay);
  }

  function startFileWatcher(filePath: string | null | undefined): void {
    stopFileWatcher();
    if (!filePath) return;

    try {
      currentFileWatcher = fs.watch(filePath, { persistent: true }, (eventType: string) => {
        if (eventType === 'rename' && !fs.existsSync(filePath)) {
          stopFileWatcher();
          sendWatchStatus(false, settingsStore.t('watchFileUnavailable'));
          scheduleDirectoryRescan(100);
          return;
        }
        scheduleParse(filePath, 100);
      }) as FileWatcherLike;
    } catch (error) {
      const typedError = error as { message?: string } | null;
      sendWatchStatus(false, typedError?.message || String(error));
    }
  }

  function startDirectoryWatcher(directoryPath: string | null | undefined): void {
    stopDirectoryWatcher();
    if (!directoryPath) return;

    try {
      currentDirectoryWatcher = fs.watch(directoryPath, { persistent: true }, () => {
        scheduleDirectoryRescan(150);
      }) as FileWatcherLike;
      sendWatchStatus(true, settingsStore.t('watchFolderActive'));
    } catch (error) {
      const typedError = error as { message?: string } | null;
      sendWatchStatus(false, typedError?.message || String(error));
    }
  }

  async function syncLatestFileFromDirectory(options: LogDirectorySyncOptions = {}): Promise<LogDirectorySelectionResult> {
    const normalizedDirectoryPath = settingsStore.normalizeDirectoryPath(options.directoryPath || settingsStore.getCurrentDirectoryPath());
    if (!normalizedDirectoryPath) return { canceled: false, ok: false, filePath: null, directoryPath: null };

    if (!fs.existsSync(normalizedDirectoryPath)) {
      stopWatching();
      settingsStore.setCurrentFilePath(null);
      settingsStore.setCurrentDirectoryPath(null);
      sendWatchStatus(false, settingsStore.t('watchFolderUnavailable'));
      return { canceled: false, ok: false, filePath: null, directoryPath: null };
    }

    const latestFilePath = findLatestLogFile(normalizedDirectoryPath);
    if (!latestFilePath) {
      stopFileWatcher();
      settingsStore.setCurrentFilePath(null);
      sendWatchStatus(false, settingsStore.t('noLogFiles'));
      return { canceled: false, ok: false, filePath: null, directoryPath: normalizedDirectoryPath };
    }

    const currentFilePath = settingsStore.getCurrentFilePath();
    const shouldSwitchFile = latestFilePath !== currentFilePath || !currentFileWatcher;
    if (shouldSwitchFile) {
      settingsStore.setCurrentFilePath(latestFilePath);
      startFileWatcher(latestFilePath);
    }

    if (shouldSwitchFile || options.forceParse) {
      await parseAndSend(latestFilePath);
    }

    sendWatchStatus(true, settingsStore.t('watchFolderActive'));
    return { canceled: false, ok: true, filePath: latestFilePath, directoryPath: normalizedDirectoryPath };
  }

  async function activateLogDirectory(directoryPath: string | null | undefined, options: LogDirectorySyncOptions = {}): Promise<LogDirectorySelectionResult> {
    const normalizedDirectoryPath = settingsStore.normalizeDirectoryPath(directoryPath);
    if (!normalizedDirectoryPath) return { canceled: false, ok: false, filePath: null, directoryPath: null };

    settingsStore.setCurrentDirectoryPath(normalizedDirectoryPath);
    startDirectoryWatcher(normalizedDirectoryPath);
    return syncLatestFileFromDirectory({
      directoryPath: normalizedDirectoryPath,
      forceParse: options.forceParse !== false,
    });
  }

  async function restoreLastLogDirectoryIfAvailable(): Promise<void> {
    const settings = settingsStore.getSettings();
    const savedDirectoryPath = settingsStore.normalizeDirectoryPath(settings.logDirectoryPath)
      || (settings.currentFilePath ? path.dirname(settings.currentFilePath) : null);
    if (!savedDirectoryPath) return;

    if (!fs.existsSync(savedDirectoryPath)) {
      settingsStore.setCurrentFilePath(null);
      settingsStore.setCurrentDirectoryPath(null);
      sendWatchStatus(false, settingsStore.t('watchFolderUnavailable'));
      return;
    }

    await activateLogDirectory(savedDirectoryPath, { forceParse: true });
  }

  async function reloadCurrentFile(): Promise<LogDirectorySelectionResult> {
    const currentDirectoryPath = settingsStore.getCurrentDirectoryPath();
    const currentFilePath = settingsStore.getCurrentFilePath();

    if (currentDirectoryPath) {
      const result = await syncLatestFileFromDirectory({ forceParse: true });
      return {
        canceled: false,
        ok: !!result?.filePath,
        filePath: result?.filePath || null,
        directoryPath: currentDirectoryPath,
      };
    }

    if (currentFilePath) await parseAndSend(currentFilePath);
    return { canceled: false, ok: !!currentFilePath, filePath: currentFilePath, directoryPath: currentDirectoryPath };
  }

  return {
    activateLogDirectory,
    getCurrentWatchState() {
      return {
        watching: !!(currentDirectoryWatcher || currentFileWatcher),
        filePath: settingsStore.getCurrentFilePath(),
        directoryPath: settingsStore.getCurrentDirectoryPath(),
      };
    },
    reloadCurrentFile,
    restoreLastLogDirectoryIfAvailable,
    stopWatching,
    syncLatestFileFromDirectory,
  };
}

export {
  createLogDirectoryService,
};
