import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useActiveSession } from './hooks';
import { Button } from '../ui/primitives';

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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-4" role="status">
      <div className="pointer-events-auto mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm shadow-lg">
        {needRefresh ? (
          <>
            <span className="flex-1">
              Hay una nueva versión de la app.
              {active ? ' Tu sesión en curso está guardada y se recuperará al recargar; aplica cuando termines la serie.' : ''}
            </span>
            <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
              Aplicar actualización
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
              Más tarde
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1">La app quedó lista para abrirse sin conexión (tus datos y las demostraciones propias).</span>
            <Button size="sm" variant="ghost" onClick={() => setOfflineReady(false)}>
              Entendido
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
