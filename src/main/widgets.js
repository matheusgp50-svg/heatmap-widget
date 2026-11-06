import { BrowserWindow, screen } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinToDesktop } from './desktop-pin.js';
import { WIDGET_SIZE, resolvePosition } from './placement.js';
import { retryUntilOk } from './retry.js';

const here = dirname(fileURLToPath(import.meta.url));
const WIDGET_PAGE = join(here, '..', 'renderer', 'widget', 'widget.html');
const MANAGER_PAGE = join(here, '..', 'renderer', 'manager', 'manager.html');
const MANAGER_SIZE = { width: 520, height: 520 };
const REOPEN_DELAY_MS = 3000;
const REPLACE_DELAY_MS = 1000;
const PIN_RETRY = { times: 6, delayMs: 2000 };

// Soltar um arquivo sobre a janela trocaria a página do app pelo arquivo.
function keepPage(win) {
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

export function createWidgets({ store, preloadPath, warn }) {
  const windows = new Map();
  let manager = null;
  let closeAllowed = false;
  let replaceTimer = null;

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

    keepPage(win);
    win.once('ready-to-show', async () => {
      win.show();
      // Depois de reiniciar, o Explorer leva alguns segundos para recriar a camada dos ícones.
      const { ok } = await retryUntilOk(() => (win.isDestroyed() ? { ok: true } : pinToDesktop(win)), PIN_RETRY);
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

  // A posição do widget é relativa à camada dos ícones, que muda junto com os monitores.
  function replaceAll() {
    for (const [id, win] of [...windows]) {
      windows.delete(id);
      win.destroy();
      reopen(id);
    }
  }

  function scheduleReplace() {
    clearTimeout(replaceTimer);
    replaceTimer = setTimeout(replaceAll, REPLACE_DELAY_MS);
  }

  screen.on('display-added', scheduleReplace);
  screen.on('display-removed', scheduleReplace);
  screen.on('display-metrics-changed', (_event, _display, changed) => {
    if (changed.includes('bounds') || changed.includes('scaleFactor')) scheduleReplace();
  });

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
      keepPage(manager);
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
