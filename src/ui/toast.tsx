import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CloseIcon } from './icons';

/**
 * Avisos breves con acción opcional (p. ej. "Deshacer"). Los mensajes de éxito solo se
 * emiten después de que la operación terminó; los errores persisten hasta cerrarlos.
 */

export interface ToastInput {
  message: string;
  tone?: 'info' | 'ok' | 'error' | 'celebrate';
  action?: { label: string; run: () => void | Promise<void> };
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const Ctx = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      const ms = t.durationMs ?? (t.tone === 'error' ? 0 : t.action ? 7000 : 3500);
      if (ms > 0) setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {items.map((t) => (
          <div
            key={t.id}
            className={`anim-fade pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl py-2 pl-4 pr-2 text-sm shadow-xl ${
              t.tone === 'error' ? 'bg-danger text-white' : 'bg-text text-bg'
            }`}
          >
            <span className="flex-1 py-1.5">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="min-h-11 rounded-full px-3 font-semibold underline-offset-2 active:bg-white/15"
                onClick={async () => {
                  dismiss(t.id);
                  await t.action!.run();
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-70 active:bg-white/15" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
              <CloseIcon size={18} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
