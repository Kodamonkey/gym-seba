import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useActiveSession, useOnline, usePrefs } from './hooks';
import { UpdatePrompt } from './UpdatePrompt';

const NAV = [
  { to: '/', label: 'Hoy', icon: '◉' },
  { to: '/rutina', label: 'Mi rutina', icon: '☰' },
  { to: '/calendario', label: 'Calendario', icon: '▦' },
  { to: '/progreso', label: 'Progreso', icon: '↗' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const online = useOnline();
  const prefs = usePrefs();
  const active = useActiveSession();
  const location = useLocation();
  const inSession = location.pathname === '/sesion';
  const onboarding = location.pathname === '/onboarding';
  const appName = prefs?.appName ?? 'ATLAS — Mi entrenamiento';

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
          <NavLink to="/" className="flex items-center gap-2 font-bold tracking-wide">
            <span aria-hidden className="text-accent">▲</span>
            <span>{appName.split('—')[0]?.trim() || appName}</span>
          </NavLink>
          <div className="flex items-center gap-1">
            {!online && (
              <span className="rounded-full bg-warn/15 px-2 py-1 text-xs font-medium text-warn" role="status">
                Sin conexión · tus datos se guardan en este dispositivo
              </span>
            )}
            <NavLink
              to="/ajustes"
              className={({ isActive }) => `inline-flex h-11 items-center rounded-lg px-3 text-sm ${isActive ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2'}`}
            >
              Perfil y ajustes
            </NavLink>
          </div>
        </div>
        {active && !inSession && !onboarding && (
          <NavLink to="/sesion" className="block border-t border-line bg-accent/15 px-4 py-2 text-center text-sm font-semibold text-accent">
            Sesión en curso: {active.title} · Continuar →
          </NavLink>
        )}
      </header>
      <UpdatePrompt />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4">
        {children}
      </main>
      {!onboarding && (
        <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <ul className="mx-auto grid max-w-5xl grid-cols-4">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs ${isActive ? 'font-semibold text-accent' : 'text-muted'}`
                  }
                >
                  <span aria-hidden className="text-lg leading-none">
                    {n.icon}
                  </span>
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
