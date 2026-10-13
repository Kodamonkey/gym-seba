# Pendientes concretos

Lo que **no** está hecho o no está verificado. Nada pendiente se presenta como completo en la app. Los números son estables porque `objetivos.json` los referencia; los resueltos quedan identificados.

## Validación profesional

1. **Revisión biomecánica de las 39 animaciones** (posturas, trayectorias, ángulos de escorzo) por un profesional. Todas figuran con `technicalReviewStatus: pending`.
2. **Revisión de textos de técnica y roles musculares** (objetivo/participa/estabiliza) por variante. Hoy son `unreviewed`, redactados por ATLAS a partir de conocimiento general.
3. **Revisión práctica de la rutina v2** por un entrenador: evidencia y decisiones de programación en `EVIDENCIA_RUTINA.md` y `RUTINA_SEBA.md`. Basarla en literatura no equivale a validar la ejecución o prescribir clínicamente a Seba.

## Demostraciones

4. Algunos músculos objetivo no son visibles en la vista elegida (p. ej. romboides en los remos en vista lateral); la app lo rotula. Una vista adicional por clip resolvería esto.
5. Representación 2D: los movimientos fuera del plano se muestran con escorzo y extremidades translúcidas; no hay rotación libre ni 3D (segunda etapa opcional del encargo).
6. Equipos dibujados de forma genérica: la máquina real de tu sede puede diferir (posición de agarres, pivotes, si es de pila o de discos).
7. No se incorporaron medios de terceros (decisión "sin pagos"). El reproductor de vídeo se retiró de la interfaz en el rediseño minimalista; la tabla `media` sigue en el esquema si algún día se consiguen licencias.
8. **Alternativa de aislamiento pendiente:** la v2 ofrece goblet cuando falta extensión de cuádriceps y la rotula como otro movimiento, no como aislamiento equivalente. Una máquina distinta de extensión debe identificarse antes de comparar cargas; no hay editor de variantes en la interfaz.

## Datos del usuario por confirmar

9. Inventario real de la sede: `EQUIPOS_VESPUCIO.md` verifica fuentes oficiales que anuncian peso libre, peso integrado y cardio; no hay listado público individual. Seba cree haber visto los equipos básicos, sin confirmar modelos, agarres ni incrementos. Se mantienen "por verificar". La sesión ofrece alternativas, pero no afirma disponibilidad.
10. Incrementos mínimos y resistencias base de cada máquina: desconocidos. La orientación conserva la carga y solo permite considerar el menor incremento disponible al cumplir series, técnica y RIR; no inventa una cifra.
11. Sin máquina identificada, los récords no se celebran (comparabilidad no confirmada). La interfaz simple no muestra récords.

## Plataforma

12. Pruebas en teléfono físico (teclado, bloqueo, instalación PWA) y con lector de pantalla. La emulación en Edge cubre 320/375/390 px, controles táctiles, foco, borradores y descanso; no sustituye Android/iOS reales ni VoiceOver/TalkBack.
13. Avisos de fin de descanso con el teléfono bloqueado o la pestaña suspendida: no garantizados (limitación del navegador; no se usan notificaciones push).
14. Exportación `.ics` e integración con Google Calendar: no implementadas (mejora posterior; la segunda requiere autorización explícita).
15. Sincronización entre dispositivos y cuentas: fuera del MVP. El respaldo JSON es el mecanismo de traslado.
16. **Resuelto el 2026-10-13:** ATLAS publicado en [https://kodamonkey.github.io/gym-seba/](https://kodamonkey.github.io/gym-seba/), con HTTPS obligatorio y despliegue automático de `main` mediante `.github/workflows/pages.yml`. Ejecución de Actions y prueba móvil remota correctas: recursos, manifest, rutas, registro/recuperación offline y respaldo JSON. La instalación en teléfono físico sigue pendiente en el punto 12.

## Interfaz simple (rediseño 2026-10-11)

17. **Editar la rutina:** no hay editor en la app. Cambiar el seed no basta. La transición v1→v2 actualiza solo la plantilla original intacta, difiere con una sesión activa y protege personalizaciones/importaciones. No resuelve la edición general sin código; una futura actualización necesita otra transición explícita.
18. Calendario, progreso/gráficos y mediciones corporales se retiraron de la interfaz; los datos siguen exportándose en el respaldo.
19. **Resuelto el 2026-10-12:** iconos PWA SVG/PNG y Apple Touch coherentes con el tema claro verde. `node scripts/gen-icons.mjs` los regenera desde el SVG propio; icono maskable dentro de la zona segura.

## Límites detectados en la auditoría móvil (2026-10-12)

20. **Resuelto el 2026-10-12:** la adaptación separa sesiones completas para su umbral y actividad real (completas o parciales) para detectar inactividad. Una parcial no se presenta como completa ni provoca por sí sola un aviso de inactividad; las decisiones previas se conservan.
21. **Confirmaciones de progresión:** la interfaz mínima no registra RIR por serie, técnica confirmada ni dolor por ejercicio. Muestra el RIR objetivo y orientación conservadora; no inventa esas confirmaciones. Para cerrar la progresión automática habría que exponer esos datos y confirmar la máquina/incremento con Seba.

22. **Resuelto el 2026-10-13:** orden flexible Día 1–4, sin asignación semanal. La última sesión completa del programa y de un día vigente determina el siguiente; parciales, descartadas y ausencias no avanzan. Al completar Día 4 vuelve Día 1. Inicio y Día usan ese mismo orden; una URL futura permite consultar técnica pero bloquea empezar. La adaptación cuenta completas y requiere decisión explícita. Historial, sesiones activas, fechas, planificación previa y respaldo se conservan; no hay migración destructiva ni cursor fuera del JSON.
