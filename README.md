# ATLAS — Mi entrenamiento

Aplicación web personal, *mobile-first* y *local-first* para entrenar en el gimnasio. Interfaz mínima y clara pensada para usarse con una mano en el teléfono: ver los días de la rutina, empezar el de hoy, registrar las series (kg × reps, un toque para repetir lo de la última vez), descansar con un temporizador recuperable y revisar el historial. La técnica de cada ejercicio (demostración anatómica + texto) queda a un toque, sin estorbar.

- Sin cuenta, sin backend, sin analítica: los datos viven en el navegador (IndexedDB).
- Funciona sin conexión después de abrirla una vez (PWA con service worker).
- Rutina precargada de cuatro días consecutivos (superior/inferior): Día 1–4 y vuelta al Día 1. Solo una sesión completa avanza; faltar o guardar una parcial conserva el día pendiente.
- 39 demostraciones anatómicas propias (SVG animado en vivo) para todas las variantes principales y alternativas.

> **Estado honesto.** Las animaciones, los textos de técnica y las asociaciones musculares fueron creados por este proyecto y **no tienen revisión biomecánica profesional**. No se compraron ni incorporaron medios de terceros. La rutina es la configuración acordada para la app, no una prescripción médica. Ver [docs/PENDIENTES.md](docs/PENDIENTES.md).

## Usar ATLAS en el celular

ATLAS está publicado en **[kodamonkey.github.io/gym-seba](https://kodamonkey.github.io/gym-seba/)**.

1. Abre esa dirección con conexión y espera el aviso «Lista para usarse sin conexión».
2. Android: abre el menú de Chrome y elige «Instalar aplicación» o «Añadir a pantalla de inicio». iPhone: abre la dirección en Safari, toca Compartir y elige «Añadir a pantalla de inicio».
3. Entra desde el icono de ATLAS para entrenar. Las series, fechas y sesiones se guardan en ese dispositivo, incluso sin conexión.

Usa siempre el mismo navegador o la app instalada. Los datos del servidor local o de otro teléfono no aparecen automáticamente: exporta un respaldo JSON desde Ajustes e impórtalo en la instalación elegida. Haz respaldos periódicos; borrar los datos del navegador elimina el registro local. Ver [docs/BACKUP.md](docs/BACKUP.md).

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

Abre `http://localhost:5173`. No hay configuración inicial: el perfil (172 cm, 82 kg) viene precargado y puedes empezar el Día 1 en cualquier fecha. El orden lo dirige la última sesión completa de la rutina; la fecha real de cada entrenamiento queda registrada en Santiago. El objetivo inicial equivale a 32 entrenamientos (unas ocho semanas a cuatro por semana), sin caducar por ausencias.

La adaptación cuenta entrenamientos completos: inicialmente ocho con hasta dos series por ejercicio. Al alcanzar ese objetivo, la app pide confirmar antes de pasar a las series completas. Las parciales conservan sus series en el historial, pero no adelantan el día ni esta fase; al volver a empezar ese día se crea otra sesión.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite). |
| `npm run typecheck` | Comprobación de tipos (TypeScript, sin emitir). |
| `npm test` | Pruebas unitarias e integración (Vitest + fake-indexeddb). |
| `npm run e2e` | Construye, sirve con `vite preview` y ejecuta Playwright con Edge. |
| `npm run e2e:pages` | Prueba producción en `/gym-seba/`: volver a Inicio, guardar y recargar offline dentro del scope PWA. |
| `npm run build` | Typecheck + build de producción en `dist/` (incluye `404.html` para hosting estático). |
| `npm run preview` | Sirve `dist/` localmente. |
| `npm run docs:media` | Regenera `docs/COVERAGE_MATRIX.md` y `docs/MEDIA_MANIFEST.md` desde el código. |

## Despliegue estático

`dist/` es un sitio estático: cualquier hosting con **HTTPS** sirve (el service worker y el almacenamiento persistente exigen contexto seguro; `localhost` también cuenta).

- **Base path.** Para publicar en una subcarpeta (p. ej. GitHub Pages en `/<repo>/`), construye con la variable `ATLAS_BASE`:

  ```bash
  ATLAS_BASE=/gym-seba/ npm run build
  ```

  (En PowerShell: `$env:ATLAS_BASE='/gym-seba/'; npm run build`.) El router, el manifiesto y el service worker usan esa base.
- **Rutas profundas.** La app usa rutas reales (`/dia/:id`, `/historial/:id`…). El build copia `index.html` a `404.html` para que hosts como GitHub Pages devuelvan la app al recargar una ruta profunda. En otros hosts, configura el *fallback* SPA a `index.html`.
- **Service worker.** Precachea solo el shell y el código propio (incluidas las animaciones). Una versión nueva **no recarga la página sola**: aparece el aviso «Nueva versión disponible» con el botón «Actualizar».
- **GitHub Pages.** [`.github/workflows/pages.yml`](.github/workflows/pages.yml) comprueba tipos y pruebas, construye con la ruta que informa Pages y publica `dist/`. Se ejecuta al subir a `main` o manualmente desde Actions. Pages debe usar «GitHub Actions» como origen. Las actualizaciones del sitio conservan IndexedDB; los respaldos siguen siendo responsabilidad del usuario.

## Estructura

```
src/
  domain/     reglas puras con pruebas: fechas (America/Santiago), validación, cargas y volumen,
              PR, progresión, temporizador, calendario y cumplimiento, CSV, manifiesto de medios
  data/       IndexedDB (Dexie, esquema versionado), siembra, sesiones, programa, respaldo
  anatomy/    rig anatómico SVG (cinemática + IK), cuerpo por vista, equipo, 39 clips, reproductor
  features/   pantallas: inicio (días), día, sesión, historial, ajustes; hoja de técnica
  ui/         componentes accesibles (hoja inferior, interruptores), iconos SVG, avisos
tests/e2e/    Playwright
docs/         arquitectura, respaldo, manifiesto, cobertura, resultados de pruebas, pendientes
```

## Documentación

- [Arquitectura y decisiones](docs/ARCHITECTURE.md)
- [Respaldo, importación y límites del almacenamiento local](docs/BACKUP.md)
- [Manifiesto de medios](docs/MEDIA_MANIFEST.md) y [matriz de cobertura](docs/COVERAGE_MATRIX.md)
- [Resultados de pruebas ejecutadas](docs/TEST_RESULTS.md)
- [Pendientes concretos](docs/PENDIENTES.md)
- [Objetivos y su estado](docs/objetivos.json) y [especificación original](docs/PROMPT_MAESTRO.md); guía para agentes en [AGENTS.md](AGENTS.md)

## Avisos

ATLAS no es una herramienta médica: no diagnostica ni certifica la técnica. Revisa la técnica con un entrenador al comenzar y detén la serie ante dolor inusual. No tiene relación con Smart Fit ni con ningún proveedor citado en las referencias.
