const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickLogFile: () => ipcRenderer.invoke('pick-log-file'),
  reloadCurrentFile: () => ipcRenderer.invoke('reload-current-file'),
  toggleOverlayLock: () => ipcRenderer.invoke('toggle-overlay-lock'),
  getCurrentFile: () => ipcRenderer.invoke('get-current-file'),
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  onLogData: (callback) => ipcRenderer.on('log-data', (_, payload) => callback(payload)),
  onWatchStatus: (callback) => ipcRenderer.on('watch-status', (_, payload) => callback(payload)),
  onOverlayMode: (callback) => ipcRenderer.on('overlay-mode', (_, payload) => callback(payload)),
  onHudState: (callback) => ipcRenderer.on('hud-state', (_, payload) => callback(payload)),
});
