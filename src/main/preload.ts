import type {
  LanguageCode,
  LogDataPayload,
  OpenSettingsPayload,
  OverlayModePayload,
  OverlaySettings,
  PlayerPositions,
  WatchStatusPayload,
} from '../types/overlay';

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  pickLogFile: (): Promise<unknown> => ipcRenderer.invoke('pick-log-file'),
  reloadCurrentFile: (): Promise<unknown> => ipcRenderer.invoke('reload-current-file'),
  toggleOverlayLock: (): Promise<{ locked: boolean }> => ipcRenderer.invoke('toggle-overlay-lock'),
  toggleOverlayVisibility: (): Promise<{ visible: boolean }> => ipcRenderer.invoke('toggle-overlay-visibility'),
  setSettingsModalOpen: (open: boolean): Promise<{ ok: boolean }> => ipcRenderer.invoke('set-settings-modal-open', open),
  closeInteractiveModal: (): Promise<{ locked: boolean }> => ipcRenderer.invoke('close-interactive-modal'),
  getCurrentFile: (): Promise<unknown> => ipcRenderer.invoke('get-current-file'),
  getSkillCatalog: (): Promise<unknown> => ipcRenderer.invoke('get-skill-catalog'),
  getLanguage: (): Promise<{ language: LanguageCode }> => ipcRenderer.invoke('get-language'),
  setLanguage: (language: LanguageCode): Promise<{ language: LanguageCode }> => ipcRenderer.invoke('set-language', language),
  getPlayerPositionsSync: (): { playerPositions: PlayerPositions } => ipcRenderer.sendSync('get-player-positions-sync'),
  savePlayerPositions: (playerPositions: PlayerPositions): Promise<{ ok: boolean; playerPositions: PlayerPositions }> => ipcRenderer.invoke('save-player-positions', playerPositions),
  getOverlaySettingsSync: (): { settings: OverlaySettings } => ipcRenderer.sendSync('get-overlay-settings-sync'),
  saveOverlaySettings: (partialSettings: Partial<OverlaySettings>): Promise<{ ok: boolean; settings: OverlaySettings }> => ipcRenderer.invoke('save-overlay-settings', partialSettings),

  onLogData: (callback: (payload: LogDataPayload) => void): void => { ipcRenderer.on('log-data', (_: unknown, payload: LogDataPayload) => callback(payload)); },
  onWatchStatus: (callback: (payload: WatchStatusPayload) => void): void => { ipcRenderer.on('watch-status', (_: unknown, payload: WatchStatusPayload) => callback(payload)); },
  onOverlayMode: (callback: (payload: OverlayModePayload) => void): void => { ipcRenderer.on('overlay-mode', (_: unknown, payload: OverlayModePayload) => callback(payload)); },
  onLanguageChanged: (callback: (payload: { language: LanguageCode }) => void): void => { ipcRenderer.on('language-changed', (_: unknown, payload: { language: LanguageCode }) => callback(payload)); },
  onOpenSettings: (callback: (payload: OpenSettingsPayload) => void): void => { ipcRenderer.on('open-settings', (_: unknown, payload: OpenSettingsPayload) => callback(payload)); },
  onRequestCloseSettings: (callback: () => void): void => { ipcRenderer.on('request-close-settings', () => callback()); },
});
