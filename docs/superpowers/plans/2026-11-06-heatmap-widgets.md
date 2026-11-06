# Heatmap Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um app Electron para Windows 11 que mantém heatmaps de calendário fixos no fundo da área de trabalho, marcados com cliques.

**Architecture:** O processo principal é o único que lê e grava `data.json` e controla as janelas. Cada heatmap é uma janela sem moldura, e o gerenciamento abre pela bandeja. A lógica de datas e de posicionamento fica em módulos puros, testados sem Electron.

**Tech Stack:** Electron, JavaScript ESM (`"type": "module"`), `koffi` (API do Windows), `node:test`, Playwright (`_electron`) para testes de ponta a ponta, `electron-builder`.

**Spec:** `docs/superpowers/specs/2026-11-06-heatmap-widgets-design.md`

## Global Constraints

- Plataforma: Windows 11. Nada de código para outros sistemas.
- Toda a interface é em português do Brasil.
- Dados em `%APPDATA%/heatmap-widgets/data.json`, ou em `$HEATMAP_DATA_DIR/data.json` quando essa variável existir.
- Datas são chaves `AAAA-MM-DD` no fuso local. Nunca use `toISOString()` para gerar uma chave.
- `days` guarda inteiros de 1 a 4. Nível 0 nunca é gravado.
- Paletas: `green`, `blue`, `purple`, `orange`, `red`, `teal`.
- `name`: 1 a 40 caracteres depois de `trim()`. Nomes repetidos são permitidos.
- Janelas: `contextIsolation: true`, `nodeIntegration: false`, acesso só pelo `preload`.
- Texto do usuário entra no DOM só por `textContent`, nunca por `innerHTML`.
- O preload é `src/preload.cjs`, porque precisa ser CommonJS.
- Toda mensagem de commit termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Os exemplos abaixo a omitem para encurtar.

## Decisões deste plano que a spec deixou em aberto

- A semana começa no domingo, e a grade tem as linhas Dom a Sáb.
- O texto de "passar o mouse" aparece no rodapé do widget, em `#hover-info`. Um tooltip nativo poderia ficar atrás de outras janelas.
- A virada do dia é detectada por uma checagem a cada 60 s, e não por um timer até a meia-noite, porque esse timer falha com o PC suspenso.
- `src/main/placement.js` (puro) e `src/main/ipc.js` são módulos extras, para manter `widgets.js` pequeno e testável.
- Playwright entra como dependência de desenvolvimento, para testar o fluxo real de clique.

## Review Focus

1. **PC suspenso durante a meia-noite:** ao acordar, o widget passa a mostrar o novo dia em até 60 s. Teste na Task 2.
2. **App aberto duas vezes (login automático mais clique no atalho):** só uma instância existe, e a segunda abre o gerenciamento. Sem isso, duas instâncias sobrescrevem o mesmo arquivo. Teste na Task 5.
3. **Cliques rápidos no mesmo dia:** seis cliques seguidos terminam no nível 1, com tela e arquivo iguais. Teste na Task 4.
4. **Monitor à esquerda do principal (coordenadas negativas):** a posição é válida e o widget não é movido. Teste na Task 4.
5. **Nome com `<`, `&` ou 40 caracteres:** aparece literalmente e não quebra o layout. Testes nas Tasks 4 e 5.

---

### Task 1: Projeto base e teste de fixar no fundo

Esta task decide se o projeto continua. Ela não pode ser pulada nem adiada.

**Files:**
- Create: `package.json`, `src/main/desktop-pin.js`, `spike/main.js`, `spike/index.html` (temporários)
- Modify: `docs/superpowers/specs/2026-11-06-heatmap-widgets-design.md` (registrar o resultado)

**Interfaces:**
- Produces: `pinToDesktop(win: BrowserWindow) -> { ok: boolean, error?: string }` em `src/main/desktop-pin.js`. Não lança exceção: qualquer falha volta em `error`.

