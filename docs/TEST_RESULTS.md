# Resultados de pruebas ejecutadas

Ejecutadas el **11 de octubre de 2026** en Windows 11, Node 24.19, npm 11.17, Microsoft Edge 155 (vía Playwright 1.64, `channel: 'msedge'`). Solo se listan pruebas que realmente se ejecutaron.

## Comprobaciones automáticas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Sin errores. |
| `npm test` | **14 archivos: 13 pasan, 1 omitido** (generador de docs, solo con `ATLAS_GEN_DOCS=1`). **107 pruebas pasan, 1 omitida.** |
| `npm run build` | Build correcta; service worker generado (precache de shell, código e iconos propios). |
| `npm run e2e` | **12/12 pasan.** Ejecutado tres veces (dos seguidas tras la corrección de desplazamiento y una tras las correcciones de la revisión). |
| `npm run docs:media` | Genera `docs/COVERAGE_MATRIX.md` y `docs/MEDIA_MANIFEST.md`. |

### Pruebas unitarias e integración (Vitest)

- **Fechas (`dates.test.ts`)**: validez de fechas, suma de días entre meses/años y en días de cambio de horario de Chile, meses de distinta duración, día ISO y lunes de la semana, grilla mensual, fecha local cerca de medianoche y fin de año, inicio del horario de verano (medianoche inexistente, 2026-09-06), fin del horario de verano (hora repetida, 2026-04-05), formato con desfase, independencia de la zona del dispositivo.
- **Validación (`validation.test.ts`)**: coma y punto decimal; vacío ≠ cero; rechazo de negativos, texto, notación científica; repeticiones enteras; RIR 0–10 en medios; duraciones `45`/`1:30`; reglas de confirmación; avisos de valores inusuales sin bloquear; ejercicios por tiempo; variantes sin carga externa.
- **Cargas y volumen (`load.test.ts`)**: los tres casos del encargo (2 × 10 kg × 10 = 200; unilateral 10 kg × 10 por brazo = 200; dos filas por lado no duplican), zancadas con dos mancuernas, barra Smith sin asumir peso, conversión lb→kg, carga no registrada ≠ 0, sin volumen en ejercicios por tiempo, clave de comparación (máquinas, configuración, peso libre, comparabilidad no confirmada).
- **PR (`pr.test.ts`)**: primer registro / empate / nuevo; separación por contexto; repeticiones por carga; recálculo al borrar una serie histórica; reordenamiento cronológico al corregir una sesión antigua; volumen de sesión una vez por sesión; celebración en vivo solo para récords nuevos.
- **Progresión (`progression.test.ts`)**: sugiere el menor incremento con todas las condiciones; no sugiere con dolor, técnica negativa o sesión incompleta; pide confirmación si falta RIR o técnica; mantiene si una serie no llegó al tope; RIR bajo el objetivo; incremento desconocido sin inventar valor.
- **Temporizador (`timer.test.ts`)**: restante recalculado desde el estado guardado (simula pestaña suspendida), pausa/reanudación, ±15 s sin negativos, reloj que retrocede, omitir; duración de sesión con pausas cerradas y abiertas.
- **Calendario (`schedule.test.ts`)**: semana de programa desde la fecha de inicio, 32 sesiones en 8 semanas, cambio de año, adaptación activa, adaptación que no desaparece en silencio, decisión de terminarla, oferta tras 14 días sin entrenar, sesión pasada sin registro ≠ completada, cumplimiento con parciales aparte, cumplimiento nulo (no cero) sin datos.
- **CSV (`csv.test.ts`)**: escape de comillas, comas y saltos; neutralización de fórmulas; números con punto; cabecera.
- **Sesiones (`sessions.test.ts`, IndexedDB simulada)**: siembra sin historial ficticio e idempotente; serie confirmada y recuperada desde una conexión nueva; una sola sesión activa; adaptación (2 series) en semana 1; doble toque sin duplicar; conflicto de `rev` sin sobrescritura; duplicar sin copiar estado ni fecha; finalizar sin marcar pendientes; editar plantilla no altera sesiones anteriores; sustitución sin transferir cargas; sustitución con series confirmadas añade aparte; filas por lado; PR excluye calentamientos, borradores y borradas; registro anterior por misma máquina.
- **Respaldo (`backup.test.ts`)**: ida y vuelta sin duplicados; restauración con unidades e ids; archivo inválido no modifica la base; rechazo de archivos ajenos y esquemas futuros; transacción fallida sin cambios parciales; conflictos por id; CSV con carga normalizada y fechas con desfase.
- **Migración (`migration.test.ts`)**: una v2 simulada con índice nuevo y `upgrade` preserva la sesión activa y sus series.
- **Regresiones de la revisión de código (`regressions.test.ts`)**: no se reinicia una sesión planificada ya registrada; reconfirmar con otros valores da conflicto (no "guardado" falso); no se cambia el modo de lados con valores sin confirmar; sustituir con filas por lado cuenta series y es idempotente; una serie añadida tarde a una sesión pasada se ordena por su sesión en los PR; comparación de respaldo detecta cambios anidados; la vista previa de "reemplazar todo" cuenta lo que se elimina; todas las tablas se validan; nunca quedan dos sesiones en curso tras importar; "esta y las futuras" respeta sesiones movidas u omitidas.
- **Cobertura anatómica (`coverage.test.ts`)**: toda variante principal y alternativa de la rutina tiene clip; cada clip corresponde a una variante; el manifiesto separa derechos/correspondencia/técnica; cada variante muestra al menos un músculo objetivo en su vista; los 39 clips se renderizan en 4 instantes sin valores inválidos; con IK, la mano alcanza el agarre (< 1,5 cm).

