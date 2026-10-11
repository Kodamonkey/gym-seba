# ATLAS — Mi entrenamiento

Aplicación web personal, *mobile-first* y *local-first* para entrenar en el gimnasio: ver la sesión del día, observar una demostración anatómica (persona + equipo + músculos resaltados sobre su propio cuerpo), registrar series con pocos toques, descansar con un temporizador recuperable y revisar el progreso y los récords.

- Sin cuenta, sin backend, sin analítica: los datos viven en el navegador (IndexedDB).
- Funciona sin conexión después de abrirla una vez (PWA con service worker).
- Rutina inicial de 8 semanas y 4 días (superior/inferior) precargada y editable.
- 39 demostraciones anatómicas propias (SVG animado en vivo) para todas las variantes principales y alternativas.

> **Estado honesto.** Las animaciones, los textos de técnica y las asociaciones musculares fueron creados por este proyecto y **no tienen revisión biomecánica profesional**. No se compraron ni incorporaron medios de terceros. La rutina es la configuración acordada para la app, no una prescripción médica. Ver [docs/PENDIENTES.md](docs/PENDIENTES.md).

## Requisitos

- Node.js 20.19 o superior (probado con Node 24.19 y npm 11.17).
- Para las pruebas E2E: Microsoft Edge instalado (Playwright usa `channel: 'msedge'`; no descarga navegadores).

## Instalación y desarrollo

```bash
npm install
```

```bash
npm run dev
```

Abre `http://localhost:5173`. La primera vez se muestra la configuración inicial (datos, fecha de inicio del programa y medición inicial).

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite). |
| `npm run typecheck` | Comprobación de tipos (TypeScript, sin emitir). |
| `npm test` | Pruebas unitarias e integración (Vitest + fake-indexeddb). |
| `npm run e2e` | Construye, sirve con `vite preview` y ejecuta Playwright con Edge. |
| `npm run build` | Typecheck + build de producción en `dist/` (incluye `404.html` para hosting estático). |
| `npm run preview` | Sirve `dist/` localmente. |
| `npm run docs:media` | Regenera `docs/COVERAGE_MATRIX.md` y `docs/MEDIA_MANIFEST.md` desde el código. |

## Despliegue estático

`dist/` es un sitio estático: cualquier hosting con **HTTPS** sirve (el service worker y el almacenamiento persistente exigen contexto seguro; `localhost` también cuenta).

- **Base path.** Para publicar en una subcarpeta (p. ej. GitHub Pages en `/<repo>/`), construye con la variable `ATLAS_BASE`:

  ```bash
  ATLAS_BASE=/mi-repo/ npm run build
  ```

  (En PowerShell: `$env:ATLAS_BASE='/mi-repo/'; npm run build`.) El router, el manifiesto y el service worker usan esa base.
- **Rutas profundas.** La app usa rutas reales (`/progreso`, `/historial/:id`…). El build copia `index.html` a `404.html` para que hosts como GitHub Pages devuelvan la app al recargar una ruta profunda. En otros hosts, configura el *fallback* SPA a `index.html`.
- **Service worker.** Precachea solo el shell y el código propio (incluidas las animaciones). Una versión nueva **no recarga la página sola**: aparece un aviso "Aplicar actualización".
- Este repositorio no está publicado ni conectado a ningún remoto. No se configuró GitHub Pages.

## Estructura

```
src/
  domain/     reglas puras con pruebas: fechas (America/Santiago), validación, cargas y volumen,
              PR, progresión, temporizador, calendario y cumplimiento, CSV, manifiesto de medios
  data/       IndexedDB (Dexie, esquema versionado), siembra, sesiones, programa, respaldo
  anatomy/    rig anatómico SVG (cinemática + IK), cuerpo por vista, equipo, 39 clips, reproductor
  features/   pantallas: onboarding, Hoy, sesión, Mi rutina, Calendario, Progreso, Ajustes, Fuentes
  ui/         componentes accesibles, avisos con deshacer, gráficos SVG
tests/e2e/    Playwright
docs/         arquitectura, respaldo, manifiesto, cobertura, resultados de pruebas, pendientes
```

## Documentación

- [Arquitectura y decisiones](docs/ARCHITECTURE.md)
- [Respaldo, importación y límites del almacenamiento local](docs/BACKUP.md)
- [Manifiesto de medios](docs/MEDIA_MANIFEST.md) y [matriz de cobertura](docs/COVERAGE_MATRIX.md)
- [Resultados de pruebas ejecutadas](docs/TEST_RESULTS.md)
- [Pendientes concretos](docs/PENDIENTES.md)

## Avisos

ATLAS no es una herramienta médica: no diagnostica ni certifica la técnica. Revisa la técnica con un entrenador al comenzar y detén la serie ante dolor inusual. No tiene relación con Smart Fit ni con ningún proveedor citado en las referencias.
