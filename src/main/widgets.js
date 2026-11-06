import { BrowserWindow, screen } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinToDesktop } from './desktop-pin.js';
import { WIDGET_SIZE, resolvePosition } from './placement.js';

const here = dirname(fileURLToPath(import.meta.url));
const WIDGET_PAGE = join(here, '..', 'renderer', 'widget', 'widget.html');
const MANAGER_PAGE = join(here, '..', 'renderer', 'manager', 'manager.html');
const MANAGER_SIZE = { width: 520, height: 520 };
const REOPEN_DELAY_MS = 3000;

export function createWidgets({ store, preloadPath, warn }) {
  const windows = new Map();
  let manager = null;
  let closeAllowed = false;

  const webPreferences = { preload: preloadPath, contextIsolation: true, nodeIntegration: false };

  function placeFor(heatmap) {
    const index = store.list().findIndex((item) => item.id === heatmap.id);
    const position = resolvePosition(
      heatmap.position,
      screen.getAllDisplays(),
      screen.getPrimaryDisplay(),
      Math.max(index, 0),
    );
    if (!heatmap.position) store.update(heatmap.id, { position });
    return position;
  }

  function savePosition(id, win) {
    const [x, y] = win.getPosition();
    try {
      store.update(id, { position: { x, y } });
    } catch {
      warn('Não foi possível salvar a posição do widget.');
    }
  }

  function open(heatmap) {
    const win = new BrowserWindow({
      ...WIDGET_SIZE,
      ...placeFor(heatmap),
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      webPreferences,
    });
    windows.set(heatmap.id, win);
    win.loadFile(WIDGET_PAGE, { query: { id: heatmap.id } });

    win.once('ready-to-show', () => {
      win.show();
      const { ok } = pinToDesktop(win);
      if (!ok) warn('Não foi possível fixar o widget no fundo.');
    });
    win.on('moved', () => savePosition(heatmap.id, win));
    win.on('close', (event) => {
      // Alt+F4 não deve sumir com o widget.
      if (!closeAllowed && windows.get(heatmap.id) === win) event.preventDefault();
    });
    win.on('closed', () => {
      // Reiniciar o explorer.exe destrói a janela pai, e o widget vai junto.
      if (windows.get(heatmap.id) !== win) return;
      windows.delete(heatmap.id);
      if (!closeAllowed) setTimeout(() => reopen(heatmap.id), REOPEN_DELAY_MS);
    });
  }

  function reopen(id) {
    const heatmap = store.get(id);
    if (heatmap && !closeAllowed && !windows.has(id)) open(heatmap);
  }

  return {
    openAll() {
      store.list().forEach(open);
    },
    open,
    close(id) {
      const win = windows.get(id);
      windows.delete(id);
      win?.close();
    },
    openManager() {
      if (manager) {
        manager.show();
        manager.focus();
        return;
      }
      manager = new BrowserWindow({
        ...MANAGER_SIZE,
        title: 'Gerenciar heatmaps',
        autoHideMenuBar: true,
        backgroundColor: '#15171c',
        webPreferences,
      });
      manager.setMenu(null);
      manager.loadFile(MANAGER_PAGE);
      manager.on('closed', () => {
        manager = null;
      });
    },
    broadcast(channel, payload) {
      BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(channel, payload));
    },
    allowClose() {
      closeAllowed = true;
    },
  };
}
