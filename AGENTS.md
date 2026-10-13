# ATLAS — guía para agentes

App web personal de gimnasio para un solo usuario, Seba: React + TypeScript + Vite + Dexie, local-first, PWA. Se usa en el celular, con una mano, siempre en el mismo gimnasio.

## Al empezar

1. Lee [docs/objetivos.json](docs/objetivos.json): objetivos personales y de la app, su estado y qué queda fuera de alcance.
2. Para el detalle de lo que falta, [docs/PENDIENTES.md](docs/PENDIENTES.md) (ítems numerados; el JSON los cita por número).
3. Si un pedido toca algo marcado `fuera_de_alcance` o necesitas el requisito original, consulta [docs/PROMPT_MAESTRO.md](docs/PROMPT_MAESTRO.md).

## Al terminar

Tu trabajo está cerrado cuando:

- `npm run typecheck` y `npm test` pasan; si cambiaste la interfaz, también `npm run e2e`.
- Cada objetivo que tu cambio movió tiene `estado`, `evidencia` y `actualizado` al día en `docs/objetivos.json`, y `docs/PENDIENTES.md` refleja lo resuelto o lo nuevo que falta.
- Si cambiaste clips o variantes, regeneraste `docs/COVERAGE_MATRIX.md` y `docs/MEDIA_MANIFEST.md` con `npm run docs:media` (son generados).

## Reglas del proyecto

- **Idioma:** español en la app, la documentación, los commits (`feat: …`, `fix: …`) y el chat con Seba.
- **Minimalismo:** interfaz clara (tema claro), simple y para una mano. Toda pantalla nueva se justifica contra el flujo Inicio → Día → Sesión. Las pantallas retiradas en el rediseño vuelven solo si Seba las pide.
- **Honestidad:** las animaciones, textos de técnica y roles musculares siguen `pending`/`unreviewed`; mantén esas etiquetas hasta que haya revisión profesional real. La app muestra solo datos registrados por Seba: sin historial, récords ni métricas inventadas.
- **Recursos:** sin pagos, suscripciones ni medios de terceros con licencia; las demostraciones son el rig SVG propio en `src/anatomy` (clips nuevos van en `src/anatomy/clips` y su registro).
- **Datos:** todo vive en el dispositivo (IndexedDB). Sin cuentas, backend ni analítica.
- **Fechas:** zona `America/Santiago`; las fechas de planificación son fechas locales `YYYY-MM-DD` (usa `src/domain/dates.ts`, que evita el corrimiento por UTC).
- **Git:** remoto `origin` en GitHub. Commit por unidad de trabajo; push solo cuando Seba lo pida.

## Trampas conocidas

- Editar `src/data/seed/routine.ts` **no** cambia una instalación existente: la siembra solo añade lo que falta. Un cambio de rutina necesita una migración del esquema Dexie o un editor.
- Las pruebas E2E usan Microsoft Edge instalado (`channel: 'msedge'`); Playwright no descarga navegadores.
