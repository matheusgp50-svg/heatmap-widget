import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import electronPath from 'electron';
import { formatDayLabel, toDateKey, toMonthKey } from '../../src/shared/calendar.js';
import { expectAttr, launchApp, pinnedWidget, seedOne, waitFor, widgetPage } from './helpers.js';

const todayCell = (page) => page.locator(`.day[data-key="${toDateKey(new Date())}"]`);
const windowPosition = (app) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getPosition());

test('clique sobe o nível e grava; clique direito limpa', async () => {
  const t = await launchApp(seedOne());
  const page = await widgetPage(t.app);
  const today = toDateKey(new Date());
  const cell = todayCell(page);
  await cell.click();
  await expectAttr(cell, 'data-level', '1');
  assert.equal(t.readData().heatmaps[0].days[today], 1);
  await cell.click({ button: 'right' });
  await expectAttr(cell, 'data-level', '0');
  assert.deepEqual(t.readData().heatmaps[0].days, {});
  await t.close();
});

test('seis cliques rápidos terminam no nível 1', async () => {
  const t = await launchApp(seedOne());
  const page = await widgetPage(t.app);
  const today = toDateKey(new Date());
  const cell = todayCell(page);
  await Promise.all(Array.from({ length: 6 }, () => cell.click({ delay: 0 })));
  await expectAttr(cell, 'data-level', '1');
  assert.equal(t.readData().heatmaps[0].days[today], 1);
  await t.close();
});

test('dia futuro não reage ao clique', async () => {
  const t = await launchApp(seedOne());
  const page = await widgetPage(t.app);
  const cell = page.locator('.day.future').first();
  await cell.click({ force: true });
  await todayCell(page).click();
  await expectAttr(todayCell(page), 'data-level', '1');
  assert.equal(await cell.getAttribute('data-level'), '0');
  assert.equal(Object.keys(t.readData().heatmaps[0].days).length, 1);
  await t.close();
});

test('passar o mouse mostra data e nível', async () => {
  const t = await launchApp(seedOne());
  const page = await widgetPage(t.app);
  await todayCell(page).hover();
  const expected = formatDayLabel(toDateKey(new Date()), 0);
  await waitFor(async () => (await page.locator('#hover-info').textContent()) === expected, 'hover');
  await t.close();
});

test('nome com HTML aparece literalmente', async () => {
  const name = `<img src=x> & ${'x'.repeat(26)}`;
  const t = await launchApp(seedOne({ name }));
  const page = await widgetPage(t.app);
  await waitFor(async () => (await page.locator('#title').textContent()) === name, 'título');
  assert.equal(await page.locator('#title img').count(), 0);
  await t.close();
});

test('dados e posição voltam depois de reiniciar', async () => {
  const today = toDateKey(new Date());
  const start = { x: 200, y: 120 };
  const first = await launchApp(seedOne({ days: { [today]: 3 }, position: start }));
  const { position } = await pinnedWidget(first, start);
  await first.close({ keepData: true });

  const second = await launchApp(undefined, first.dataDir);
  const page = await widgetPage(second.app);
  await expectAttr(todayCell(page), 'data-level', '3');
  await waitFor(
    () => page.evaluate(({ x, y }) => screenX === x && screenY === y, position),
    'widget na posição salva',
  );
  await second.close();
});

test('o widget cabe no tamanho reduzido sem cortar a grade', async () => {
  const t = await launchApp(seedOne());
  const { page } = await pinnedWidget(t);
  await page.locator('.day').first().waitFor();
  const [width] = await t.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getSize());
  assert.equal(width, 380);
  const overflow = await page.evaluate(() => {
    const card = document.querySelector('.card');
    return [card.scrollWidth - card.clientWidth, card.scrollHeight - card.clientHeight];
  });
  assert.deepEqual(overflow, [0, 0]);
  await t.close();
});

