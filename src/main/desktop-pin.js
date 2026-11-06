import { createRequire } from 'node:module';

const HWND_TOP = 0;
const SWP_NOSIZE = 0x0001;
const SWP_NOACTIVATE = 0x0010;

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
    SetParent: user32.func('uintptr_t __stdcall SetParent(uintptr_t child, uintptr_t parent)'),
    GetWindowRect: user32.func('bool __stdcall GetWindowRect(uintptr_t hwnd, _Out_ RECT *rect)'),
    ScreenToClient: user32.func('bool __stdcall ScreenToClient(uintptr_t hwnd, _Inout_ POINT *point)'),
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

// Filha da camada dos ícones: fica atrás das outras janelas, sobrevive ao Win+D e recebe cliques.
export function pinToDesktop(win) {
  try {
    const user32 = loadApi();
    const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0);
    const view = findDesktopView(user32);
    if (!view) throw new Error('SHELLDLL_DefView não encontrada');
    const rect = {};
    if (!user32.GetWindowRect(hwnd, rect)) throw new Error('GetWindowRect falhou');
    if (!user32.SetParent(hwnd, view)) throw new Error('SetParent falhou');
    // Depois de SetParent a posição é relativa à janela pai, que pode começar em coordenada negativa.
    const point = { x: rect.left, y: rect.top };
    if (!user32.ScreenToClient(view, point)) throw new Error('ScreenToClient falhou');
    // HWND_TOP mantém o widget acima da lista de ícones, que é uma janela irmã: quem fica em cima recebe o clique.
    const placed = user32.SetWindowPos(hwnd, HWND_TOP, point.x, point.y, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE);
    if (!placed) throw new Error('SetWindowPos falhou');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}
