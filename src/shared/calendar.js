export const MAX_LEVEL = 4;
export const VISIBLE_MONTHS = 6;

// Meses antes do atual que continuam na tela depois que a janela começa a andar.
const MONTHS_BEHIND = 4;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const pad = (value) => String(value).padStart(2, '0');

export function nextLevel(level) {
  return (level + 1) % (MAX_LEVEL + 1);
}

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toMonthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function isMonthKey(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return toDateKey(new Date(year, month - 1, day)) === value;
}

// A janela fica parada no mês inicial e só anda quando o mês atual chega ao quinto da tela.
export function firstVisibleMonth(today, startMonth) {
  const current = toMonthKey(today);
  if (startMonth > current) return current;
  const rolling = toMonthKey(new Date(today.getFullYear(), today.getMonth() - MONTHS_BEHIND, 1));
  return startMonth > rolling ? startMonth : rolling;
}

export function buildGrid(today, startMonth) {
  const todayKey = toDateKey(today);
  const [year, month] = firstVisibleMonth(today, startMonth).split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const firstKey = toDateKey(first);
  const lastKey = toDateKey(new Date(year, month - 1 + VISIBLE_MONTHS, 0));
  const weeks = [];
  const months = [];

  do {
    const days = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      // Somar dias ao calendário, e não milissegundos, mantém o horário de verão correto.
      const date = new Date(year, month - 1, 1 - first.getDay() + weeks.length * 7 + weekday);
      const key = toDateKey(date);
      const isOutside = key < firstKey || key > lastKey;
      days.push({ key, isToday: key === todayKey, isFuture: key > todayKey, isOutside });
      if (date.getDate() === 1 && !isOutside) {
        months.push({ label: MONTHS[date.getMonth()], weekIndex: weeks.length });
      }
    }
    weeks.push(days);
  } while (weeks.at(-1)[6].key < lastKey);
  return { weeks, months };
}

export function formatDayLabel(key, level) {
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year} · ${level > 0 ? `nível ${level}` : 'sem registro'}`;
}

export function watchDayChange(onChange, now = () => new Date(), intervalMs = 60000) {
  let current = toDateKey(now());
  const timer = setInterval(() => {
    const key = toDateKey(now());
    if (key !== current) {
      current = key;
      onChange(key);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