- [ ] **Step 1: Criar o `package.json` e instalar dependências**

Campos: `"name": "heatmap-widgets"`, `"productName": "Heatmap Widgets"`, `"version": "0.1.0"`, `"type": "module"`, `"main": "src/main/index.js"`.

Scripts:
- `"start": "electron ."`
- `"test": "node --test \"tests/unit/**/*.test.js\""`
- `"test:e2e": "node --test --test-concurrency=1 \"tests/e2e/**/*.test.js\""`

Run: `npm install koffi` e `npm install -D electron electron-builder playwright`
Expected: `node_modules/.bin/electron` existe.

- [ ] **Step 2: Implementar as duas técnicas em `src/main/desktop-pin.js`**

Use `koffi.load('user32.dll')`. Obtenha o HWND com `win.getNativeWindowHandle().readBigUInt64LE(0)`.
- Técnica A, `SetWindowPos(hwnd, HWND_BOTTOM=1, 0, 0, 0, 0, SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE)`, reaplicada nos eventos `focus` e `show`.
- Técnica B: envia `0x052C` a `Progman` com `SendMessageTimeoutW`, localiza o `WorkerW` com `EnumWindows` e chama `SetParent`.

Selecione a técnica pela variável `PIN_TECHNIQUE` só durante este teste.

- [ ] **Step 3: Criar o teste em `spike/`**

Uma janela de 740×170, sem moldura, transparente e com `skipTaskbar: true`, com um contador que soma 1 a cada clique. A janela chama `pinToDesktop` ao abrir.

- [ ] **Step 4: Verificar cada técnica**

Run: `$env:PIN_TECHNIQUE='A'; npx electron spike/main.js`, depois com `'B'`.

Para cada técnica, registre o resultado de:
1. A janela fica atrás de outra janela, mesmo depois de receber um clique.
2. Depois de `(New-Object -ComObject Shell.Application).ToggleDesktop()`, a janela continua visível. Confirme por captura de tela e peça ao usuário para conferir com `Win+D` real.
3. O contador continua subindo com cliques reais do usuário.
4. A janela sobrevive a reiniciar o `explorer.exe`. Este item é informativo e não reprova a técnica.

Expected: uma técnica passa nos itens 1 a 3.

**Se nenhuma técnica passar: PARE.** Relate os resultados ao usuário e aguarde a decisão dele. Não siga para a Task 2.

- [ ] **Step 5: Manter só a técnica vencedora**

Remova a outra técnica e `PIN_TECHNIQUE`. Apague `spike/`. Adicione à spec a seção `## Resultado do teste de fixar no fundo`, com a técnica escolhida, os resultados e as opções de janela necessárias (ex.: `focusable: false`).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/main/desktop-pin.js docs/superpowers/specs
git commit -m "feat: adiciona base do projeto e fixacao no fundo"
```

---

### Task 2: Lógica do calendário e paletas

**Files:**
- Create: `src/shared/calendar.js`, `src/shared/palettes.js`
- Test: `tests/unit/calendar.test.js`

**Interfaces:**
- Produces, em `calendar.js`:
  - `MAX_LEVEL = 4`
  - `nextLevel(level: number) -> number`
  - `toDateKey(date: Date) -> string`
  - `isDateKey(value: unknown) -> boolean`, que recusa datas inexistentes
  - `buildGrid(today: Date, weekCount = 53) -> { weeks: Day[][], months: { label: string, weekIndex: number }[] }`, com `Day = { key: string, isToday: boolean, isFuture: boolean }`
  - `formatDayLabel(key: string, level: number) -> string`
  - `watchDayChange(onChange: (key: string) => void, now = () => new Date(), intervalMs = 60000) -> () => void`, que devolve a função de parar
- Produces, em `palettes.js`: `COLORS: string[]` e `PALETTES: Record<string, [string, string, string, string]>`, com os tons dos níveis 1 a 4.

- [ ] **Step 1: Escrever os testes**

```js
// Coloque no topo, antes de qualquer Date
process.env.TZ = 'America/New_York';

