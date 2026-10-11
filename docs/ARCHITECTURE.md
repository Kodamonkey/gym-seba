# Arquitectura y decisiones

## Capas

| Capa | Carpeta | Responsabilidad | Depende de |
|---|---|---|---|
| Dominio | `src/domain` | Reglas puras: fechas, validación, cargas/volumen, PR, progresión, temporizador, calendario, cumplimiento, CSV, tipos | nada |
| Datos | `src/data` | IndexedDB (Dexie), siembra, operaciones transaccionales, respaldo/importación | dominio |
| Anatomía | `src/anatomy` | Rig 2D, formas del cuerpo, equipo, clips, render imperativo, reproductor, manifiesto | dominio (tipos) |
| Funcionalidades | `src/features` | Pantallas y flujos | todo lo anterior |
| UI | `src/ui` | Componentes accesibles, avisos, gráficos | — |

PR, volumen, progresión, fechas e importación se prueban sin renderizar la interfaz (`*.test.ts`).

## Stack (versiones instaladas el 2026-10-11)

React 19.3 · TypeScript 7.0 · Vite 8.3 · Tailwind CSS 4.3 · react-router 8.4 · Dexie 4.4 · Zod 4.6 · vite-plugin-pwa 2.0 (Workbox) · Vitest 5 + Testing Library + fake-indexeddb · Playwright 1.64 (Edge del sistema).

Sin librería de gráficos ni de animación: los gráficos son SVG propios de una sola serie y las microanimaciones son CSS (respetan `prefers-reduced-motion` y la preferencia de la app).

## Modelo de datos (IndexedDB `atlas`, esquema v1)

| Tabla | Contenido |
|---|---|
| `profile`, `prefs` | Perfil editable y preferencias |
| `exercises`, `variants` | Catálogo: ejercicio y variante concreta (equipo, configuración, lateralidad, implementos, convención de carga, medida, roles musculares, técnica, clip) |
| `equipment`, `equipmentNotes` | Instancias de equipo (estado en la sede, unidad, incremento mínimo, resistencia base declarada) y notas por máquina |
| `routineTemplates`, `routineVersions` | Plantilla editable y una instantánea por versión |
| `programs`, `scheduledWorkouts`, `programDecisions` | Programa activo, sesiones planificadas (con fecha original si se reprogramó) y decisiones registradas (adaptación, etc.) |
| `sessions`, `sessionExercises`, `setLogs` | Ejecución real. Cada sesión copia la prescripción y una instantánea de la variante: se lee aunque la plantilla cambie o se archive |
| `restTimers` | Estado del descanso (inicio, duración, pausas) |
| `bodyMeasurements`, `cardioLogs`, `progressionDecisions`, `media` | Mediciones, cardio, decisiones de progresión y metadatos de medios externos |
| `meta` | Versión de siembra, último respaldo, última máquina usada por variante |

Todas las entidades tienen id estable (`crypto.randomUUID`) y `createdAt/updatedAt`; las editables concurrentes llevan `rev`. Archivar no borra registros. PR, volumen y cumplimiento **siempre se derivan** de los registros.

**Migraciones:** cada cambio de esquema añade `this.version(n).stores(...).upgrade(...)` en `src/data/db.ts` sin modificar versiones anteriores. `src/data/migration.test.ts` simula una v2 y comprueba que la sesión activa y sus series sobreviven.

## Decisiones relevantes

### Registro y concurrencia
- **Borrador ≠ realizado.** Los valores se guardan como borrador al salir del campo; una serie solo cuenta al confirmarla con datos válidos (`checkSetForConfirm`, la misma regla que la importación). Las sugerencias del registro anterior son *placeholders* y nunca se guardan solas.
- **Vacío ≠ cero.** `null` = no registrado; `0` = carga externa cero explícita.
- **Confirmación idempotente** y transaccional: un doble toque no duplica ni re-escribe la fecha de ejecución.
- **Sin sobrescrituras silenciosas:** cada escritura comprueba `rev`; además, Web Locks asigna una sola pestaña editora (las demás quedan en solo lectura con "Tomar el control"; si la editora se cierra, otra hereda el control). Dexie propaga los cambios entre pestañas.
- **Deshacer** en confirmar, desmarcar, eliminar serie, omitir sesión y borrar medición.

