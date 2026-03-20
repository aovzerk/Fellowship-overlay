const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickLogFile: () => ipcRenderer.invoke('pick-log-file'),
  reloadCurrentFile: () => ipcRenderer.invoke('reload-current-file'),
  toggleOverlayLock: () => ipcRenderer.invoke('toggle-overlay-lock'),
  getCurrentFile: () => ipcRenderer.invoke('get-current-file'),
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  getSkillCatalog: () => ipcRenderer.invoke('get-skill-catalog'),
  getLanguage: () => ipcRenderer.invoke('get-language'),
  setLanguage: (language) => ipcRenderer.invoke('set-language', language),

  onLogData: (callback) => ipcRenderer.on('log-data', (_, payload) => callback(payload)),
  onWatchStatus: (callback) => ipcRenderer.on('watch-status', (_, payload) => callback(payload)),
  onOverlayMode: (callback) => ipcRenderer.on('overlay-mode', (_, payload) => callback(payload)),
  onHudState: (callback) => ipcRenderer.on('hud-state', (_, payload) => callback(payload)),
  onLanguageChanged: (callback) => ipcRenderer.on('language-changed', (_, payload) => callback(payload)),
});
