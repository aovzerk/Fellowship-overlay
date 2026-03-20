// Safe preload bridge.
// Exposes a minimal API to the renderer without enabling Node.js directly in the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Commands initiated by UI buttons / keyboard shortcuts.
  pickLogFile: () => ipcRenderer.invoke('pick-log-file'),
  reloadCurrentFile: () => ipcRenderer.invoke('reload-current-file'),
  toggleOverlayLock: () => ipcRenderer.invoke('toggle-overlay-lock'),
  getCurrentFile: () => ipcRenderer.invoke('get-current-file'),
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  getSkillCatalog: () => ipcRenderer.invoke('get-skill-catalog'),

  // Push-style events sent from the main process.
  onLogData: (callback) => ipcRenderer.on('log-data', (_, payload) => callback(payload)),
  onWatchStatus: (callback) => ipcRenderer.on('watch-status', (_, payload) => callback(payload)),
  onOverlayMode: (callback) => ipcRenderer.on('overlay-mode', (_, payload) => callback(payload)),
  onHudState: (callback) => ipcRenderer.on('hud-state', (_, payload) => callback(payload)),
});