test('nextLevel cicla de 0 a 4 e volta a 0', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(nextLevel), [1, 2, 3, 4, 0]);
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL, módulo não encontrado.

- [ ] **Step 3: Implementar `calendar.js` e `palettes.js`**

Gere os dias com `new Date(y, m, d + i)`, nunca somando milissegundos, para o horário de verão não repetir nem pular dias. Rótulos: `jan fev mar abr mai jun jul ago set out nov dez`.

As paletas vão sobre um cartão escuro semitransparente. Os tons sobem do escuro para o claro, e cada nível precisa ser distinguível do vizinho. Consulte a skill `dataviz` para a rampa sequencial.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared tests/unit/calendar.test.js
git commit -m "feat: adiciona logica do calendario e paletas"
```

---

### Task 3: Armazenamento

**Files:**
- Create: `src/main/store.js`
- Test: `tests/unit/store.test.js`

**Interfaces:**
- Consumes: `nextLevel`, `isDateKey`, `MAX_LEVEL`, `COLORS`.
- Produces: `createStore(filePath: string) -> Store`, com:
  - `load() -> { status: 'new' | 'ok' | 'recovered', corruptPath?: string }`
  - `list() -> Heatmap[]`
  - `get(id) -> Heatmap | undefined`
  - `create({ name, color }) -> Heatmap`
  - `update(id, { name?, color?, position? }) -> Heatmap`
  - `remove(id) -> void`
  - `cycleDay(id, key, todayKey) -> number`, que devolve o novo nível
  - `clearDay(id, key, todayKey) -> number`, que devolve `0`
- Erros: `StoreError` com `code` igual a `'NOT_FOUND'`, `'INVALID'` ou `'FUTURE_DAY'`. Falha de disco propaga o erro original.
- `create` gera `id` com `crypto.randomUUID()`, `days: {}` e `position: null`. Quem posiciona é a Task 4.

- [ ] **Step 1: Escrever os testes**

Cada teste usa `mkdtempSync`, com `file = join(dir, 'data.json')`.

```js
test('load cria o arquivo quando não existe', () => {
  const store = createStore(file);
  assert.deepEqual(store.load(), { status: 'new' });
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { version: 1, heatmaps: [] });
});

test('dados sobrevivem a recarregar', () => {
  const a = createStore(file); a.load();
  const h = a.create({ name: '  Treino ', color: 'green' });
  a.cycleDay(h.id, '2026-11-05', TODAY);
  const b = createStore(file);
  assert.equal(b.load().status, 'ok');
  assert.equal(b.get(h.id).name, 'Treino');
  assert.deepEqual(b.get(h.id).days, { '2026-11-05': 1 });
});

test('valida nome e cor', () => {
  const s = ready();
  assert.equal(s.create({ name: 'x'.repeat(40), color: 'red' }).name.length, 40);
  for (const input of [
    { name: '   ', color: 'red' },
    { name: 'x'.repeat(41), color: 'red' },
    { name: 'ok', color: 'pink' },
  ]) {
    assert.throws(() => s.create(input), { code: 'INVALID' });
  }
});

test('cycleDay percorre os níveis e nível 0 sai do arquivo', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  const levels = [1, 2, 3, 4, 5].map(() => s.cycleDay(id, TODAY, TODAY));
  assert.deepEqual(levels, [1, 2, 3, 4, 0]);
  assert.deepEqual(s.get(id).days, {});
});

test('clearDay limpa o dia', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  s.cycleDay(id, TODAY, TODAY);
  assert.equal(s.clearDay(id, TODAY, TODAY), 0);
  assert.deepEqual(s.get(id).days, {});
});

