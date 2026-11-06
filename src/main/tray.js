import { Menu, Tray, app, nativeImage } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ICON = join(here, '..', '..', 'assets', 'icon.png');

export function createTray({ openManager, quit, canToggleLogin }) {
  const tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Heatmap Widgets');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Gerenciar heatmaps', click: openManager },
    {
      label: 'Iniciar com o Windows',
      type: 'checkbox',
      enabled: canToggleLogin,
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Sair', click: quit },
  ]));
  tray.on('click', openManager);
  return tray;
}
