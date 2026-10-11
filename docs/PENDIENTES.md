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
7. No se incorporaron medios de terceros (decisión "sin pagos"). Si se consiguen licencias (GymVisual, Muscle & Motion…), el reproductor de vídeo y el registro de medios están listos; falta verificar cada licencia concreta (uso en app, alojamiento, caché, atribución, duración).
8. "Otra máquina equivalente" para la extensión de cuádriceps no está definida: debe crearse como variante identificada (quedará sin demostración).

## Datos del usuario por confirmar

9. Inventario real de la sede: todos los equipos están "por verificar".
10. Incrementos mínimos y resistencias base de cada máquina: desconocidos (sin ellos la progresión sugiere "el siguiente incremento disponible" sin cifra y la barra Smith no suma su peso).
11. Identificar la máquina concreta en cada ejercicio para que la comparabilidad quede confirmada.

## Plataforma

12. Pruebas en teléfono físico (teclado, bloqueo, instalación PWA) y con lector de pantalla.
13. Avisos de fin de descanso con el teléfono bloqueado o la pestaña suspendida: no garantizados (limitación del navegador; no se usan notificaciones push).
14. Exportación `.ics` e integración con Google Calendar: no implementadas (mejora posterior; la segunda requiere autorización explícita).
15. Sincronización entre dispositivos y cuentas: fuera del MVP. El respaldo JSON es el mecanismo de traslado.
16. Despliegue: no se publicó en ningún hosting ni se creó un repositorio remoto (solo `git init` local, rama `feat/atlas-mvp`).
