process.env.TZ = 'America/New_York';

const { test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { nextLevel, toDateKey, isDateKey, buildGrid, formatDayLabel, watchDayChange } = await import('../../src/shared/calendar.js');
const { COLORS, PALETTES } = await import('../../src/shared/palettes.js');

test('nextLevel cicla de 0 a 4 e volta a 0', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((level) => nextLevel(level)), [1, 2, 3, 4, 0]);
});

test('toDateKey usa o fuso local', () => {
  assert.equal(toDateKey(new Date(2026, 10, 6, 23, 30)), '2026-11-06');
});

test('isDateKey recusa formato errado e data inexistente', () => {
  assert.equal(isDateKey('2026-11-06'), true);
  assert.equal(isDateKey('2028-02-29'), true);
  assert.equal(isDateKey('2026-02-29'), false);
  assert.equal(isDateKey('2026-13-01'), false);
  assert.equal(isDateKey('06/11/2026'), false);
  assert.equal(isDateKey(20261106), false);
});

test('grade tem 53 semanas de 7 dias, de domingo a sábado', () => {
  const { weeks } = buildGrid(new Date(2026, 10, 6)); // sexta
  assert.equal(weeks.length, 53);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks[0][0].key, '2025-11-02');
  assert.equal(weeks[52][6].key, '2026-11-07');
});

test('marca hoje e dias futuros', () => {
  const last = buildGrid(new Date(2026, 10, 6)).weeks[52];
  assert.equal(last[5].key, '2026-11-06');
  assert.equal(last[5].isToday, true);
  assert.equal(last[5].isFuture, false);
  assert.equal(last[6].isFuture, true);
});

test('dias são consecutivos atravessando horário de verão', () => {
  const keys = buildGrid(new Date(2026, 3, 15)).weeks.flat().map((d) => d.key);
  assert.equal(new Set(keys).size, 371);
  assert.ok(keys.includes('2026-03-08'));
  assert.ok(keys.includes('2025-11-02'));
});

test('ano bissexto e virada de ano', () => {
  const leap = buildGrid(new Date(2028, 2, 1)).weeks.flat().map((d) => d.key);
  assert.ok(leap.includes('2028-02-29'));
  const turn = buildGrid(new Date(2027, 0, 1)).weeks[52].map((d) => d.key);
  assert.deepEqual([turn[0], turn[6]], ['2026-12-27', '2027-01-02']);
});

test('rótulo do mês fica na coluna que contém o dia 1', () => {
  const { months } = buildGrid(new Date(2026, 10, 6));
  assert.deepEqual(months[0], { label: 'dez', weekIndex: 4 });
  assert.deepEqual(months.at(-1), { label: 'nov', weekIndex: 52 });
});

test('formatDayLabel mostra data e nível', () => {
  assert.equal(formatDayLabel('2026-11-06', 3), '06/11/2026 · nível 3');
  assert.equal(formatDayLabel('2026-11-06', 0), '06/11/2026 · sem registro');
});

test('watchDayChange avisa uma vez ao mudar o dia, mesmo depois de suspensão', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let current = new Date(2026, 10, 6, 23, 59);
  const calls = [];
  const stop = watchDayChange((key) => calls.push(key), () => current);
  t.mock.timers.tick(60000);
  assert.deepEqual(calls, []);
  current = new Date(2026, 10, 9, 8, 0); // acordou três dias depois
  t.mock.timers.tick(60000);
  t.mock.timers.tick(60000);
  assert.deepEqual(calls, ['2026-11-09']);
  stop();
});

test('paletas têm quatro tons para cada cor', () => {
  assert.deepEqual(COLORS, ['green', 'blue', 'purple', 'orange', 'red', 'teal']);
  assert.ok(COLORS.every((c) => PALETTES[c].length === 4));
});
