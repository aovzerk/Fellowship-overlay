import * as fs from 'fs';
import { nativeImage } from 'electron';
import { fromProjectRoot } from './project-paths';
import { getDefaultRelicIconPath } from '../services/game-database';

function getAppIconPath(): string | null {
  const iconCandidates: Array<string | null> = [
    fromProjectRoot('icons', 'icon.ico'),
    fromProjectRoot('icon.ico'),
    fromProjectRoot('tray.png'),
    getDefaultRelicIconPath(),
  ];

  for (const iconPath of iconCandidates) {
    if (iconPath && fs.existsSync(iconPath)) {
      return iconPath;
    }
  }

  return null;
}

function getTrayIcon(): unknown {
  const iconCandidates: string[] = [
    getAppIconPath(),
    fromProjectRoot('tray.png'),
    getDefaultRelicIconPath(),
  ].filter(Boolean) as string[];

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

export {
  getAppIconPath,
  getTrayIcon,
};
