# Equipos de Smart Fit Mall Plaza Vespucio

Consulta de fuentes públicas: **2026-10-12**, zona `America/Santiago`.

La sede está identificada, pero no hay un inventario público individual suficiente para confirmar las máquinas propuestas por ATLAS. Las alternativas siguientes permiten preparar una rutina flexible; su presencia también debe comprobarse en la sede.

Seba considera probable que estén los equipos propuestos. Se usa esa información para preparar las opciones de entrenamiento; la identificación de máquinas, unidades e incrementos continúa pendiente.

## Evidencia pública de la sede

La [ficha oficial de Smart Fit Mall Plaza Vespucio](https://www.smartfit.cl/gimnasios/mall-plaza-vespucio) identifica la dirección Av. Vicuña Mackenna 7110, La Florida, y anuncia áreas de **cardio, peso integrado y peso libre**. Esto confirma categorías, no modelos, cantidad de equipos, accesorios ni pesos disponibles.

La [ficha oficial de Mallplaza](https://www.mallplaza.com/cl/vespucio/tiendas/smart-fit/index.html), leída con su contenido dinámico, sitúa Smart Fit en **nivel 3, costado Decathlon**. No entrega inventario.

La ficha Smart Fit consultada ofrece una [imagen promocional](https://pictures.smartfit.com.br/12362/big/5f66a111f1306ae1902d4af588f30e54.jpeg?1721932085=), inspeccionada visualmente: persona y equipo parcial bajo el texto «¡Ya abrimos!». No es un recorrido del gimnasio ni permite identificar todas las máquinas o su disponibilidad actual. No aparece un tour virtual de esta sede en la ficha consultada.

## Qué sigue sin confirmación individual

| Equipo o dato | Resultado de la investigación |
|---|---|
| Mancuernas, bancos ajustables, barra y discos | Área de peso libre anunciada; piezas, rangos y cantidades no confirmados. |
| Polea ajustable, cruce de poleas, polea baja | No identificados individualmente. Accesorios de cuerda, triángulo y agarre neutro no confirmados. |
| Smith | No identificada individualmente; resistencia de barra, seguros y trayectoria desconocidos. |
| Prensa 45° | No identificada individualmente; tipo de prensa y resistencia del carro desconocidos. |
| Press de pecho, inclinado y hombros | Máquinas específicas no identificadas. |
| Remo sentado y remo con apoyo inclinado | Máquinas específicas no identificadas. |
| Estación de jalón | No identificada individualmente; agarres disponibles desconocidos. |
| Curl femoral sentado o acostado | Ninguno de los dos tipos confirmado. |
| Extensión de cuádriceps | No identificada individualmente. |
| Hip thrust | Máquina dedicada no confirmada; tampoco una instalación en Smith. |
| Pantorrillas | Máquina dedicada no confirmada. |
| Pec deck con función inversa | No identificada; no toda máquina de aperturas permite trabajar al revés. |
| Máquina abdominal | No identificada individualmente. |
| Caminadora, bicicleta y elíptica | Área de cardio anunciada; cada tipo y cantidad sin confirmación individual. |
| Incrementos, unidades y resistencias base | No publicados para las máquinas individuales. |

**Regla para los datos:** mantener `status: 'unverified'`, `minIncrement: null` y `declaredBaseResistance: null` en `src/data/seed/equipment.ts`. No crear una falsa identificación física a partir de publicidad de la cadena. No se usaron reseñas de terceros para afirmar presencia de equipos.

## Alternativas disponibles en el catálogo de ATLAS

Estas opciones ya tienen variantes y clips SVG propios. La tabla expresa compatibilidad del catálogo, no disponibilidad confirmada en Vespucio. Técnicas y roles musculares siguen `unreviewed`; clips siguen `pending`.

| Movimiento de la rutina | Opción prevista | Alternativa existente si se identifica el equipo |
|---|---|---|
| Press horizontal | `v-chest-press-machine` | `v-db-bench-press` |
| Press inclinado | `v-incline-db-press` | `v-incline-press-machine` |
| Jalón | `v-lat-pulldown-neutral` | `v-lat-pulldown-wide` o `v-lat-pulldown-supine`, según agarre disponible y cómodo. |
| Remo | `v-seated-row-machine` | `v-seated-cable-row`; `v-chest-supported-row` sólo si existe esa configuración. |
| Press vertical | `v-shoulder-press-machine` | `v-db-seated-shoulder-press` |
| Elevaciones laterales | `v-db-lateral-raise` | `v-cable-lateral-raise` |
| Deltoides posterior | `v-reverse-pec-deck` | `v-cable-reverse-fly`, que necesita dos poleas. |
| Bíceps | `v-db-curl` | `v-cable-curl` |
| Tríceps | `v-triceps-pushdown` | `v-triceps-extension-machine` |
| Patrón de sentadilla | `v-leg-press` | `v-goblet-squat` o `v-smith-squat`; cargas y ajustes son propios de cada variante. |
| Bisagra de cadera | `v-db-rdl` | `v-bb-rdl`; no se asume que la barra pese 20 kg. |
| Flexión de rodilla | `v-seated-leg-curl` | `v-lying-leg-curl` |
| Trabajo unilateral de piernas | `v-db-split-squat` | `v-smith-split-squat` |
| Pantorrillas | `v-db-calf-raise` | `v-standing-calf-machine` o `v-smith-calf-raise`, con apoyo estable. |
| Extensión de cadera específica | `v-hip-thrust-machine` | `v-smith-hip-thrust`; ambos dependen de equipos sin confirmar. |
| Abdomen | `v-cable-crunch` | `v-ab-crunch-machine` |
| Antirrotación | `v-pallof-press` | `v-pallof-hold`, usando la misma polea. |

La extensión de cuádriceps (`v-leg-extension`) no tiene otra variante de aislamiento en el catálogo. La app ofrece sentadilla goblet para reorganizar el trabajo de piernas cuando falte la máquina, rotulada como **otro movimiento**. No se presenta como una sustitución directa equivalente de aislamiento.

En la sesión, **Cambiar** abre las alternativas a un toque. Cada opción muestra su equipo y distingue mismo ejercicio de otro movimiento. Las series ya realizadas conservan sus datos; la variante nueva comienza sin transferir cargas.

## Cómo cerrar la verificación en la sede

Para cada equipo usado, Seba o un entrenador debe identificar ubicación y modelo/configuración, comprobar el movimiento permitido y anotar la unidad, el menor incremento y la resistencia base **sólo si están declarados**. En Smith y prensa se registran discos añadidos cuando la resistencia base es desconocida; con mancuernas, carga por mancuerna.

Conviene comprobar primero mancuernas y banco, jalón/remo, prensa o Smith, curl femoral, extensión y polea ajustable. Hip thrust, máquina exclusiva de pantorrillas y remo inclinado no deben ser dependencias obligatorias para empezar. No hace falta marcar todo el inventario: basta identificar las estaciones realmente elegidas y sostener sus alternativas.

No transferir cargas ni considerar récords comparables entre máquinas o variantes distintas. Registrar cada variante elegida conserva la trazabilidad de sesiones y series.

Referencias del proyecto: `src/data/seed/equipment.ts`, `src/data/seed/catalog.ts`, `src/data/seed/routine.ts`, `docs/COVERAGE_MATRIX.md` y pendientes 9–11 de `docs/PENDIENTES.md`.