test('recusa dia futuro, data inválida e id desconhecido', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  assert.throws(() => s.cycleDay(id, '2026-11-07', TODAY), { code: 'FUTURE_DAY' });
  assert.throws(() => s.cycleDay(id, '2026-02-30', TODAY), { code: 'INVALID' });
  assert.throws(() => s.cycleDay('nope', TODAY, TODAY), { code: 'NOT_FOUND' });
});

test('dias antigos fora da grade continuam guardados', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  s.cycleDay(id, '2020-01-01', TODAY);
  s.cycleDay(id, TODAY, TODAY);
  assert.equal(s.get(id).days['2020-01-01'], 1);
});

for (const [label, content] of [
  ['JSON quebrado', '{oops'],
  ['arquivo vazio', ''],
  ['versão desconhecida', '{"version":2,"heatmaps":[]}'],
  ['nível inválido', JSON.stringify(withDay('2026-11-06', 9))],
  ['data inválida', JSON.stringify(withDay('2026-02-30', 1))],
]) {
  test(`recupera de ${label} sem perder o original`, () => {
    writeFileSync(file, content);
    const s = createStore(file);
    const result = s.load();
    assert.equal(result.status, 'recovered');
    assert.match(basename(result.corruptPath), /^data\.corrupt-\d+\.json$/);
    assert.equal(readFileSync(result.corruptPath, 'utf8'), content);
    assert.deepEqual(s.list(), []);
  });
}

test('falha ao gravar mantém o valor antigo', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  mkdirSync(`${file}.tmp`); // faz a gravação falhar
  assert.throws(() => s.cycleDay(id, TODAY, TODAY));
  assert.deepEqual(s.get(id).days, {});
  rmdirSync(`${file}.tmp`);
  assert.equal(s.cycleDay(id, TODAY, TODAY), 1);
});
```

`withDay(key, level)` monta um `data.json` válido com um heatmap cujo `days` é `{ [key]: level }`. `TODAY = '2026-11-06'`, e `ready()` devolve uma store já carregada.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL em `store.test.js`, módulo não encontrado.

- [ ] **Step 3: Implementar `src/main/store.js`**

Cada alteração aplica a mudança em uma cópia dos dados, grava, e só então troca o estado em memória. Por isso a falha ao gravar não altera nada.

Gravação síncrona: `writeFileSync(`${file}.tmp`)` e depois `renameSync`. A gravação síncrona mantém os cliques em ordem. Tente o `renameSync` até 3 vezes em `EPERM` ou `EBUSY`, porque antivírus e indexadores do Windows seguram arquivos por instantes.

Ao ler, remova um BOM inicial e valide todo o conteúdo: `version === 1`, cada campo de cada heatmap, chaves com `isDateKey` e níveis de 1 a `MAX_LEVEL`. `position` é `null` ou `{ x, y }` com números finitos. Qualquer problema segue o caminho `recovered`: renomeia o arquivo para `data.corrupt-<Date.now()>.json` e grava um novo vazio.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/store.js tests/unit/store.test.js
git commit -m "feat: adiciona armazenamento em json"
```

---

### Task 4: Widget funcionando de ponta a ponta

**Files:**
- Create: `src/main/placement.js`, `src/main/widgets.js`, `src/main/ipc.js`, `src/main/index.js`, `src/preload.cjs`, `src/renderer/widget/widget.html`, `widget.js`, `widget.css`
- Test: `tests/unit/placement.test.js`, `tests/e2e/helpers.js`, `tests/e2e/widget.test.js`

