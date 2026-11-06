import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach } from 'node:test';
import { _electron as electron } from 'playwright';

const TIMEOUT_MS = 8000;
const POLL_MS = 50;

const running = new Set();

// Um teste que falha não chega ao close; sem isto, o Electron prende o node --test.
afterEach(async () => {
  await Promise.allSettled([...running].map((app) => app.close()));
  running.clear();
});

const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

export async function waitFor(check, message) {
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Tempo esgotado: ${message}`);
    await sleep(POLL_MS);
  }
}

export function seedOne({ name = 'Treino', color = 'green', days = {}, position = null } = {}) {
  return { version: 1, heatmaps: [{ id: 'h1', name, color, position, days }] };
}

export async function launchApp(seed, dataDir = mkdtempSync(join(tmpdir(), 'heatmap-e2e-'))) {
  const file = join(dataDir, 'data.json');
  if (seed !== undefined) {
    writeFileSync(file, typeof seed === 'string' ? seed : JSON.stringify(seed));
  }
  const env = { ...process.env, HEATMAP_DATA_DIR: dataDir };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: [resolve('.')], env });
  running.add(app);
  return {
    app,
    dataDir,
    readData: () => JSON.parse(readFileSync(file, 'utf8')),
    async close({ keepData = false } = {}) {
      running.delete(app);
      await app.close();
      if (!keepData) rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

async function pageWithUrl(app, fragment) {
  const page = await waitFor(
    () => app.windows().find((item) => item.url().includes(fragment)),
    `janela ${fragment}`,
  );
  await page.waitForLoadState('domcontentloaded');
  return page;
}

export const widgetPage = (app) => pageWithUrl(app, 'widget.html');
export const managerPage = (app) => pageWithUrl(app, 'manager.html');

const FIRST_PLACE = { x: 40, y: 40 };

function savedPosition(t) {
  try {
    return t.readData().heatmaps[0].position;
  } catch {
    return null; // o arquivo pode estar sendo trocado neste instante
  }
}

// app.evaluate durante o SetParent derruba o Electron (só com o depurador do Playwright ligado).
// O encaixe grava uma posição nova logo depois de fixar, e isso avisa que já é seguro.
export async function pinnedWidget(t, unsnapped = FIRST_PLACE) {
  const page = await widgetPage(t.app);
  const position = await waitFor(() => {
    const saved = savedPosition(t);
    return saved && (saved.x !== unsnapped.x || saved.y !== unsnapped.y) && saved;
  }, 'widget fixado');
  return { page, position };
}

export function expectAttr(locator, name, value) {
  return waitFor(async () => (await locator.getAttribute(name)) === value, `${name}=${value}`);
}
