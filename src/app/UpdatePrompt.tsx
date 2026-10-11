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

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="mx-auto mt-2 w-full max-w-5xl px-4" role="status">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
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
