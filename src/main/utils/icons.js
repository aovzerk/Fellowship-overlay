// Helpers for choosing application and tray icons.
const fs = require('fs');
const { nativeImage } = require('electron');
const { fromProjectRoot } = require('./project-paths');

// Try a few common icon locations and return the first existing file.
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

// Build a small native image for the system tray.
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
