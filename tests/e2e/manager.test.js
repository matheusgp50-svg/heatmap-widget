import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import electronPath from 'electron';
import { PALETTES } from '../../src/shared/palettes.js';
import { launchApp, managerPage, seedOne, waitFor, widgetPage } from './helpers.js';

const countWindows = (app) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);

async function openManager(t) {
  await t.app.evaluate(({ app }) => app.emit('second-instance'));
  return managerPage(t.app);
}

test('sem heatmaps, o gerenciamento abre sozinho', async () => {
  const t = await launchApp();
  assert.ok(await managerPage(t.app));
  await t.close();
});

test('com heatmaps, o gerenciamento não abre sozinho', async () => {
  const t = await launchApp(seedOne());
  await widgetPage(t.app);
  assert.equal(await countWindows(t.app), 1);
  await t.close();
});

test('criar um heatmap abre o widget e grava', async () => {
  const t = await launchApp();
  const page = await managerPage(t.app);
  await page.fill('#new-name', 'Estudo');
  await page.selectOption('#new-color', 'blue');
  await page.click('#create');
  const widget = await widgetPage(t.app);
  await waitFor(async () => (await widget.locator('#title').textContent()) === 'Estudo', 'título');
  const { heatmaps } = t.readData();
  assert.equal(heatmaps[0].color, 'blue');
  assert.ok(heatmaps[0].position);
  await page.locator('.heatmap-row').first().waitFor();
  await t.close();
});

test('nome vazio mostra erro e não cria nada', async () => {
  const t = await launchApp();
  const page = await managerPage(t.app);
  await page.fill('#new-name', '   ');
  await page.click('#create');
  await waitFor(() => page.locator('#error').isVisible(), 'erro visível');
  assert.equal(await page.locator('#error').textContent(), 'O nome precisa ter de 1 a 40 caracteres.');
  assert.deepEqual(t.readData().heatmaps, []);
  await t.close();
});

test('renomear e trocar a cor atualizam o widget aberto', async () => {
  const t = await launchApp(seedOne());
  const widget = await widgetPage(t.app);
  const page = await openManager(t);
  await page.fill('.rename', 'Corrida');
  await page.press('.rename', 'Enter');
  await page.selectOption('.color', 'red');
  await waitFor(async () => (await widget.locator('#title').textContent()) === 'Corrida', 'novo título');
  await waitFor(
    () => widget.evaluate(
      (tone) => document.body.style.getPropertyValue('--level-4') === tone,
      PALETTES.red[3],
    ),
    'nova cor',
  );
  await t.close();
});

test('excluir pede confirmação; cancelar mantém', async () => {
  const t = await launchApp(seedOne());
  await widgetPage(t.app);
  const page = await openManager(t);
  const messages = [];

  page.once('dialog', (dialog) => { messages.push(dialog.message()); dialog.dismiss(); });
  await page.click('.delete');
  await waitFor(() => messages.length === 1, 'diálogo');
  assert.equal(t.readData().heatmaps.length, 1);
  assert.equal(await countWindows(t.app), 2);

  page.once('dialog', (dialog) => dialog.accept());
  await page.click('.delete');
  await waitFor(() => t.readData().heatmaps.length === 0, 'heatmap excluído');
  await waitFor(async () => (await countWindows(t.app)) === 1, 'widget fechado');
  assert.equal(messages[0], 'Excluir "Treino"? O histórico deste tema será apagado.');
  await t.close();
});

test('nome com HTML aparece literalmente na lista', async () => {
  const t = await launchApp(seedOne({ name: '<b>x</b>' }));
  await widgetPage(t.app);
  const page = await openManager(t);
  await waitFor(async () => (await page.inputValue('.rename')) === '<b>x</b>', 'nome');
  assert.equal(await page.locator('.heatmap-row b').count(), 0);
  await t.close();
});

test('segunda instância encerra e abre o gerenciamento da primeira', async () => {
  const t = await launchApp(seedOne());
  await widgetPage(t.app);
  const opened = t.app.waitForEvent('window');
  const env = { ...process.env, HEATMAP_DATA_DIR: t.dataDir };
  delete env.ELECTRON_RUN_AS_NODE;
  const second = spawn(electronPath, ['.'], { env });
  const [code] = await once(second, 'exit');
  assert.equal(code, 0);
  assert.match((await opened).url(), /manager\.html/);
  await t.close();
});
