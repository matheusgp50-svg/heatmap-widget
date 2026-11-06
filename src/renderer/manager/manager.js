import { COLORS } from '../../shared/palettes.js';

const COLOR_LABELS = {
  green: 'Verde',
  blue: 'Azul',
  purple: 'Roxo',
  orange: 'Laranja',
  red: 'Vermelho',
  teal: 'Turquesa',
};

const form = document.getElementById('create-form');
const newName = document.getElementById('new-name');
const newColor = document.getElementById('new-color');
const error = document.getElementById('error');
const list = document.getElementById('list');
const empty = document.getElementById('empty');

function colorOptions(select, selected) {
  select.replaceChildren(...COLORS.map((color) => {
    const option = document.createElement('option');
    option.value = color;
    option.textContent = COLOR_LABELS[color];
    option.selected = color === selected;
    return option;
  }));
}

function showError(failure) {
  error.textContent = String(failure?.message).includes('Nome inválido')
    ? 'O nome precisa ter de 1 a 40 caracteres.'
    : 'Não foi possível salvar. Tente de novo.';
  error.hidden = false;
}

async function run(action) {
  error.hidden = true;
  try {
    await action();
  } catch (failure) {
    showError(failure);
  }
  await render();
}

function row({ id, name, color }) {
  const item = document.createElement('li');
  item.className = 'heatmap-row';

  const rename = document.createElement('input');
  rename.className = 'rename';
  rename.value = name;
  rename.maxLength = 40;
  rename.setAttribute('aria-label', 'Nome do tema');
  rename.addEventListener('change', () => run(() => window.heatmap.update(id, { name: rename.value })));

  const select = document.createElement('select');
  select.className = 'color';
  select.setAttribute('aria-label', 'Cor');
  colorOptions(select, color);
  select.addEventListener('change', () => run(() => window.heatmap.update(id, { color: select.value })));

  const remove = document.createElement('button');
  remove.className = 'delete';
  remove.type = 'button';
  remove.textContent = 'Excluir';
  remove.addEventListener('click', () => {
    if (window.confirm(`Excluir "${name}"? O histórico deste tema será apagado.`)) {
      run(() => window.heatmap.remove(id));
    }
  });

  item.append(rename, select, remove);
  return item;
}

async function render() {
  const heatmaps = await window.heatmap.list();
  list.replaceChildren(...heatmaps.map(row));
  empty.hidden = heatmaps.length > 0;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  run(async () => {
    await window.heatmap.create({ name: newName.value, color: newColor.value });
    newName.value = '';
  });
});

colorOptions(newColor, COLORS[0]);
render();
