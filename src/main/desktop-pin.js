import { createRequire } from 'node:module';

const HWND_TOP = 0;
const SWP_NOSIZE = 0x0001;
const SWP_NOACTIVATE = 0x0010;
const LVM_GETITEMSPACING = 0x1033;
const SMTO_ABORTIFHUNG = 0x0002;
const EXPLORER_TIMEOUT_MS = 1000;

const require = createRequire(import.meta.url);
let api = null;

// Carrega sob demanda: se o koffi falhar, o widget ainda abre como janela normal.
function loadApi() {
  if (api) return api;
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  koffi.struct('POINT', { x: 'int', y: 'int' });
  koffi.struct('RECT', { left: 'int', top: 'int', right: 'int', bottom: 'int' });
  const EnumProc = koffi.proto('bool __stdcall EnumProc(uintptr_t hwnd, intptr_t lparam)');
  api = {
    koffi,
    EnumProc,
    FindWindowW: user32.func('uintptr_t __stdcall FindWindowW(str16 cls, str16 title)'),
    FindWindowExW: user32.func('uintptr_t __stdcall FindWindowExW(uintptr_t parent, uintptr_t after, str16 cls, str16 title)'),
    EnumWindows: user32.func('bool __stdcall EnumWindows(EnumProc *proc, intptr_t lparam)'),
    GetParent: user32.func('uintptr_t __stdcall GetParent(uintptr_t hwnd)'),
    SetParent: user32.func('uintptr_t __stdcall SetParent(uintptr_t child, uintptr_t parent)'),
    GetWindowRect: user32.func('bool __stdcall GetWindowRect(uintptr_t hwnd, _Out_ RECT *rect)'),
    ScreenToClient: user32.func('bool __stdcall ScreenToClient(uintptr_t hwnd, _Inout_ POINT *point)'),
    ClientToScreen: user32.func('bool __stdcall ClientToScreen(uintptr_t hwnd, _Inout_ POINT *point)'),
    SendMessageTimeoutW: user32.func('intptr_t __stdcall SendMessageTimeoutW(uintptr_t hwnd, uint32_t msg, uintptr_t wparam, intptr_t lparam, uint32_t flags, uint32_t timeout, _Out_ uintptr_t *result)'),
    SetWindowPos: user32.func('bool __stdcall SetWindowPos(uintptr_t hwnd, uintptr_t after, int x, int y, int cx, int cy, uint32_t flags)'),
  };
  return api;
}

// A camada dos ícones fica em Progman ou, com papel de parede em slideshow, em uma WorkerW.
function findDesktopView({ koffi, EnumProc, FindWindowW, FindWindowExW, EnumWindows }) {
  let view = FindWindowExW(FindWindowW('Progman', null), 0, 'SHELLDLL_DefView', null);
  if (view) return view;
  const callback = koffi.register((hwnd) => {
    view = FindWindowExW(hwnd, 0, 'SHELLDLL_DefView', null);
    return !view;
  }, koffi.pointer(EnumProc));
  EnumWindows(callback, 0);
  koffi.unregister(callback);
  return view;
}

// Depois de SetParent a posição é relativa à janela pai, que pode começar em coordenada negativa.
function placeAt(user32, hwnd, parent, screenPoint) {
  const point = { ...screenPoint };
  if (parent && !user32.ScreenToClient(parent, point)) throw new Error('ScreenToClient falhou');
  // HWND_TOP mantém o widget acima da lista de ícones, que é uma janela irmã: quem fica em cima recebe o clique.
  const placed = user32.SetWindowPos(hwnd, HWND_TOP, point.x, point.y, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE);
  if (!placed) throw new Error('SetWindowPos falhou');
}

const handleOf = (win) => win.getNativeWindowHandle().readBigUInt64LE(0);

// Filha da camada dos ícones: fica atrás das outras janelas, sobrevive ao Win+D e recebe cliques.
export function pinToDesktop(win) {
  try {
    const user32 = loadApi();
    const hwnd = handleOf(win);
    const view = findDesktopView(user32);
    if (!view) throw new Error('SHELLDLL_DefView não encontrada');
    const rect = {};
    if (!user32.GetWindowRect(hwnd, rect)) throw new Error('GetWindowRect falhou');
    if (!user32.SetParent(hwnd, view)) throw new Error('SetParent falhou');
    placeAt(user32, hwnd, view, { x: rect.left, y: rect.top });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

// A grade dos ícones começa na origem da camada, com o espaçamento que o Windows usa para o tamanho atual.
export function readDesktopGrid() {
  try {
    const user32 = loadApi();
    const view = findDesktopView(user32);
    const list = view && user32.FindWindowExW(view, 0, 'SysListView32', null);
    if (!list) throw new Error('Lista de ícones não encontrada');
    const result = [0];
    // Com tempo limite: um Explorer travado não pode travar o app junto.
    const sent = user32.SendMessageTimeoutW(list, LVM_GETITEMSPACING, 0, 0, SMTO_ABORTIFHUNG, EXPLORER_TIMEOUT_MS, result);
    if (!sent) throw new Error('Explorer não respondeu');
    const packed = Number(result[0]);
    const spacingX = packed % 0x10000;
    const spacingY = Math.floor(packed / 0x10000) % 0x10000;
    if (!spacingX || !spacingY) throw new Error('Espaçamento inválido');
    const origin = { x: 0, y: 0 };
    if (!user32.ClientToScreen(view, origin)) throw new Error('ClientToScreen falhou');
    return { ok: true, ...origin, spacingX, spacingY };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

export function moveOnDesktop(win, point) {
  try {
    const user32 = loadApi();
    const hwnd = handleOf(win);
    placeAt(user32, hwnd, user32.GetParent(hwnd), point);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}