### Tiempo
- Fechas de planificación como `YYYY-MM-DD` con aritmética `Date.UTC`; instantes en ISO UTC + zona IANA. La fecha local se fija al iniciar la sesión, por lo que cambiar la zona preferida no altera el historial. Probado en medianoche, fin de año y ambas transiciones de horario de Chile.
- El descanso se recalcula siempre desde el estado guardado (sobrevive a recarga y suspensión). Los retrocesos de reloj se acotan.

### Cargas, volumen y PR
- Cada variante declara su convención (por mancuerna, total, discos añadidos, pila, nominal, sin carga), implementos, lateralidad y modo de repeticiones. La resistencia base de un equipo solo se suma si está **declarada**, y se copia a la sesión (no cambia retroactivamente). Libras se convierten conservando unidad original.
- Clave de comparación = variante + instancia de equipo (o "sin identificar") + configuración + lateralidad + convención. Máquinas sin identificar → "comparabilidad no confirmada" y sin celebración.
- PR por recorrido cronológico: primer registro / empate / nuevo; celebración solo al confirmar en vivo, reversible.

### Demostraciones anatómicas
- **Decisión del usuario:** sin pagos ⇒ sin licencias de GymVisual, Muscle & Motion ni MuscleWiki. Se construyó un **rig anatómico SVG propio**:
  - Esqueleto 2D con proporciones genéricas (no derivadas de la estatura del usuario), vistas lateral, frontal y posterior, tronco en dos segmentos (permite flexión de columna).
  - **IK analítica de dos huesos**: cada clip define la trayectoria del equipo (asa, plataforma, barra) y las manos/pies se resuelven hacia ella; una prueba verifica que la mano alcanza el agarre.
  - **Músculos anclados a segmentos**: cada forma es una lista de anclas `[segmento, u, v]` resuelta en cada fotograma, así el resaltado se deforma con la articulación y no se separa del cuerpo.
  - **Escorzo** del húmero/antebrazo para movimientos fuera del plano (codos abiertos, aperturas) y extremidad cercana translúcida cuando tapa el músculo objetivo; ambas cosas se explican en el pie de cada clip.
  - Roles por variante: objetivo (coral sólido), participa (ámbar con rayas), estabilizador (azul con puntos, capa opcional); gris = no destacado. Nombres siempre visibles (no solo color). Sin intensidades por carga ni encendidos por fase.
  - Fases propias de cada clip; isométricos se muestran como mantenimiento. Reproductor con reproducir/pausa, reinicio, velocidad, posición, inicio/fin, ampliar y capa de estabilizadores (capacidades reales porque el render es en vivo). Sin autoplay por defecto ni audio; con movimiento reducido muestra fotogramas de inicio y fin. Solo una demostración se reproduce a la vez y se pausa fuera de pantalla.
  - Render imperativo: los paths se crean una vez y solo se actualiza `d` (sin re-render de React por fotograma).
- **Medios externos** (`src/features/exercise/VideoPlayer.tsx`): soporte MP4/WebM/GIF con licencia declarada; solo se reproducen si están autorizados y vigentes, nunca se descargan ni precachean, y se informa la conexión al tercero.
- Manifiesto con tres revisiones separadas (derechos, correspondencia, técnica). Ver `docs/MEDIA_MANIFEST.md` y `docs/COVERAGE_MATRIX.md`.

### Offline y PWA
- `vite-plugin-pwa` (`generateSW`, `registerType: 'prompt'`): precache de shell, código y PNG/SVG propios; `runtimeCaching` vacío (sin caché de terceros). Una actualización se aplica solo cuando el usuario lo decide.

### Seguridad y privacidad
- Sin secretos, sin analítica, sin llamadas a servicios externos. Las notas se renderizan como texto (React escapa). La importación valida estructura y valores con Zod, limita tamaño (50 MB), rechaza esquemas futuros y escribe en una sola transacción. Medios externos solo `https://`. El CSV neutraliza fórmulas.
- Si en el futuro se integra un proveedor con credenciales, debe hacerse con un componente *server-side* separado; nunca en `VITE_*`, el bundle ni el almacenamiento del navegador.

## Puntos de extensión

- Nuevas variantes con clip: añadir un `Clip` en `src/anatomy/clips/*` con el mismo id de la variante y registrarlo en `clips/index.ts`.
- Nuevas vistas o regiones musculares: `src/anatomy/body/*` (anclas por segmento).
- Personaje 3D (segunda etapa opcional): el reproductor consume `Clip`; un renderer 3D podría implementar la misma interfaz sin tocar el registro.
- Sincronización o cuentas: no forman parte del MVP; el respaldo JSON versionado es el formato de intercambio.
