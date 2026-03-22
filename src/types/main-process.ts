import type {
  LanguageCode,
  FinalizedState,
  LogDataPayload,
  LogSourceInfo,
  OverlaySettings,
  ParserState,
  PickDirectoryResult,
  PlayerPositions,
  SkillCatalog,
} from './overlay';

export type NormalizedOverlaySettings = OverlaySettings & {
  language: LanguageCode;
  logDirectoryPath: string | null;
  currentFilePath: string | null;
};

export type SkillDataMap = Record<string, Record<string, number>>;
export type AbilityStatKind = 'activation' | 'damage' | 'healing';

export interface OverlaySettingsStore {
  t(key: string): string;
  getSettings(): NormalizedOverlaySettings;
  getCurrentLanguage(): LanguageCode;
  setCurrentLanguage(language: unknown): LanguageCode;
  getPlayerPositions(): PlayerPositions;
  setPlayerPositions(playerPositions: PlayerPositions): PlayerPositions;
  getOverlaySettings(): NormalizedOverlaySettings;
  saveOverlaySettings(partialSettings: Partial<OverlaySettings>): NormalizedOverlaySettings;
  getCurrentFilePath(): string | null;
  setCurrentFilePath(filePath: unknown): string | null;
  getCurrentDirectoryPath(): string | null;
  setCurrentDirectoryPath(directoryPath: unknown): string | null;
  normalizeDirectoryPath(value: unknown): string | null;
  normalizeCurrentFilePath(value: unknown): string | null;
}

export interface WatchState extends LogSourceInfo {
  watching: boolean;
}

export interface LogDirectorySyncOptions {
  directoryPath?: string | null;
  forceParse?: boolean;
}

export interface LogDirectorySelectionResult extends PickDirectoryResult {
  filePath: string | null;
  directoryPath: string | null;
  ok: boolean;
}

export interface LogDirectoryService {
  activateLogDirectory(directoryPath: string | null | undefined, options?: LogDirectorySyncOptions): Promise<LogDirectorySelectionResult>;
  restoreLastLogDirectoryIfAvailable(): Promise<void>;
  reloadCurrentFile(): Promise<LogDirectorySelectionResult>;
  stopWatching(): void;
  getCurrentWatchState(): WatchState;
}

export interface LogDirectoryServiceDeps {
  parseCombatLog(filePath: string): Promise<FinalizedState>;
  settingsStore: OverlaySettingsStore;
  sendWatchStatus(ok: boolean, message: string): void;
  sendLogData(payload: LogDataPayload & { updatedAt?: string }): void;
}

export interface ParserCacheEntry {
  identity: string;
  offset: number;
  leftover: string;
  state: ParserState;
}

export interface BrowserWindowLike {
  show(): void;
  hide(): void;
  focus(): void;
  isVisible(): boolean;
  setIgnoreMouseEvents(ignore: boolean, options?: { forward?: boolean }): void;
  setAlwaysOnTop(flag: boolean, level?: string): void;
  setVisibleOnAllWorkspaces(flag: boolean, options?: { visibleOnFullScreen?: boolean }): void;
  loadFile(filePath: string): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  webContents: {
    send(channel: string, payload?: unknown): void;
    once(event: string, listener: (...args: unknown[]) => void): void;
  };
}

export interface TrayLike {
  setToolTip(text: string): void;
  popUpContextMenu(menu?: unknown): void;
  on(event: string, listener: () => void): void;
}

export interface TrayManagerDeps {
  app: { quit(): void };
  Menu: { buildFromTemplate(template: unknown[]): unknown };
  Tray: new (icon: unknown) => TrayLike;
  getTrayIcon(): unknown;
  getWindow(): BrowserWindowLike | null;
  hideToTray(): void;
  onQuit(): void;
  openSettingsWindow(): void;
  showWindow(): void;
  t(key: string): string;
}

export interface TrayManager {
  createTray(): TrayLike;
  getTray(): TrayLike | null;
  refreshTrayTooltip(): void;
}

export interface GetSkillCatalogFn {
  (): SkillCatalog;
}
