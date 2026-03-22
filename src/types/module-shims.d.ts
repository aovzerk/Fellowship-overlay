declare module 'fs' {
  const fs: any;
  export = fs;
}

declare module 'path' {
  const path: any;
  export = path;
}

declare module 'electron' {
  export const app: any;
  export const BrowserWindow: any;
  export const contextBridge: any;
  export const dialog: any;
  export const globalShortcut: any;
  export const ipcMain: any;
  export const ipcRenderer: any;
  export const Menu: any;
  export const nativeImage: any;
  export const screen: any;
  export const Tray: any;
}