test('heatmap antigo ganha o mês atual e mostra só seis meses', async () => {
  const t = await launchApp(seedOne());
  const page = await widgetPage(t.app);
  await page.locator('.day').first().waitFor();
  assert.equal(t.readData().heatmaps[0].startMonth, toMonthKey(new Date()));
  assert.equal(await page.locator('#months span').count(), 6);
  await t.close();
});

test('dia fora dos seis meses não reage ao mouse', async (context) => {
  const seed = seedOne();
  seed.heatmaps[0].startMonth = toMonthKey(new Date());
  const t = await launchApp(seed);
  const page = await widgetPage(t.app);
  await page.locator('.day').first().waitFor();
  const cell = page.locator('.day.outside').first();
  if (await cell.count() === 0) {
    context.skip('esta janela de seis meses preenche todas as semanas');
    await t.close();
    return;
  }
  await cell.click({ force: true });
  await todayCell(page).click();
  await expectAttr(todayCell(page), 'data-level', '1');
  assert.equal(Object.keys(t.readData().heatmaps[0].days).length, 1);
  await t.close();
});

test('soltar fora da grade volta para a posição encaixada e grava', async () => {
  const start = { x: 230, y: 310 };
  const t = await launchApp(seedOne({ position: start }));
  const { position: { x, y } } = await pinnedWidget(t, start);
  await t.app.evaluate(({ BrowserWindow }, target) => {
    const [win] = BrowserWindow.getAllWindows();
    win.setPosition(target.x, target.y);
    win.emit('moved');
  }, { x: x + 20, y: y + 20 });
  await waitFor(async () => {
    const [nowX, nowY] = await windowPosition(t.app);
    return nowX === x && nowY === y;
  }, 'widget de volta à grade');
  assert.deepEqual(t.readData().heatmaps[0].position, { x, y });
  await t.close();
});

test('dados corrompidos abrem vazio e guardam backup', async () => {
  const t = await launchApp('{oops');
  await waitFor(
    () => readdirSync(t.dataDir).some((name) => /^data\.corrupt-\d+\.json$/.test(name)),
    'backup',
  );
  await waitFor(() => existsSync(join(t.dataDir, 'data.json')), 'arquivo novo');
  assert.deepEqual(t.readData().heatmaps, []);
  await t.close();
});

test('o widget não sai da própria página', async () => {
  const t = await launchApp(seedOne());
  const page = await widgetPage(t.app);
  await page.evaluate(() => { location.href = new URL('widget.css', location.href).href; }); // o mesmo que soltar um arquivo
  await new Promise((done) => { setTimeout(done, 500); });
  assert.match(page.url(), /widget\.html/);
  await t.close();
});

test('mudança de monitores recoloca os widgets', async () => {
  const start = { x: 200, y: 120 };
  const t = await launchApp(seedOne({ position: start }));
  await pinnedWidget(t, start);
  const windowId = () => t.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.id);
  const before = await windowId();
  await t.app.evaluate(({ screen }) => screen.emit('display-removed'));
  await waitFor(async () => {
    const id = await windowId();
    return id !== undefined && id !== before;
  }, 'widget recolocado');
  await t.close();
});

test('falha ao iniciar encerra o app em vez de ficar invisível', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'heatmap-e2e-'));
  mkdirSync(join(dataDir, 'data.json')); // faz a leitura falhar
  const env = { ...process.env, HEATMAP_DATA_DIR: dataDir };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = spawn(electronPath, ['.'], { env, stdio: 'ignore' });
  const timer = setTimeout(() => app.kill(), 15000);
  const [code] = await once(app, 'exit');
  clearTimeout(timer);
  assert.equal(code, 1);
  rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test('widget destruído por fora é reaberto', async () => {
  const t = await launchApp(seedOne());
  await pinnedWidget(t);
  await t.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
  await waitFor(
    () => t.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length === 1),
    'widget reaberto',
  );
  await t.close();
});
