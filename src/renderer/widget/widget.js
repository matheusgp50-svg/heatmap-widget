import { buildGrid, formatDayLabel, watchDayChange } from '../../shared/calendar.js';
import { PALETTES } from '../../shared/palettes.js';

const CELL_STEP = 13;
const id = new URLSearchParams(location.search).get('id');
const title = document.getElementById('title');
const grid = document.getElementById('grid');
const months = document.getElementById('months');
const hoverInfo = document.getElementById('hover-info');

let heatmap = null;

function renderGrid() {
  const { weeks, months: labels } = buildGrid(new Date());

  months.replaceChildren(...labels.map(({ label, weekIndex }) => {
    const span = document.createElement('span');
    span.textContent = label;
    span.style.left = `${weekIndex * CELL_STEP}px`;
    return span;
  }));

  grid.replaceChildren(...weeks.flat().map(({ key, isToday, isFuture }) => {
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.classList.toggle('today', isToday);
    cell.classList.toggle('future', isFuture);
    cell.dataset.key = key;
    cell.dataset.level = '0';
    return cell;
  }));
}

function paint() {
  title.textContent = heatmap.name;
  PALETTES[heatmap.color].forEach((tone, index) => {
    document.body.style.setProperty(`--level-${index + 1}`, tone);
  });
  for (const cell of grid.children) {
    cell.dataset.level = String(heatmap.days[cell.dataset.key] ?? 0);
  }
}

async function refresh() {
  const latest = await window.heatmap.get(id);
  if (!latest) return;
  heatmap = latest;
  paint();
}

// A tela só muda com o valor devolvido pelo processo principal, depois de gravado.
async function applyLevel(cell, request) {
  if (!cell || cell.classList.contains('future')) return;
  try {
    const level = await request(id, cell.dataset.key);
    cell.dataset.level = String(level);
    showHover(cell);
  } catch {
    // O processo principal já avisou; a célula mantém o valor salvo.
  }
}

function showHover(cell) {
  if (cell.matches(':hover')) {
    hoverInfo.textContent = formatDayLabel(cell.dataset.key, Number(cell.dataset.level));
  }
}

const cellFrom = (event) => event.target.closest('.day');

grid.addEventListener('click', (event) => applyLevel(cellFrom(event), window.heatmap.cycleDay));
grid.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  applyLevel(cellFrom(event), window.heatmap.clearDay);
});
grid.addEventListener('mouseover', (event) => {
  const cell = cellFrom(event);
  if (cell) showHover(cell);
});
grid.addEventListener('mouseleave', () => {
  hoverInfo.textContent = '';
});

window.heatmap.onChanged((change) => {
  if (change.id === id) refresh();
});

watchDayChange(() => {
  renderGrid();
  refresh();
});

renderGrid();
refresh();
