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
declare module 'worker_threads' {
  export const parentPort: any;
  export const workerData: any;
  export class Worker {
    constructor(filename: string, options?: any);
    on(event: string, listener: (...args: any[]) => void): this;
    postMessage(message: any): void;
    terminate(): Promise<number>;
  }
}

declare module 'child_process' {
  export const execFile: any;
  export const spawn: any;
  export type ChildProcess = any;
}