### E2E (Playwright, build de producción, emulación Pixel 7 con Edge)

1. Registro una serie, recargo y recupero exactamente carga/reps/RIR, estado confirmado y descanso.
2. Valores sugeridos y borradores no cuentan como realizados (0 de N; no se puede finalizar como completada).
3. Campo vacío no es cero; carga negativa rechazada; cero explícito aceptado y rotulado.
4. Dos pestañas: la segunda queda en solo lectura, toma el control, registra y la primera ve el dato.
5. Cambiar de variante actualiza título, demostración, técnica y músculos.
6. Variante propia sin recurso: se indica "Demostración no disponible" sin mostrar otra animación.
7. Con `prefers-reduced-motion`, el reproductor muestra inicio y fin sin animar.
8. Recarga en rutas profundas (`/progreso`, `/biblioteca/:id`).
9. Archivo de importación inválido: se informa y la base no cambia.
10. Exportar e importar el propio respaldo: 0 nuevos, 0 conflictos.
11. **Offline:** tras instalar el service worker, sin conexión la app carga, se inicia una sesión, se registra una serie y la demostración se muestra.
12. Con el reloj en 2026-10-20 y programa desde el 12-oct, la sesión pasada aparece "Sin registrar" (no completada).

**Incidencia encontrada y corregida durante las pruebas:** al enfocar un campo, la app hacía un `scrollIntoView` animado y el aviso "lista para usar sin conexión" desplazaba el contenido; ambos podían mover el botón de confirmar justo al tocarlo. Se cambió a un desplazamiento instantáneo solo si el campo queda tapado (tras 300 ms, cuando el teclado ya abrió) y el aviso pasó a ser flotante. Los helpers E2E esperan 450 ms antes de tocar "confirmar", como una persona.

## Revisión de código independiente

Un agente revisor leyó `sessions.ts`, `backup.ts`, `program.ts`, `hooks.ts` (bloqueo entre pestañas), `SetRow.tsx` y la detección de PR. Reportó 5 errores y 11 riesgos; **todos se corrigieron** y los verificables tienen prueba en `regressions.test.ts`: sesión planificada reiniciable, confirmación idempotente que ignoraba valores distintos, pérdida de borradores al cambiar el modo de lados, conteo de series restantes con filas por lado, sustitución no idempotente, orden cronológico de PR con series añadidas tarde, comparación de respaldo que ignoraba campos anidados, tablas sin esquema en la importación, vista previa sin "eliminados", invariante de una sesión activa en la importación, borrado de sesión planificada fuera de transacción, "esta y las futuras" que pisaba decisiones del usuario, `syncProgramDays` con lectura fuera de transacción, bloqueo retenido tras desmontar (Web Locks), guardados de borrador encadenados con revisión obsoleta y notas de máquina duplicables.

## Revisiones manuales realizadas (capturas en Edge sin interfaz)

- **Animaciones:** se revisaron visualmente los 39 clips en el fotograma inicial y en el final del recorrido: persona con el equipo correcto, manos/pies sobre agarres y plataformas, cables y pilas coherentes, músculos resaltados en su sitio. Se corrigieron durante la revisión: codos con escorzo en el press, pectoral tapado por el brazo (brazo translúcido), resaltado en el lado inactivo de unilaterales, columnas que chocaban con la persona, encuadres.
- **Móvil 390 × 844 (oscuro y claro):** onboarding, Hoy, sesión, historial, Mi rutina, biblioteca, editor de día, calendario, progreso, ajustes y fuentes; sin desbordamiento horizontal (comprobado por `scrollWidth`).
- **Escritorio 1280 × 860 (claro):** vista dividida demostración/registro.
- **Paleta de gráficos:** validada con el script de la guía de visualización (banda de luminosidad OKLCH y contraste ≥ 3:1 en ambos temas).

## No realizado (pendiente)

- Pruebas en un teléfono físico (teclado real, bloqueo de pantalla, instalación como PWA en Android/iOS).
- Pruebas con lector de pantalla (NVDA/VoiceOver) y auditoría formal WCAG.
- Revisión biomecánica profesional de animaciones, técnica y roles musculares (ver `PENDIENTES.md`).
- Pruebas de rendimiento en dispositivos de gama baja.
