# Pendientes concretos

Lo que **no** está hecho o no está verificado. Nada de esta lista se presenta como completo en la app.

## Validación profesional

1. **Revisión biomecánica de las 39 animaciones** (posturas, trayectorias, ángulos de escorzo) por un profesional. Todas figuran con `technicalReviewStatus: pending`.
2. **Revisión de textos de técnica y roles musculares** (objetivo/participa/estabiliza) por variante. Hoy son `unreviewed`, redactados por ATLAS a partir de conocimiento general.
3. **Revisión de la rutina** por un entrenador: es la configuración acordada para la app, no una prescripción.

## Demostraciones

4. Algunos músculos objetivo no son visibles en la vista elegida (p. ej. romboides en los remos en vista lateral); la app lo rotula. Una vista adicional por clip resolvería esto.
5. Representación 2D: los movimientos fuera del plano se muestran con escorzo y extremidades translúcidas; no hay rotación libre ni 3D (segunda etapa opcional del encargo).
6. Equipos dibujados de forma genérica: la máquina real de tu sede puede diferir (posición de agarres, pivotes, si es de pila o de discos).
7. No se incorporaron medios de terceros (decisión "sin pagos"). El reproductor de vídeo se retiró de la interfaz en el rediseño minimalista; la tabla `media` sigue en el esquema si algún día se consiguen licencias.
8. "Otra máquina equivalente" para la extensión de cuádriceps no está definida (y ya no hay editor de variantes en la app).

## Datos del usuario por confirmar

9. Inventario real de la sede: todos los equipos están "por verificar" (la interfaz ya no lo muestra; siempre es el mismo gimnasio).
10. Incrementos mínimos y resistencias base de cada máquina: desconocidos. La pista "prueba subir un poco el peso" no da una cifra.
11. Sin máquina identificada, los récords no se celebran (comparabilidad no confirmada). La interfaz simple no muestra récords.

## Plataforma

12. Pruebas en teléfono físico (teclado, bloqueo, instalación PWA) y con lector de pantalla.
13. Avisos de fin de descanso con el teléfono bloqueado o la pestaña suspendida: no garantizados (limitación del navegador; no se usan notificaciones push).
14. Exportación `.ics` e integración con Google Calendar: no implementadas (mejora posterior; la segunda requiere autorización explícita).
15. Sincronización entre dispositivos y cuentas: fuera del MVP. El respaldo JSON es el mecanismo de traslado.
16. Despliegue: no se publicó en ningún hosting ni se creó un repositorio remoto (solo `git init` local, rama `feat/atlas-mvp`).

## Interfaz simple (rediseño 2026-10-11)

17. **Editar la rutina:** no hay editor en la app. Cambiar `src/data/seed/routine.ts` **no** modifica una instalación existente (la siembra solo añade lo que falta); hace falta una migración o un editor mínimo.
18. Calendario, progreso/gráficos y mediciones corporales se retiraron de la interfaz; los datos siguen exportándose en el respaldo.
19. Iconos de la PWA (`public/icon*.png`, `icon.svg`): conservan el diseño oscuro anterior; falta uno claro coherente con el nuevo tema.
