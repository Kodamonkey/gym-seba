import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useActiveSession } from './hooks';

/**
 * Aviso de nueva versión. Nunca se recarga sola: el usuario decide cuándo aplicar.
 * Si hay una sesión en curso, se recuerda que está guardada y se recuperará tras recargar.
 */
export function UpdatePrompt() {
  const active = useActiveSession();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  // El aviso de "listo sin conexión" es informativo: se retira solo.
  useEffect(() => {
    if (!offlineReady) return;
    const id = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;
  // Flotante: no desplaza el contenido mientras el usuario toca botones.
  return (
    <div className={`pointer-events-none fixed inset-x-0 ${active ? 'bottom-[calc(9rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'} z-40 px-4`} role="status">
      <div className="pointer-events-auto mx-auto flex max-w-md flex-wrap items-center gap-2 rounded-2xl bg-text py-2 pl-4 pr-2 text-sm text-bg shadow-xl">
        {needRefresh ? (
          <>
            <span className="flex-1 py-1.5">Nueva versión disponible.{active ? ' Tu entrenamiento queda guardado.' : ''}</span>
            <button type="button" className="min-h-11 rounded-full px-3 opacity-80 active:bg-white/15" onClick={() => setNeedRefresh(false)}>
              Después
            </button>
            <button type="button" className="min-h-11 rounded-full bg-bg px-4 font-semibold text-text" onClick={() => updateServiceWorker(true)}>
              Actualizar
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 py-1.5">Lista para usarse sin conexión.</span>
            <button type="button" className="min-h-11 rounded-full px-3 font-semibold active:bg-white/15" onClick={() => setOfflineReady(false)}>
              OK
            </button>
          </>
        )}
      </div>
    </div>
  );
}