**Interfaces:**
- Consumes: `pinToDesktop`, `createStore`, `buildGrid`, `formatDayLabel`, `watchDayChange`, `toDateKey`, `PALETTES`.
- Produces:
  - `placement.js`: `WIDGET_SIZE = { width: 740, height: 170 }`, `resolvePosition(position, displays, primary, index = 0) -> { x, y }`. `displays` e `primary` usam `{ workArea: { x, y, width, height } }`.
  - `widgets.js`: `createWidgets({ store, preloadPath, warn }) -> { openAll(), open(heatmap), close(id), broadcast(channel, payload), allowClose() }`
  - `ipc.js`: `registerIpc({ store, widgets, warn }) -> void`
  - `index.js`: `dataDir` igual a `process.env.HEATMAP_DATA_DIR` ou a `join(app.getPath('appData'), 'heatmap-widgets')`. Chame `app.setPath('userData', dataDir)` antes de tudo.
  - `window.heatmap` no preload: `get(id)`, `list()`, `create(input)`, `update(id, patch)`, `remove(id)`, `cycleDay(id, key)`, `clearDay(id, key)`, `onChanged(callback)`
  - Canais: `heatmap:get`, `heatmap:list`, `heatmap:create`, `heatmap:update`, `heatmap:remove`, `heatmap:cycle-day`, `heatmap:clear-day`. O evento `heatmap:changed` vai a todas as janelas depois de qualquer alteração.
  - No DOM do widget: `#title`, `#hover-info` e células `.day[data-key][data-level]`. Dias futuros têm também a classe `.future`. Os tons da paleta ficam nas variáveis CSS `--level-1` a `--level-4`, definidas no `body`.
  - `tests/e2e/helpers.js`: `launchApp(seed?: object | string, dataDir?: string) -> { app, dataDir, readData(), close() }`, que define `HEATMAP_DATA_DIR` em uma pasta temporária, ou em `dataDir` quando informado; `seed` é gravado como `data.json` (string vai sem conversão); `seedOne({ name, color = "green", days = {}, position = null }) -> object`, que monta um `data.json` válido com um heatmap; `widgetPage(app) -> Page`.

- [ ] **Step 1: Escrever os testes de `placement`**

```js
const primary = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const left = { workArea: { x: -1920, y: 0, width: 1920, height: 1080 } };

test('mantém posição visível no monitor principal', () => {
  assert.deepEqual(resolvePosition({ x: 100, y: 80 }, [primary], primary), { x: 100, y: 80 });
});

test('aceita coordenadas negativas de monitor à esquerda', () => {
  const pos = { x: -1500, y: 100 };
  assert.deepEqual(resolvePosition(pos, [primary, left], primary), pos);
});

test('traz para o principal quando o monitor sumiu', () => {
  assert.deepEqual(resolvePosition({ x: -1500, y: 100 }, [primary], primary), { x: 40, y: 40 });
});

test('widget sem posição recebe posição em cascata', () => {
  assert.deepEqual(resolvePosition(null, [primary], primary, 2), { x: 100, y: 100 });
});

test('quase todo fora da tela volta para o principal', () => {
  assert.deepEqual(resolvePosition({ x: 1915, y: 100 }, [primary], primary), { x: 40, y: 40 });
});
```

Regra: a posição é válida se os primeiros 100 px de largura por 30 px de altura do widget, a faixa do título, estiverem inteiros em uma `workArea`. Posição nova: `workArea.x + 40 + 30 * index`, e o mesmo para `y`.

- [ ] **Step 2: Rodar, ver falhar, implementar `placement.js`, ver passar**

Run: `npm test`
Expected: FAIL primeiro, depois todos PASS.

- [ ] **Step 3: Escrever os testes de ponta a ponta**

