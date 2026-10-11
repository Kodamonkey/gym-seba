import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { describeStorageError } from '../data/db';
import { ensureSeeded } from '../data/seed';
import { Loading } from '../ui/primitives';
import { ToastProvider } from '../ui/toast';
import { AppShell } from './AppShell';
import { usePrefs, useProfile } from './hooks';
import { TodayPage } from '../features/today/TodayPage';

const SessionPage = lazy(() => import('../features/session/SessionPage').then((m) => ({ default: m.SessionPage })));
const RoutinePage = lazy(() => import('../features/routine/RoutinePage').then((m) => ({ default: m.RoutinePage })));
const DayEditor = lazy(() => import('../features/routine/DayEditor').then((m) => ({ default: m.DayEditor })));
const VariantDetail = lazy(() => import('../features/routine/VariantDetail').then((m) => ({ default: m.VariantDetail })));
const CalendarPage = lazy(() => import('../features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const SessionDetail = lazy(() => import('../features/calendar/SessionDetail').then((m) => ({ default: m.SessionDetail })));
const ProgressPage = lazy(() => import('../features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SourcesPage = lazy(() => import('../features/settings/SourcesPage').then((m) => ({ default: m.SourcesPage })));
const Onboarding = lazy(() => import('../features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })));
const DemoGallery = lazy(() => import('../features/library/DemoGallery').then((m) => ({ default: m.DemoGallery })));

const DEFAULT_ACCENT = '#3ddc97';

function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0.5;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

function ThemeSync() {
  const prefs = usePrefs();
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const theme = prefs?.theme ?? 'dark';
      const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
      root.dataset.theme = resolved;
      root.dataset.motion = prefs?.animations ?? 'system';
      // El acento por defecto usa el tono de cada tema; uno personalizado se aplica con tinta legible.
      const custom = prefs?.accent && prefs.accent.toLowerCase() !== DEFAULT_ACCENT;
      if (custom) {
        root.style.setProperty('--accent', prefs!.accent);
        root.style.setProperty('--accent-ink', relativeLuminance(prefs!.accent) > 0.35 ? '#062b1b' : '#ffffff');
      } else {
        root.style.removeProperty('--accent');
        root.style.removeProperty('--accent-ink');
      }
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f3f4f6' : '#16181c');
      document.title = prefs?.appName ?? 'ATLAS — Mi entrenamiento';
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [prefs]);
  return null;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const profile = useProfile();
  const location = useLocation();
  if (profile === undefined) return <Loading />;
  const needs = !profile?.onboardedAt;
  const allowed = ['/onboarding', '/fuentes', '/demos', '/ajustes'];
  if (needs && !allowed.includes(location.pathname)) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export function App() {
  const [ready, setReady] = useState<'loading' | 'ok' | string>('loading');
  useEffect(() => {
    ensureSeeded()
      .then(() => setReady('ok'))
      .catch((e) => setReady(describeStorageError(e)));
  }, []);

  if (ready === 'loading') return <Loading label="Preparando tus datos locales…" />;
  if (ready !== 'ok') {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="mb-2 text-xl font-semibold">No se pudo abrir el almacenamiento local</h1>
        <p className="text-muted">{ready}</p>
        <p className="mt-2 text-sm text-faint">
          Si usas navegación privada o bloqueaste el almacenamiento del sitio, ATLAS no puede guardar tus entrenamientos.
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <ToastProvider>
        <ThemeSync />
        <OnboardingGate>
          <AppShell>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<TodayPage />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/sesion" element={<SessionPage />} />
                <Route path="/rutina" element={<RoutinePage />} />
                <Route path="/rutina/dia/:dayId" element={<DayEditor />} />
                <Route path="/biblioteca/:variantId" element={<VariantDetail />} />
                <Route path="/calendario" element={<CalendarPage />} />
                <Route path="/historial/:sessionId" element={<SessionDetail />} />
                <Route path="/progreso" element={<ProgressPage />} />
                <Route path="/ajustes" element={<SettingsPage />} />
                <Route path="/fuentes" element={<SourcesPage />} />
                <Route path="/demos" element={<DemoGallery />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AppShell>
        </OnboardingGate>
      </ToastProvider>
    </BrowserRouter>
  );
}
