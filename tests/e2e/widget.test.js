import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { formatDayLabel, toDateKey } from '../../src/shared/calendar.js';
import { expectAttr, launchApp, seedOne, waitFor, widgetPage } from './helpers.js';

const todayCell = (page) => page.locator(`.day[data-key="${toDateKey(new Date())}"]`);

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

test('dia futuro não reage ao clique', async (context) => {
  if (new Date().getDay() === 6) {
    context.skip('no sábado a última semana não tem dia futuro');
    return;
  }
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
  const seed = seedOne({ days: { [today]: 3 }, position: { x: 200, y: 120 } });
  const first = await launchApp(seed);
  await widgetPage(first.app);
  await first.close({ keepData: true });

  const second = await launchApp(undefined, first.dataDir);
  const page = await widgetPage(second.app);
  await expectAttr(todayCell(page), 'data-level', '3');
  const position = await second.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getPosition());
  assert.deepEqual(position, [200, 120]);
  await second.close();
});

test('dados corrompidos abrem vazio e guardam backup', async () => {
  const t = await launchApp('{oops');
  await waitFor(
    () => readdirSync(t.dataDir).some((name) => /^data\.corrupt-\d+\.json$/.test(name)),
    'backup',
  );
  assert.deepEqual(t.readData().heatmaps, []);
  await t.close();
});

test('widget destruído por fora é reaberto', async () => {
  const t = await launchApp(seedOne());
  await widgetPage(t.app);
  await t.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
  await waitFor(
    () => t.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length === 1),
    'widget reaberto',
  );
  await t.close();
});