```js
test('clique sobe o nível e grava; clique direito limpa', async () => {
  const t = await launchApp(seedOne({ name: 'Treino' }));
  const page = await widgetPage(t.app);
  const today = toDateKey(new Date());
  const cell = page.locator(`.day[data-key="${today}"]`);
  await cell.click();
  await expect(cell, 'data-level', '1');
  assert.equal((await t.readData()).heatmaps[0].days[today], 1);
  await cell.click({ button: 'right' });
  await expect(cell, 'data-level', '0');
  assert.deepEqual((await t.readData()).heatmaps[0].days, {});
  await t.close();
});

test('seis cliques rápidos terminam no nível 1', async () => {
  const t = await launchApp(seedOne({ name: 'Treino' }));
  const page = await widgetPage(t.app);
  const today = toDateKey(new Date());
  const cell = page.locator(`.day[data-key="${today}"]`);
  await Promise.all(Array.from({ length: 6 }, () => cell.click({ delay: 0 })));
  await expect(cell, 'data-level', '1');
  assert.equal((await t.readData()).heatmaps[0].days[today], 1);
  await t.close();
});

test('dia futuro não reage ao clique', async () => {
  // Semeie e procure .day.future. No sábado não há dia futuro: pule com t.skip().
});

test('passar o mouse mostra data e nível', async () => {
  // Hover em hoje: #hover-info contém formatDayLabel(today, 0).
});

test('nome com HTML aparece literalmente', async () => {
  const name = '<img src=x> & ' + 'x'.repeat(26);
  const t = await launchApp(seedOne({ name }));
  const page = await widgetPage(t.app);
  assert.equal(await page.locator('#title').textContent(), name);
  assert.equal(await page.locator('#title img').count(), 0);
  await t.close();
});

test('dados e posição voltam depois de reiniciar', async () => {
  // Semeie days com hoje=3 e position {x:200,y:120}. Confira data-level=3
  // e win.getPosition() por app.evaluate, depois de t.close() e novo launchApp
  // na mesma pasta.
});

test('dados corrompidos abrem vazio e guardam backup', async () => {
  // Semeie '{oops'. A pasta passa a ter data.corrupt-*.json, e o app não trava.
});
```

`expect(locator, attr, value)` é um auxiliar de `helpers.js` que espera o atributo chegar ao valor, com limite de 3 s.

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm run test:e2e`
Expected: FAIL, `src/main/index.js` não existe.

- [ ] **Step 5: Implementar o processo principal**

`index.js`: em `app.whenReady`, chama `store.load()`, registra o IPC e chama `widgets.openAll()`. Se o status for `recovered`, chama `warn`. `window-all-closed` tem um handler vazio, para o app seguir na bandeja. `warn(message)` usa `new Notification({ title: 'Heatmap Widgets', body: message }).show()`.

`widgets.js`: cada janela usa `frame: false`, `transparent: true`, `resizable: false`, `skipTaskbar: true`, `hasShadow: false` e as opções registradas na spec pela Task 1. Carrega `widget.html?id=<id>`. Depois de `ready-to-show`, chama `pinToDesktop` e, se `ok` for falso, chama `warn('Não foi possível fixar o widget no fundo.')`.
- A posição vem de `resolvePosition`, com `screen.getAllDisplays()`.
- No evento `moved`, grava com `store.update(id, { position })`.
- O evento `close` chama `preventDefault()`, para `Alt+F4` não sumir com o widget, exceto depois de `allowClose()`, chamado em `before-quit` e em `close(id)`.

`ipc.js`: `heatmap:cycle-day` e `heatmap:clear-day` passam `toDateKey(new Date())` como `todayKey`. Depois de alterar, faz broadcast de `heatmap:changed`. Se a gravação falhar, chama `warn('Não foi possível salvar. Tente de novo.')` e rejeita a chamada.

- [ ] **Step 6: Implementar o widget**

`widget.js` lê o `id` da URL, chama `heatmap.get(id)` e monta a grade com `buildGrid`. O clique chama `cycleDay` e pinta só o valor devolvido. Por isso a tela nunca fica à frente do que foi salvo. Ignore o clique em `.future`.

A fila de cliques é o próprio IPC, que é processado em ordem. Não adicione trava nem debounce. O teste de cliques rápidos prova que isso basta.

Layout: células de 11 px com intervalo de 2 px. O título tem `-webkit-app-region: drag` e elipse para nomes longos. A grade tem `no-drag`. O cartão usa fundo escuro semitransparente. O nível 0 usa `rgba(255,255,255,.08)`, e hoje recebe contorno. A cor vem de variáveis CSS definidas com `style.setProperty`. A legenda "Menos → Mais" e `#hover-info` ficam no rodapé.

