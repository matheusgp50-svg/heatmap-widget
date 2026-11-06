import koffi from 'koffi';

const SWP_NOSIZE = 0x0001;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;

const user32 = koffi.load('user32.dll');
const POINT = koffi.struct('POINT', { x: 'int', y: 'int' });
const RECT = koffi.struct('RECT', { left: 'int', top: 'int', right: 'int', bottom: 'int' });
const EnumProc = koffi.proto('bool __stdcall EnumProc(uintptr_t hwnd, intptr_t lparam)');
const FindWindowW = user32.func('uintptr_t __stdcall FindWindowW(str16 cls, str16 title)');
const FindWindowExW = user32.func('uintptr_t __stdcall FindWindowExW(uintptr_t parent, uintptr_t after, str16 cls, str16 title)');
const EnumWindows = user32.func('bool __stdcall EnumWindows(EnumProc *proc, intptr_t lparam)');
const SetParent = user32.func('uintptr_t __stdcall SetParent(uintptr_t child, uintptr_t parent)');
const GetWindowRect = user32.func('bool __stdcall GetWindowRect(uintptr_t hwnd, _Out_ RECT *rect)');
const ScreenToClient = user32.func('bool __stdcall ScreenToClient(uintptr_t hwnd, _Inout_ POINT *point)');
const SetWindowPos = user32.func('bool __stdcall SetWindowPos(uintptr_t hwnd, uintptr_t after, int x, int y, int cx, int cy, uint32_t flags)');

// A camada dos ícones fica em Progman ou, com papel de parede em slideshow, em uma WorkerW.
function findDesktopView() {
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
    const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0);
    const view = findDesktopView();
    if (!view) throw new Error('SHELLDLL_DefView não encontrada');
    const rect = {};
    if (!GetWindowRect(hwnd, rect)) throw new Error('GetWindowRect falhou');
    if (!SetParent(hwnd, view)) throw new Error('SetParent falhou');
    // Depois de SetParent a posição é relativa à janela pai, que pode começar em coordenada negativa.
    const point = { x: rect.left, y: rect.top };
    ScreenToClient(view, point);
    SetWindowPos(hwnd, 0, point.x, point.y, 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}
