import type { TrayLike, TrayManager, TrayManagerDeps } from '../../types/main-process';

function createTrayManager({
  app,
  Menu,
  Tray,
  getTrayIcon,
  getWindow,
  hideToTray,
  onQuit,
  openSettingsWindow,
  showWindow,
  t,
}: TrayManagerDeps): TrayManager {
  let tray: TrayLike | null = null;

  function createTray(): TrayLike {
    if (tray) return tray;

    tray = new Tray(getTrayIcon());
    tray.setToolTip(t('trayTooltip'));

    const buildMenu = (): unknown => Menu.buildFromTemplate([
      {
        label: getWindow()?.isVisible() ? t('trayHide') : t('trayShow'),
        click: () => {
          const win = getWindow();
          if (!win) return;
          if (win.isVisible()) hideToTray();
          else showWindow();
        },
      },
      {
        label: t('traySettings'),
        click: () => openSettingsWindow(),
      },
      { type: 'separator' },
      { label: t('trayExit'), click: () => { onQuit(); app.quit(); } },
    ]);

    tray.on('click', () => {
      const win = getWindow();
      if (!win) return;
      if (win.isVisible()) hideToTray();
      else showWindow();
    });

    tray.on('right-click', () => {
      tray?.popUpContextMenu(buildMenu());
    });

    return tray;
  }

  return {
    createTray,
    getTray(): TrayLike | null {
      return tray;
    },
    refreshTrayTooltip(): void {
      tray?.setToolTip(t('trayTooltip'));
    },
  };
}

export {
  createTrayManager,
};
