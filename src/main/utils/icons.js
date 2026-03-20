const fs = require('fs');
const path = require('path');
const { nativeImage } = require('electron');
const { fromProjectRoot } = require('./project-paths');

function getAppIconPath() {
  const iconCandidates = [
    fromProjectRoot('icons', 'icon.ico'),
    fromProjectRoot('icon.ico'),
    fromProjectRoot('tray.png'),
    fromProjectRoot('icons_trink', 'empty.png'),
  ];

  for (const iconPath of iconCandidates) {
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }

  return null;
}

function getTrayIcon() {
  const iconCandidates = [
    getAppIconPath(),
    fromProjectRoot('tray.png'),
    fromProjectRoot('icons_trink', 'empty.png'),
  ].filter(Boolean);

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

module.exports = {
  getAppIconPath,
  getTrayIcon,
};
