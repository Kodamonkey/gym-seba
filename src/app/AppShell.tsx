import type { ReactNode } from 'react';
import { UpdatePrompt } from './UpdatePrompt';

/** Contenedor de una sola columna pensado para el teléfono. Cada pantalla trae su propio encabezado. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        Saltar al contenido
      </a>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <UpdatePrompt />
    </div>
  );
}
