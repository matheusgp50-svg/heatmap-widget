import { app, Notification } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from './ipc.js';
import { createStore } from './store.js';
import { createTray } from './tray.js';
import { createWidgets } from './widgets.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.HEATMAP_DATA_DIR ?? join(app.getPath('appData'), 'heatmap-widgets');

// Mantém a referência: sem ela, o coletor de lixo remove o ícone da bandeja.
let tray = null;

app.setPath('userData', dataDir);
app.setAppUserModelId('com.heatmapwidgets.app');

function warn(message) {
  new Notification({ title: 'Heatmap Widgets', body: message }).show();
}

function start() {
  const store = createStore(join(dataDir, 'data.json'));
  const { status } = store.load();
  const widgets = createWidgets({ store, preloadPath: join(here, '..', 'preload.cjs'), warn });

  registerIpc({ store, widgets, warn });
  app.on('before-quit', () => widgets.allowClose());
  app.on('second-instance', () => widgets.openManager());

  // Em desenvolvimento isso registraria o electron.exe. Só o primeiro uso liga o padrão,
  // para reiniciar o app nunca religar o que o usuário desligou.
  if (app.isPackaged && status === 'new') app.setLoginItemSettings({ openAtLogin: true });

  tray = createTray({
    openManager: () => widgets.openManager(),
    quit: () => app.quit(),
    canToggleLogin: app.isPackaged,
  });

  widgets.openAll();
  if (store.list().length === 0) widgets.openManager();

  if (status === 'recovered') {
    warn('Os dados estavam corrompidos. Uma cópia foi guardada e o app iniciou vazio.');
  }
}

// Duas instâncias sobrescreveriam o mesmo arquivo de dados.
if (app.requestSingleInstanceLock()) {
  app.whenReady().then(start);
} else {
  app.quit();
}

// O app continua na bandeja mesmo sem janelas abertas.
app.on('window-all-closed', () => {});
