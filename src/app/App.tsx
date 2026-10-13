import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { describeStorageError } from '../data/db';
import { ensureProgram } from '../data/overview';
import { ensureSeeded } from '../data/seed';
import { Loading } from '../ui/primitives';
import { ToastProvider } from '../ui/toast';
import { AppShell } from './AppShell';
import { usePrefs } from './hooks';
import { HomePage } from '../features/home/HomePage';

const DayPage = lazy(() => import('../features/day/DayPage').then((m) => ({ default: m.DayPage })));
const SessionPage = lazy(() => import('../features/session/SessionPage').then((m) => ({ default: m.SessionPage })));
const HistoryPage = lazy(() => import('../features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const SessionView = lazy(() => import('../features/history/SessionView').then((m) => ({ default: m.SessionView })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

/** Tema claro único; solo se respeta la preferencia de animaciones. */
function MotionSync() {
  const prefs = usePrefs();
  useEffect(() => {
    document.documentElement.dataset.motion = prefs?.animations ?? 'system';
  }, [prefs?.animations]);
  return null;
}

export function App() {
  const [ready, setReady] = useState<'loading' | 'ok' | string>('loading');
  useEffect(() => {
    ensureSeeded()
      .then(ensureProgram)
      .then(() => {
        setReady('ok');
        // Pide al navegador no borrar los datos por falta de espacio (silencioso; puede negarse).
        void navigator.storage?.persist?.().catch(() => undefined);
      })
      .catch((e) => setReady(describeStorageError(e)));
  }, []);

  if (ready === 'loading') return <Loading label="Preparando…" />;
  if (ready !== 'ok') {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="mb-2 text-xl font-semibold">No se pudo abrir el almacenamiento local</h1>
        <p className="text-muted">{ready}</p>
        <p className="mt-2 text-sm text-muted">Si usas navegación privada o bloqueaste el almacenamiento del sitio, la app no puede guardar tus entrenamientos.</p>
      </div>
    );
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <ToastProvider>
        <MotionSync />
        <AppShell>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dia/:dayId" element={<DayPage />} />
              <Route path="/sesion" element={<SessionPage />} />
              <Route path="/historial" element={<HistoryPage />} />
              <Route path="/historial/:sessionId" element={<SessionView />} />
              <Route path="/ajustes" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
      </ToastProvider>
    </BrowserRouter>
  );
}