`watchDayChange` remonta a grade. `onChanged` remonta quando chega uma mudança deste `id`.

CSP do HTML: `default-src 'self'`.

- [ ] **Step 7: Rodar tudo**

Run: `npm test; npm run test:e2e`
Expected: todos PASS.

- [ ] **Step 8: Conferir a aparência**

Semeie um heatmap com dias variados, rode `npm start` e tire uma captura de tela. Confira se título, meses, grade e legenda cabem em 740×170 sem cortes, em escala de tela de 100% e de 150%.

- [ ] **Step 9: Commit**

```bash
git add src tests
git commit -m "feat: adiciona widget de calendario com clique e persistencia"
```

---

### Task 5: Gerenciamento, bandeja e instância única

**Files:**
- Create: `src/main/tray.js`, `src/renderer/manager/manager.html`, `manager.js`, `manager.css`, `scripts/make-icon.js`, `assets/icon.png`
- Modify: `src/main/index.js`, `src/main/widgets.js`, `src/main/ipc.js`
- Test: `tests/e2e/manager.test.js`

**Interfaces:**
- Consumes: `window.heatmap`, `createWidgets`, `COLORS`, `PALETTES`, auxiliares de `tests/e2e/helpers.js`.
- Produces:
  - `widgets.openManager() -> void`, que foca a janela se já estiver aberta
  - `createTray({ openManager, quit, canToggleLogin }) -> Tray`
  - DOM do gerenciamento: `#new-name`, `#new-color`, `#create`, `#error`, `.heatmap-row`, `.rename`, `.color`, `.delete`
  - `managerPage(app) -> Page` em `tests/e2e/helpers.js`

- [ ] **Step 1: Escrever os testes**

```js
test('sem heatmaps, o gerenciamento abre sozinho', async () => {
  const t = await launchApp();
  assert.ok(await managerPage(t.app));
  await t.close();
});

test('criar um heatmap abre o widget e grava', async () => {
  const t = await launchApp();
  const page = await managerPage(t.app);
  await page.fill('#new-name', 'Estudo');
  await page.selectOption('#new-color', 'blue');
  await page.click('#create');
  const widget = await widgetPage(t.app);
  assert.equal(await widget.locator('#title').textContent(), 'Estudo');
  const { heatmaps } = await t.readData();
  assert.equal(heatmaps[0].color, 'blue');
  assert.ok(heatmaps[0].position);
  await t.close();
});

test('nome vazio mostra erro e não cria nada', async () => {
  // Clique em #create com '   ': #error fica visível e heatmaps continua vazio.
});

test('renomear e trocar a cor atualizam o widget aberto', async () => {
  // Altere .rename e .color: #title muda, e --level-4 passa a PALETTES.red[3].
});

test('excluir pede confirmação; cancelar mantém', async () => {
  // page.once('dialog', d => d.dismiss()): heatmap e widget continuam.
  // page.once('dialog', d => d.accept()): saem do arquivo e a janela fecha.
  // Confira o texto: 'Excluir "Treino"? O histórico deste tema será apagado.'
});

test('nome com HTML aparece literalmente na lista', async () => {
  // Semeie '<b>x</b>': .heatmap-row não contém elemento b.
});

test('segunda instância encerra e abre o gerenciamento da primeira', async () => {
  const t = await launchApp(seedOne({ name: 'Treino' }));
  const opened = t.app.waitForEvent('window');
  const second = spawn(electronPath, ['.'], {
    env: { ...process.env, HEATMAP_DATA_DIR: t.dataDir },
  });
  const [code] = await once(second, 'exit');
  assert.equal(code, 0);
  assert.match((await opened).url(), /manager\.html/);
  await t.close();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:e2e`
