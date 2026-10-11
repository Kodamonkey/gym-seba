import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

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
      <div className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {items.map((t) => (
          <div
            key={t.id}
            className={`anim-fade pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${
              t.tone === 'error'
                ? 'border-danger bg-surface text-text'
                : t.tone === 'celebrate'
                  ? 'anim-celebrate border-accent bg-surface text-text'
                  : 'border-line bg-surface-2 text-text'
            }`}
          >
            <span className="flex-1 text-sm">
              {t.tone === 'error' && <strong className="text-danger">Error: </strong>}
              {t.tone === 'celebrate' && <span aria-hidden>★ </span>}
              {t.message}
            </span>
            {t.action && (
              <button
                type="button"
                className="min-h-10 rounded-lg px-3 font-semibold text-accent hover:bg-surface-3"
                onClick={async () => {
                  dismiss(t.id);
                  await t.action!.run();
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="h-9 w-9 rounded-lg text-muted hover:bg-surface-3" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