Expected: FAIL em `manager.test.js`.

- [ ] **Step 3: Gerar o ícone**

`scripts/make-icon.js` escreve um PNG de 256×256 só com `node:zlib`: uma grade 4×4 de quadrados em tons de verde. Rode e faça commit de `assets/icon.png`.

- [ ] **Step 4: Implementar a instância única**

Em `index.js`, depois de `setPath`: se `app.requestSingleInstanceLock()` for falso, chame `app.quit()` e pare. O evento `second-instance` chama `widgets.openManager()`.

- [ ] **Step 5: Implementar `manager.*` e os ajustes de IPC**

`heatmap:create` chama `store.create`, calcula a posição com `resolvePosition` usando `index = store.list().length - 1`, grava e abre o widget. `heatmap:remove` chama `widgets.close(id)`. `StoreError` com `code: 'INVALID'` aparece em `#error` como "O nome precisa ter de 1 a 40 caracteres."

A exclusão usa `window.confirm` com o texto do teste. Se a lista estiver vazia ao iniciar, `index.js` chama `openManager()`.

- [ ] **Step 6: Implementar `tray.js` e a inicialização com o Windows**

Menu: "Gerenciar heatmaps", "Iniciar com o Windows" (`type: 'checkbox'`, valor de `app.getLoginItemSettings().openAtLogin`) e "Sair". Clique no ícone abre o gerenciamento.

Só mexa em `setLoginItemSettings` com `app.isPackaged`. Em desenvolvimento, o item fica desativado, porque registraria o `electron.exe`. Ligue por padrão só quando `load()` devolver `status: 'new'`. Assim, reiniciar o app nunca religa o que o usuário desligou.

- [ ] **Step 7: Rodar tudo**

Run: `npm test; npm run test:e2e`
Expected: todos PASS.

- [ ] **Step 8: Commit**

```bash
git add src tests scripts assets
git commit -m "feat: adiciona gerenciamento, bandeja e instancia unica"
```

---

### Task 6: Instalador e verificação final

**Files:**
- Modify: `package.json`
- Create: `README.md`

**Interfaces:**
- Consumes: o app completo.
- Produces: `dist/Heatmap Widgets Setup <versão>.exe`.

- [ ] **Step 1: Configurar o `electron-builder`**

Em `package.json`, adicione o script `"dist": "electron-builder --win nsis"` e o bloco `build`:
- `appId: "com.heatmapwidgets.app"`
- `files: ["src/**", "assets/**", "package.json"]`
- `asarUnpack: ["node_modules/koffi/**"]`
- `win.icon: "assets/icon.png"`
- `nsis.oneClick: true`

- [ ] **Step 2: Gerar o instalador**

Run: `npm run dist`
Expected: o `.exe` aparece em `dist/`.

- [ ] **Step 3: Testar o app instalado**

Instale e confirme que `koffi` carrega no app empacotado: o widget fica no fundo, sem o aviso de falha. Confirme também que os dados vão para `%APPDATA%/heatmap-widgets/data.json`, e que "Iniciar com o Windows" vem marcado.

- [ ] **Step 4: Teste manual com o usuário**

Peça ao usuário para conferir e registre o resultado de cada item:
1. Criar um tema e marcar o dia com cliques.
2. Arrastar o widget.
3. Usar `Win+D`.
4. Reiniciar o PC: os widgets voltam na mesma posição, com os mesmos dados.
5. Desconectar um monitor, se houver um segundo.

Expected: todos os itens confirmados. Item que falhar volta como bug, antes de encerrar.

- [ ] **Step 5: Escrever o `README.md`**

Em português: o que é, como instalar, como usar (clique, clique direito, bandeja), onde ficam os dados e o aviso do SmartScreen, explicado na spec.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json README.md
git commit -m "feat: adiciona instalador e documentacao"
```
