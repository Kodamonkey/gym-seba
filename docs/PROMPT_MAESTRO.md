# ATLAS — Prompt maestro para una app personal de gimnasio

> **Especificación original de Seba (v1.0, 2026-10-11), conservada tal cual como referencia.** El rediseño minimalista del mismo día recortó el alcance: lo vigente y su estado están en [objetivos.json](objetivos.json). Lo que esta especificación pide y la app ya no tiene queda fuera de alcance salvo que Seba lo pida de nuevo.

**Versión consolidada:** 1.0 · 11 de octubre de 2026.  
**Uso:** entrega este archivo completo a tu agente de desarrollo. Incluye el contexto, la rutina inicial, los requisitos funcionales y la actualización de animaciones anatómicas. No necesita los mensajes anteriores.  
**Fuentes:** referencias oficiales consultadas el 11 de octubre de 2026, incluidas al final. Revalida sus condiciones al implementar.

---

## 0. Rol, misión y resultado esperado

Actúa como Senior Full-Stack Engineer, Product Designer y responsable de calidad de una aplicación personal de entrenamiento. Diseña e implementa una web funcional, mobile-first, dinámica, editable y preparada para registrar entrenamientos reales.

Nombre provisional: **ATLAS — Mi entrenamiento**. Nombre, colores y preferencias deben poder modificarse sin rehacer el producto.

No quiero una landing page, un dashboard decorativo, una demo sin persistencia ni una colección de botones sin comportamiento. Quiero abrir la aplicación dentro del gimnasio, entender cómo hacer cada ejercicio y registrar mis series con pocos toques.

Flujo central:

**Abrir → ver la sesión del día → observar la animación anatómica con la máquina y los músculos resaltados → registrar series, kilos y repeticiones → descansar → completar la sesión → revisar progreso y PR.**

Prioridades de implementación:
1. Registro rápido, persistente y recuperable.
2. Demostraciones anatómicas correctas: persona + equipo + movimiento + músculos destacados en el mismo personaje.
3. Rutina y calendario realmente editables.
4. Seguimiento consistente de cargas, repeticiones, PR y constancia.
5. Interfaz atractiva, accesible y bien terminada.

Si existe un repositorio, inspecciona su estructura, documentación, stack, componentes y pruebas. Reutiliza lo útil. No borres funcionalidades, archivos del usuario ni datos para facilitar una reescritura. Trabaja en una rama de funcionalidad si el entorno lo permite, sin sobrescribir cambios ajenos. No publiques ni contrates servicios por tu cuenta.

No te detengas en una propuesta conceptual: implementa, prueba y documenta. Cuando exista un bloqueo real de permisos o recursos, completa lo independiente y registra exactamente qué falta; no simules que está resuelto.

## 1. Contexto personal y alcance

| Campo | Valor inicial |
|---|---|
| Usuario | Seba |
| Estatura informada | 172 cm |
| Peso informado | 82 kg |
| Experiencia en gimnasio | Principiante |
| Capacidades informadas | Puedo correr y hacer flexiones |
| Frecuencia | 4 días por semana |
| Duración objetivo | Aproximadamente 60 minutos por sesión |
| Gimnasio de referencia | Smart Fit Mallplaza Vespucio, Chile |
| Idioma | Español |
| Unidades | kg, cm, minutos y kilómetros |
| Zona horaria | America/Santiago |
| Objetivo | Salud, condición física y un físico fuerte, delgado y atlético |

**Mi referencia estética es un físico atlético como el de un calisténico, pero este programa es de GIMNASIO: máquinas, poleas, mancuernas, barras y Smith.** No lo conviertas en una rutina de flexiones, dominadas o fondos. Un programa exclusivamente de calistenia quedará fuera de esta versión.

Los datos anteriores son editables. No deduzcas porcentaje de grasa, peso ideal, cargas iniciales, fecha de nacimiento, limitaciones médicas ni ajustes de máquinas a partir de altura y peso. No prometas un físico determinado ni plazos garantizados.

La fecha de inicio del programa y la fecha de la medición corporal inicial deben confirmarse en el onboarding. No inventes registros históricos. No presentes la rutina como una prescripción clínica ni como validada profesionalmente solo por estar precargada.

El inventario individual de equipos de la sede no está confirmado en este encargo. Permite marcar cada equipo como disponible, no disponible o pendiente de verificar. No utilices logos de Smart Fit ni sugieras afiliación oficial.

## 2. Arquitectura de navegación y diseño

Cuatro secciones principales:

- **Hoy:** entrenamiento del día, acceso a sesión activa y resumen útil.
- **Mi rutina:** programas, sesiones, biblioteca, alternativas y edición.
- **Calendario:** planificación, reprogramación e historial.
- **Progreso:** rendimiento, PR, constancia y mediciones.

Perfil, ajustes, respaldo y fuentes tendrán un acceso secundario claro. No conviertas la navegación en una lista interminable de funciones.

Diseña primero para teléfono y uso con una mano. En escritorio puede existir una vista dividida entre sesión y demostración. Evita que el teclado móvil tape el botón de confirmar o el temporizador.

Dirección visual: deportiva, sobria, fondo grafito, superficies distinguibles y un acento consistente. Incluye modo claro y tokens de diseño. Cargas, repeticiones y ejercicio activo deben dominar sobre elementos decorativos.

Exige controles táctiles amplios, foco visible, etiquetas, contraste, mensajes comprensibles y navegación por teclado. El color no debe ser la única forma de comunicar información; añade nombres y símbolos o patrones cuando corresponda [R9].

Usa microanimaciones al completar una serie, cambiar de ejercicio, abrir una ficha y celebrar un PR. Deben ser breves, desactivables y respetar `prefers-reduced-motion`. No reproduzcas todas las demostraciones de una lista simultáneamente. No impongas autoplay ni sonido.

Estados que deben diseñarse: vacío, cargando, guardando, guardado, error, offline, medio no autorizado, recurso faltante y sesión recuperada. Nunca muestres éxito antes de verificar la operación.

## 3. Requisito central: animación anatómica con músculos resaltados

### 3.1. Qué debe verse

Quiero una **persona anatómica predominantemente monocromática que realice el ejercicio en la máquina o con el equipo correcto, mientras los músculos implicados se resaltan SOBRE SU PROPIO CUERPO**.

Propuesta de paleta:

| Elemento | Tratamiento | Significado didáctico |
|---|---|---|
| Cuerpo | Gris claro y anatomía reconocible | Base neutra |
| Músculos objetivo principales | Rojo coral intenso | Foco del ejercicio |
| Colaboradores | Ámbar | Otros músculos participantes |
| Estabilizadores | Azul, capa opcional | Función estabilizadora documentada |
| Máquina y entorno | Grises contrastados | Posición, apoyos y trayectoria del equipo |

Esta es una convención de interfaz, no una escala fisiológica. Gris significa “no destacado”, no “inactivo”. Los nombres de las categorías deben estar visibles.

Permite varios músculos principales. No atribuyas a un músculo la misma función en todos los ejercicios: las asociaciones pertenecen a la variante, no al músculo de forma permanente.

El cuerpo debe tener proporciones plausibles y anatomía legible, sin exageraciones ni un estilo que dificulte entender la postura. La persona debe interactuar coherentemente con asiento, respaldo, agarres, poleas, plataforma, mancuernas o barra. Evita penetraciones, articulaciones imposibles y equipos que se mueven de forma mecánicamente incoherente.

### 3.2. Movimiento y correspondencia exacta

La demostración debe coincidir con ejercicio, variante, equipo, agarre, inclinación y lateralidad. Cambiar de variante debe actualizar demostración, técnica y músculos, sin dejar datos de la variante anterior.

Muestra posición inicial, recorrido y retorno controlado desde un ángulo útil. En unilateral identifica el lado; en isométricos muestra mantenimiento de la posición, no repeticiones ficticias.

El resaltado debe seguir la anatomía durante el movimiento. No uses manchas fijas en pantalla ni un overlay que se desalineé. No colorees todo el torso por comodidad cuando el objetivo sea identificar regiones concretas.

No acepto como versión final:
- Una foto o icono en lugar de movimiento.
- Un video convencional y un mapa muscular estático aparte como único resaltado.
- Un stick figure genérico o una animación de otro ejercicio.
- Una demostración sin el equipo necesario.
- Un enlace externo como sustituto del reproductor integrado.
- Una animación inventada sin contrastar la técnica.

Un mapa muscular adicional puede complementar la ficha, pero no reemplaza el resaltado sobre el personaje animado.

### 3.3. Reproductor y capacidades reales

Primera opción: animaciones anatómicas prerenderizadas y autorizadas en MP4/WebM, con el resaltado incorporado. Usa un reproductor accesible, sin audio obligatorio, con pausa, reproducción, reinicio, ampliación y velocidad. `HTMLMediaElement.playbackRate` permite controlar la velocidad en medios compatibles [R10].

Carga primero un poster útil; usa lazy loading y limita las descargas al ejercicio activo y a una precarga razonable. Valida formatos, errores, políticas CORS y comportamiento móvil.

Si el color está integrado en el video, no prometas ocultar cada músculo o recolorearlo dinámicamente. Si el recurso tiene un solo ángulo, no simules un segundo ángulo ni rotación libre. Un GIF simple no debe tener controles de video ficticios.

Vistas adicionales, puntos de interés, etiquetas ancladas y pasos sincronizados se habilitan únicamente con recursos preparados y revisados. Las etiquetas temporales deben pertenecer a cada clip; no asumas que todos tienen las mismas fases o duración.

Segunda etapa opcional: personaje 3D con esqueleto, regiones musculares identificables, equipo y animaciones preparadas. Solo entonces incorpora rotación libre, selección directa y capas interactivas. No introduzcas un motor 3D como condición obligatoria para disponer de buenas demostraciones en la primera versión.

Si construyes animaciones propias, documenta referencias y revisión biomecánica. No consideres suficiente que la animación sea visualmente convincente.

### 3.4. Información anatómica y técnica breve

Bajo el reproductor muestra:

**Músculos objetivo:** nombre común y anatómico accesible.  
**También participan:** colaboradores documentados.  
**Preparación:** una frase.  
**Ejecución:** una frase.  
**Evita:** uno o dos errores frecuentes.

Mantén la técnica inicial en unas 40–70 palabras y ofrece “Ver más” para respiración, ajustes, referencias y detalles. Distingue texto redactado y contrastado de consejos sin revisión. No copies descripciones completas de fuentes restringidas.

Permite notas personales por equipo: “asiento 4”, “respaldo 2”, “agarre neutro”. No derives esos números de mi estatura. Una nota guardada en una máquina no debe aplicarse silenciosamente a otra.

Etiqueta el módulo como **“Músculos implicados”** y añade: **“Representación anatómica orientativa, no medición individual”.** No inventes porcentajes de activación, fatiga, recuperación, crecimiento ni estimaciones basadas solo en los kilos registrados.

No hagas que el color se intensifique al aumentar el peso ni que los músculos se enciendan y apaguen durante una repetición sin una explicación técnica revisada. Es preferible señalar las fases con texto o flechas.

Incluye una indicación discreta para revisar inicialmente la técnica con un entrenador y detener la serie ante dolor inusual. No diagnostiques ni certifiques ejecución mediante esta interfaz.

## 4. Recursos, proveedores, licencias y cobertura

Usa FitnessProgramer como referencia de presentación [R1], Hevy como referencia de registro [R3], y GymVisual y Muscle & Motion como referencias de demostraciones anatómicas [R4–R5]. No copies su identidad, código ni medios sin permiso.

Observaciones verificadas al preparar este encargo:

- **GymVisual:** sus términos contemplan uso de medios adquiridos en apps y webs, sujeto a restricciones. Las previsualizaciones no equivalen a recursos autorizados para producción; hay límites sobre redistribución, crawling y uso de sus medios para generar contenido con IA [R4].
- **Muscle & Motion:** el permiso habitual para compartir en redes no autoriza integrar contenido en una app propia. Su página de uso contempla licencias comerciales específicas, incluida integración mediante embed [R5].
- **MuscleWiki API:** sus condiciones consultadas, actualizadas el 8 de octubre de 2026, restringen la descarga y almacenamiento de video; no es una base para prometer reproducción offline de esos videos. Respeta además las reglas vigentes de caché, atribución y autenticación [R6].
- **wger:** puede evaluarse como catálogo, pero comprueba derechos de cada recurso y cobertura efectiva. No presupongas que cada ejercicio tiene una animación anatómica utilizable [R7].

Estas notas no sustituyen los términos completos. Verifica la licencia concreta para uso, modificación, distribución, alojamiento, caché, atribución y duración. Ante ambigüedad, deja el recurso pendiente de autorización y utiliza una vía compatible. No realices compras, suscripciones ni contactos externos sin permiso.

Prioriza medios propios, abiertos compatibles o adquiridos con autorización. No hagas scraping de catálogos, hotlinking restringido, eliminación de marcas ni descargas masivas. No subas medios restringidos a repositorios públicos o herramientas generativas. Comprar acceso no significa poder redistribuir los archivos fuente.

Crea un manifiesto con:
`assetId`, `exerciseId`, `variantId`, `provider`, `sourceUrl`, `author`, `license`, `licenseUrl`, `attribution`, `mediaType`, `deliveryMode`, `storagePolicy`, `expiresAt`, `capabilities`, `technicalReviewStatus`, `rightsReviewStatus`, `lastVerifiedAt`.

Separa revisión legal, correspondencia del ejercicio y revisión técnica. No uses un único booleano “validado” para cosas diferentes.

Entrega una matriz de cobertura de todas las variantes principales y alternativas habilitadas: recurso, tipo de animación, derechos, disponibilidad offline, músculos, estado técnico y faltantes. No cuentes un video convencional como cobertura anatómica completa.

Si falta un recurso, ofrece incorporar uno autorizado y muestra el estado real. El tracking debe funcionar igualmente. No presentes una biblioteca con placeholders como si estuviera terminada.

## 5. Rutina inicial precargada y editable

Programa inicial: **8 semanas**, con fecha de inicio elegida por el usuario. La siguiente rutina es la configuración previamente acordada para esta app, no una prescripción médica nueva ni un programa validado por las fuentes de software.

Días sugeridos: lunes superior A, martes inferior A, jueves superior B y sábado inferior B. Miércoles, viernes y domingo: descanso o actividad opcional.

### Lunes — Tren superior A

| Ejercicio | Series × repeticiones | Descanso | Alternativa seleccionable |
|---|---|---|---|
| Press de pecho en máquina | 3 × 8–12 | 90 s | Press de pecho con mancuernas |
| Jalón al pecho en polea | 3 × 8–12 | 90 s | Jalón con otro agarre cómodo y definido |
| Remo sentado en máquina | 2 × 10–12 | 75 s | Remo sentado en polea |
| Press de hombros en máquina | 2 × 8–12 | 75 s | Press sentado con mancuernas |
| Elevaciones laterales con mancuernas | 2 × 12–15 | 60 s | Elevaciones laterales en polea |
| Extensión de tríceps en polea | 2 × 10–15 | 60 s | Máquina de extensión de tríceps |

### Martes — Tren inferior A

| Ejercicio | Series × repeticiones | Descanso | Alternativa seleccionable |
|---|---|---|---|
| Prensa de piernas | 3 × 10–12 | 90 s | Sentadilla goblet |
| Peso muerto rumano con mancuernas | 3 × 8–10 | 90 s | Peso muerto rumano con barra |
| Curl femoral en máquina | 2 × 10–15 | 75 s | Variante sentada o acostada, identificada |
| Extensión de cuádriceps | 2 × 10–15 | 60 s | Otra máquina equivalente, identificada |
| Elevación de pantorrillas | 2 × 12–15 | 60 s | Variante con mancuernas o Smith |
| Pallof press en polea | 2 × 10 por lado | 60 s | Variante antirotación en polea, identificada |

### Jueves — Tren superior B

| Ejercicio | Series × repeticiones | Descanso | Alternativa seleccionable |
|---|---|---|---|
| Press inclinado con mancuernas | 3 × 8–12 | 90 s | Press inclinado en máquina |
| Jalón al pecho con agarre neutro | 3 × 8–12 | 90 s | Jalón con otro agarre cómodo y definido |
| Remo con apoyo de pecho | 2 × 10–12 | 75 s | Remo sentado en máquina |
| Aperturas inversas en máquina | 2 × 12–15 | 60 s | Aperturas inversas en polea |
| Elevaciones laterales en polea | 2 × 12–15 | 60 s | Elevaciones laterales con mancuernas |
| Curl de bíceps en polea | 2 × 10–15 | 60 s | Curl con mancuernas |

### Sábado — Tren inferior B

| Ejercicio | Series × repeticiones | Descanso | Alternativa seleccionable |
|---|---|---|---|
| Sentadilla en Smith | 3 × 8–12 | 90 s | Prensa de piernas |
| Hip thrust en máquina | 3 × 8–12 | 90 s | Hip thrust en Smith |
| Curl femoral sentado | 2 × 10–12 | 75 s | Curl femoral acostado |
| Zancadas estáticas con mancuernas | 2 × 8 por pierna | 75 s | Sentadilla dividida en Smith |
| Pantorrillas en máquina | 2 × 12–15 | 60 s | Variante con mancuernas |
| Crunch abdominal en polea | 2 × 10–15 | 60 s | Máquina abdominal |

Las alternativas no tienen por qué ser equivalentes en carga, estabilidad o técnica. No transfieras automáticamente pesos entre ellas. Una alternativa genérica debe concretarse en una variante antes de mostrar su demostración o comparar PR. Cuando no exista una sustitución directa adecuada, indícalo en vez de inventarla.

Adaptación: semanas 1–2, dos series de trabajo por ejercicio. Desde la tercera semana, las series indicadas, permitiendo prolongar o modificar la adaptación. RIR inicial orientativo 2–3, editable. Explica RIR como “repeticiones adicionales que crees que podrías realizar”.

Separa semana calendario, semana del programa y sesiones completadas. La adaptación no debe desaparecer silenciosamente por pasar dos semanas sin entrenar; ofrece mantenerla y registra la decisión.

Distribución orientativa: 7 minutos de calentamiento, 40 de fuerza, 10 de cardio y 3 de cierre. Permite ajustarla. No acortes descansos ni elimines series para forzar exactamente 60 minutos. Las aproximaciones son distintas de las series de trabajo.

## 6. Modo entrenamiento y registro por serie

Iniciar entrenamiento crea una sesión con identificador propio y una copia de la prescripción de ese momento. No edites directamente la plantilla al registrar una sesión.

La pantalla activa muestra ejercicio, demostración, técnica breve, objetivo, registro anterior comparable con fecha, tiempo de sesión, descanso y progreso.

Cada fila de serie contiene número, tipo, carga, repeticiones, RIR opcional y estado. Los ejercicios por tiempo admiten duración; los unilaterales deben expresar claramente si se registran repeticiones por lado o totales.

Permite añadir, eliminar, duplicar y reordenar series; marcar calentamiento o trabajo; sustituir ejercicios; añadir notas; pausar y finalizar parcialmente. Duplicar una serie copia sus valores, pero no su estado de completada ni su fecha de ejecución.

Los valores sugeridos del entrenamiento anterior no son resultados realizados. Solo cuenta una serie al confirmarla con datos válidos. No conviertas campos vacíos en cero. Diferencia “carga no registrada” de una carga externa legítimamente igual a cero.

Acepta punto y coma decimal. Rechaza valores negativos, repeticiones no enteras y duraciones inválidas. Para cifras inusuales muestra una confirmación razonable, sin imponer límites rígidos arbitrarios. Mantén tipos y validación comunes entre interfaz, dominio e importación.

Guarda ediciones como borradores y confirma las series de forma transaccional. Muestra “Guardado” solo después de que finalice la escritura. Ante cuota agotada o error, conserva lo introducido, informa el problema y ofrece respaldo o reintento.

Recargar, navegar o volver tras suspender la pestaña debe recuperar la sesión. Evita duplicados por doble toque y sobrescrituras silenciosas entre dos pestañas; utiliza una política explícita de sesión activa y revisión de cambios.

Implementa deshacer para acciones recientes. Editar, desmarcar o borrar una serie actualiza derivados y PR. Finalizar no debe marcar como realizadas las series pendientes. Permite corregir sesiones históricas con un aviso claro de que se recalcularán las estadísticas.

## 7. Descansos y temporizadores

Inicia el descanso al confirmar una serie de trabajo, salvo configuración contraria. Permite pausar, reanudar, omitir y ajustar el tiempo; ofrece controles simples como +15 s y −15 s sin producir tiempos negativos.

Persiste inicio, final previsto, estado y pausas. Al volver a la app recalcula el tiempo restante a partir de esos datos; no uses un contador en memoria como única fuente de verdad. Maneja cambios del reloj del dispositivo de forma razonable y no muestres resultados absurdos.

En unilateral define si el descanso ocurre entre lados o después de ambos. No dupliques automáticamente el descanso por representar dos lados.

No reinicies el contador al editar una nota, navegar o renderizar. El sonido, vibración y mantener la pantalla encendida son opciones de mejora progresiva cuando el navegador lo permita; solicita permisos solo cuando corresponda y ofrece fallback.

No prometas avisos infalibles con el teléfono bloqueado o el navegador suspendido. El tiempo de sesión y el tiempo de descanso son conceptos distintos, con pausas registradas explícitamente.

## 8. Cargas, volumen, PR y progresión

### 8.1. Qué significa cada carga

Cada variante/equipo debe declarar la convención de carga:
- Peso por mancuerna.
- Carga externa total.
- Discos añadidos.
- Valor indicado en una pila de máquina.
- Resistencia nominal u otra convención claramente identificada.

No asumas que una barra Smith pesa 20 kg. Permite registrar discos añadidos y, únicamente si se conoce, resistencia inicial declarada del equipo. Identifica el dato como tal, sin fingir una medición de resistencia efectiva.

Conserva unidad original, valor normalizado y regla utilizada cuando haya conversión. No cambies retroactivamente el significado de las cargas al modificar preferencias.

La clave de comparación incluirá como mínimo variante, instancia de equipo cuando corresponda, configuración relevante, lateralidad y convención de carga. No mezcles registros de máquina y peso libre, agarres distintos o máquinas distintas.

Si el equipo no está identificado, indica “comparabilidad no confirmada”. No transfieras el último peso de otra variante como una recomendación segura. Los valores nominales de dos máquinas no son automáticamente intercambiables.

### 8.2. Volumen registrado

Define el volumen de carga registrado como suma de carga normalizada × repeticiones válidas. Documenta explícitamente qué significa normalizar para cada configuración.

Casos de prueba ilustrativos de contabilidad, no prescripciones de entrenamiento:
- Dos mancuernas de 10 kg, 10 repeticiones simultáneas: 20 × 10 = 200 kg·repeticiones.
- Curl unilateral de 10 kg, 10 repeticiones por brazo: 10 × 10 + 10 × 10 = 200 kg·repeticiones.
- Registrar esas repeticiones como dos filas por lado no puede volver a multiplicar el resultado por dos.

No apliques la misma regla sin revisar a un ejercicio unilateral que sostenga dos mancuernas. Representa por separado carga externa, número de implementos y forma de contar repeticiones.

Excluye calentamientos de los indicadores de trabajo por defecto y deja visible la definición. No calcules volumen de repeticiones para isométricos o cardio; usa métricas adecuadas y diferenciadas.

Etiqueta los resultados como volumen registrado, no trabajo mecánico, calorías ni una medida universal de esfuerzo. No interpretes un agregado entre máquinas distintas como una mejora inequívoca de fuerza.

### 8.3. Récords personales

Implementa PR por contexto comparable:
- Mayor carga registrada en una serie de trabajo completada.
- Más repeticiones con la misma carga.
- Mayor volumen de una serie.
- Mayor volumen de una sesión del mismo ejercicio y contexto.

Distingue primer registro, empate y nuevo récord. La mayor carga es un récord de carga registrada, no necesariamente de fuerza fisiológica o calidad técnica.

Usa únicamente series válidas y completadas. Excluye calentamiento, demo, borradores y registros eliminados. Los PR son derivados de los logs y deben recalcularse cuando cambien.

Distingue el mejor resultado vigente de las mejoras históricas. Si se corrige una sesión antigua, reconstruye la secuencia cronológica sin generar nuevas celebraciones por simple importación o recálculo.

Durante una sesión, una celebración provisional debe ser reversible al corregir o desmarcar la serie. Cada PR enlaza al registro que lo originó.

No exijas pruebas de 1RM ni añadas un estimador como condición para usar la app. No conviertas la experiencia en una competición que premie ignorar dolor o técnica.

### 8.4. Doble progresión explicable

Cuando complete todas las series de trabajo prescritas en el extremo superior del rango, con técnica confirmada por mí y RIR compatible con el objetivo, ofrece considerar el menor incremento disponible del equipo.

Ejemplo de texto: “Completaste 3 × 12 con esta carga. Puedes considerar el siguiente incremento disponible”. Presenta el motivo y deja aceptar, posponer o ajustar.

Si falta RIR u otra información necesaria, pide confirmación contextual o mantén una recomendación neutral. No infieras que toda serie fue fácil porque llegó al número previsto.

No sugieras aumentar ante dolor reportado, deterioro técnico o sesión incompleta. No impongas porcentajes fijos a todas las máquinas. No apliques cambios de carga sin mi confirmación ni reescribas registros pasados.

## 9. Calendario y planificación

Incluye vistas mensual, semanal y agenda. Estados: planificado, en curso, completado, parcial, omitido y descanso, distinguidos mediante texto además de color.

Permite crear sesiones, mover fechas, editar mediante arrastre y controles accesibles, consultar el historial y reprogramar. Una sesión pasada sin registro no debe transformarse en “completada”; distingue pendiente de clasificar y omisión confirmada cuando sea útil.

Al editar una recurrencia pregunta “solo esta sesión” o “esta y las futuras”. No modifiques sesiones realizadas. Evita duplicados y conserva referencias entre instancia programada y sesión real.

Si omito un día, ofrece reprogramar; no dupliques automáticamente el volumen para compensarlo ni fuerces cuatro días consecutivos.

Usa `America/Santiago` como zona IANA, no un offset fijo. Modela fechas de planificación como fechas locales, e inicio/cierre de sesiones como instantes con contexto de zona. No conviertas sin cuidado `YYYY-MM-DD` en una fecha que aparezca el día anterior por UTC.

Prueba medianoche, meses de distinta duración, cambio de año y transiciones horarias. Cambiar la zona preferida no debe alterar silenciosamente la fecha local original de una sesión histórica.

La exportación `.ics` es una mejora posterior si se implementa y prueba correctamente. No presentes una descarga de calendario como sincronización bidireccional. La integración con Google Calendar requiere una fase explícita de autorización; no es requisito del MVP.

## 10. Progreso y mediciones

Presenta datos reales filtrables por período, ejercicio y contexto comparable:

| Métrica | Presentación y límites |
|---|---|
| Sesiones completadas por semana | Número y acceso al historial |
| Cumplimiento | Sesiones cumplidas frente a las previstas hasta la fecha; definición visible |
| Cargas y repeticiones | Evolución por variante/equipo comparable |
| PR | Tipo, fecha y serie de origen |
| Volumen | Por ejercicio/contexto, con convención documentada |
| Duración | Sesión y pausas diferenciadas |
| Peso y cintura | Mediciones ingresadas por el usuario, con fecha |
| Cardio | Duración, distancia e intensidad percibida opcional |

Los períodos sin datos no equivalen a cero. Las gráficas deben permitir abrir los registros originales y tener una alternativa textual o tabular accesible.

No uses peso y estatura para inventar una meta, grasa corporal o progreso estético. No rellenes históricos ni generes falsas rachas. Muestra cómo se tratan las sesiones parciales y los cambios de planificación al calcular cumplimiento.

Permite objetivos propios de constancia y rendimiento. Un resumen muscular semanal, si se añade, será de ejercicios/series asociados a músculos según una regla publicada, no una medición de activación, recuperación o fatiga. No cuentes series indirectas como fracciones fisiológicamente exactas sin justificarlo.

No incluyas fotos corporales, redes sociales, rankings entre usuarios, nutrición clínica ni recomendaciones de suplementos en el MVP. Mantén foco en entrenamiento y aprendizaje del movimiento.

## 11. Edición y modelo de datos

Todo lo operativo debe poder editarse desde la interfaz: programas, ejercicios, variantes, orden, series, repeticiones, descansos, alternativas, días, equipo, incrementos, notas y preferencias.

Modelo orientativo, ajustable sin perder responsabilidades:

| Entidad | Responsabilidad |
|---|---|
| UserProfile | Datos y preferencias del usuario |
| Exercise / ExerciseVariant | Identidad del ejercicio y configuración del movimiento |
| Muscle / ExerciseMuscleRole | Nombres, papel por variante, fuentes y revisión |
| ExerciseMedia | Archivo, capacidades, correspondencia, derechos y entrega |
| EquipmentInstance | Máquina concreta, ajustes y convención de carga |
| RoutineTemplate / RoutineVersion | Prescripción editable y versiones |
| ProgramSchedule / ScheduledWorkout | Recurrencias y sesiones planificadas |
| WorkoutSession | Ejecución real, estado y copia de prescripción |
| SessionExercise | Ejercicio/configuración realmente utilizados |
| SetLog | Serie, resultados, tipo, lado y completitud |
| BodyMeasurement / CardioLog | Mediciones y actividad aeróbica |
| RestTimerState | Estado recuperable del descanso |

Usa identificadores estables, fechas de creación/actualización y esquema versionado. Las sesiones deben conservar suficiente información propia para poder leerse aunque se archive una plantilla o desaparezca un proveedor.

No conviertas esa copia histórica en una forma de conservar indefinidamente contenido de terceros que deba expirar por licencia. Separa mis datos de ejecución, mis identificadores y notas, de la caché externa sujeta a condiciones.

Archivar un ejercicio o programa no elimina sus logs. Borrar historia requiere confirmación explícita y respaldo disponible. Los cálculos de PR y progreso deben poder reconstruirse desde los registros, no depender de contadores manuales desincronizables.

## 12. Persistencia, offline y respaldos

Construye la primera versión **local-first**, sin cuenta obligatoria ni backend para registrar sesiones. Usa IndexedDB para datos estructurados y un esquema versionado [R8]; Dexie puede simplificar su uso si encaja en el proyecto [R13]. No uses `localStorage` como única base del historial.

El service worker debe permitir cargar el shell y los recursos autorizados preparados para uso offline [R11]. Define una política explícita por recurso, no una caché indiscriminada de todo el tráfico.

Distingue en la interfaz:
- Mis datos disponibles localmente.
- Catálogo propio o compatible disponible offline.
- Medios legalmente descargados y listos.
- Medios que requieren conexión.
- Recursos faltantes, vencidos o pendientes de autorización.

La caída del proveedor visual nunca bloquea registrar una serie. El hecho de tener datos locales no autoriza a almacenar cualquier video de terceros.

Gestiona cuotas y almacenamiento persistente cuando exista soporte mediante las capacidades del navegador [R12]. No describas la persistencia local como respaldo, cifrado automático, sincronización entre dispositivos o garantía contra borrado.

Implementa exportación completa de datos propios a JSON con `schemaVersion`, validación de importación, vista previa, política de conflictos, detección de duplicados por IDs y respaldo previo a reemplazos. Una importación inválida no puede dejar la base parcialmente modificada.

Incluye CSV para sesiones y series. Escapa comillas y separadores, preserva unidades y neutraliza fórmulas potencialmente peligrosas en campos de texto exportados. Define un formato de fecha inequívoco.

No exportes claves, tokens, URLs firmadas sensibles ni medios restringidos. Las referencias a recursos y sus condiciones pueden viajar como metadatos cuando sea compatible.

Ofrece “Último respaldo” y avisos discretos configurables. Explica que borrar datos del navegador puede eliminar el historial local. Los datos personales no deben subirse a servicios externos por defecto.

Las migraciones deben preservar sesiones activas. Una actualización del service worker no puede reiniciar la app a mitad de una serie sin aviso; ofrece aplicar cuando sea seguro.

## 13. Stack, arquitectura y seguridad

Reutiliza el stack existente cuando sea viable. En un proyecto nuevo, propuesta inicial:

- React + TypeScript + Vite.
- Tailwind CSS o un sistema de estilos equivalente con tokens.
- Componentes accesibles y Motion para microinteracciones cuando aporte valor.
- IndexedDB + Dexie.
- Zod o validación tipada equivalente.
- Biblioteca de gráficas compatible con React y alternativa accesible.
- Vitest y Testing Library para pruebas unitarias/integración.
- Playwright para flujos end-to-end.
- Manifest y service worker para instalación y offline progresivos.

Consulta documentación vigente y elige versiones estables compatibles, sin inventar imports ni fijar versiones por memoria. Conserva el lockfile. No introduzcas dependencias grandes para resolver una función trivial.

Organiza por funcionalidades y separa interfaz, dominio, persistencia y proveedores. PR, volumen, progresión, fechas e importación deben poder probarse sin renderizar la interfaz.

No añadas microservicios, LLM, RAG, cuentas, suscripciones, pagos ni una base remota como requisitos del MVP. Deja puntos de extensión razonables, no abstracciones enormes para necesidades hipotéticas.

Si un proveedor exige secretos, no los pongas en `VITE_*`, JavaScript público, bundle, almacenamiento del navegador, logs ni repositorio. Propón una integración server-side separada; no hagas obligatoria una arquitectura pagada sin presentar primero el requisito.

Valida importaciones y medios personalizados. No renderices HTML arbitrario de notas ni ejecutes código de archivos importados. Controla protocolos, tamaño y tipo de recursos; evita SVG no confiables sin sanitización.

No añadas analítica ni rastreadores por defecto. Informa cuando un reproductor externo implique conexiones a terceros. No asegures cifrado o privacidad absoluta sin haberlo implementado y verificado.

Documenta despliegue estático, HTTPS, rutas, base path y service worker. Prueba recarga en rutas profundas. Si se usa GitHub Pages, comprueba la configuración real del repositorio; no supongas permisos de publicación.

## 14. Pruebas y criterios de aceptación

Implementa pruebas automatizadas donde corresponda y revisiones manuales para anatomía, correspondencia de medios y experiencia móvil. No confundas un test técnico con validación biomecánica profesional.

- [ ] Inicio una sesión, registro una serie, recargo y recupero exactamente los datos.
- [ ] Puedo continuar registrando offline tras preparar la app.
- [ ] Los valores sugeridos y borradores no se contabilizan como realizados.
- [ ] Doble toque y dos pestañas no duplican ni sobrescriben silenciosamente series.
- [ ] Editar una plantilla no altera sesiones anteriores.
- [ ] Cambiar de variante actualiza demostración, músculos y técnica.
- [ ] Las demostraciones muestran persona, máquina y resaltado anatómico coherente.
- [ ] Un recurso ausente se identifica sin sustituirlo por otro movimiento.
- [ ] Las funciones del reproductor corresponden a sus capacidades reales.
- [ ] El error de un proveedor visual no bloquea el tracking.
- [ ] Equipos distintos no mezclan PR ni cargas previas sin confirmación.
- [ ] Primer registro, empate y nuevo PR son estados diferentes.
- [ ] Editar o borrar una serie recalcula récords actuales e históricos.
- [ ] Carga por mancuerna, dos implementos y repeticiones por lado no se duplican.
- [ ] Punto/coma decimal, campos vacíos y cero explícito se tratan correctamente.
- [ ] Un descanso se recupera tras navegar, suspender y volver.
- [ ] El calendario funciona cerca de medianoche y transiciones de America/Santiago.
- [ ] Las sesiones parciales, omisiones y reprogramaciones conservan sentido.
- [ ] Exportar/importar mantiene datos, unidades e identificadores sin duplicados.
- [ ] Un archivo inválido no modifica parcialmente la base.
- [ ] Las migraciones y actualizaciones preservan una sesión activa.
- [ ] Existe feedback y recuperación razonable ante errores de almacenamiento.
- [ ] La interfaz móvil no desborda ni oculta controles con el teclado abierto.
- [ ] Hay navegación accesible, foco visible, alternativas al color y reduced motion.
- [ ] No existen claves privadas, datasets restringidos o medios sin derechos en la entrega.
- [ ] La aplicación real no incluye historial, PR o métricas ficticias.

El modo demo, si existe, debe estar completamente separado, identificado y ser descartable sin tocar los datos reales.

## 15. Secuencia de implementación y entregables

### Etapa A — Base y prueba vertical

Inspecciona el proyecto, define modelo de datos y diseño. Audita cobertura y permisos de medios desde el inicio. Construye un flujo funcional con press de pecho, jalón y prensa: demostración anatómica autorizada, técnica breve, registro, descanso y persistencia.

Si falta un medio autorizado, implementa el componente y su estado pendiente sin fingir cobertura; documenta qué recurso permitiría cerrarla. No dejes toda la parte anatómica para el final.

### Etapa B — Uso diario completo

Precarga los cuatro días y la adaptación. Implementa editor, sesiones, sustituciones, registro anterior, borradores, pausas y recuperación. Valida en móvil el recorrido completo de un entrenamiento.

### Etapa C — Historial y análisis

Añade calendario, PR, doble progresión, mediciones y gráficas. Completa respaldos, importación, offline y protección de datos.

### Etapa D — Cierre de calidad

Audita cobertura visual y licencias, correspondencia anatómica, rendimiento, accesibilidad, cuotas, migraciones y pruebas. Elimina placeholders funcionales y datos de muestra en la experiencia real.

Entrega:
1. Código ejecutable y mantenible, con rutina inicial configurada.
2. README de instalación, desarrollo, pruebas y despliegue.
3. Resumen de arquitectura y decisiones relevantes.
4. Pruebas implementadas y resultados realmente ejecutados.
5. Manifiesto de medios, atribuciones y política de almacenamiento.
6. Matriz de cobertura de demostraciones y revisión técnica.
7. Guía de respaldo/importación y limitaciones de almacenamiento local.
8. Pendientes concretos, sin presentar funciones simuladas como completas.

No afirmes haber publicado, comprado licencias, ejecutado pruebas o validado anatomía si no ocurrió. No declares terminado el módulo visual con recursos genéricos o sin derechos.

**Criterio final:** debo poder entrar al gimnasio, abrir la sesión, ver una persona realizando el ejercicio con su equipo y sus músculos destacados, entender la técnica, registrar cada serie, descansar y consultar mi progreso sin perder datos ni necesitar modificar código.

## 16. Referencias verificadas y cómo utilizarlas

Consultadas el **11 de octubre de 2026**. Son referencias del encargo y comprobaciones de capacidades/condiciones, no autorizaciones universales de uso. Al implementar revisa sus versiones vigentes. Los requisitos de producto y los casos numéricos de este prompt son decisiones de diseño; no se presentan como conclusiones de estas fuentes.

**[R1] FitnessProgramer — referencia aportada por el usuario.**  
https://fitnessprogramer.com/workout/add-aff-agg/  
Sirve para observar organización de ejercicios y acceso a fichas. No importes su rutina: este encargo utiliza el programa de gimnasio incluido arriba.

**[R2] FitnessProgramer — condiciones.**  
https://fitnessprogramer.com/terms-and-conditions/  
Revisa los derechos antes de reutilizar texto, imágenes o demostraciones. Una página visible no implica permiso de redistribución.

**[R3] Hevy — funciones de producto.**  
https://www.hevyapp.com/features/  
Referencia funcional de registro por serie, valores previos, descansos, PR y seguimiento. No es una especificación para clonar su interfaz ni sus servicios.

**[R4] GymVisual — términos y licencia de medios.**  
https://gymvisual.com/content/3-terms-and-conditions-of-use  
Fuente para verificar alcance de uso de recursos adquiridos y restricciones. Mantén los archivos restringidos fuera del repositorio y de herramientas generativas cuando los términos lo exijan.

**[R5] Muscle & Motion — uso de contenido y licencias comerciales.**  
https://www.muscleandmotion.com/knowledge-center/content-usage/  
Distingue permiso para redes sociales, acceso mediante enlaces y licencia de integración. Una suscripción personal no autoriza por sí sola incorporar los medios a esta app.

**[R6] MuscleWiki API — términos de uso.**  
https://api.musclewiki.com/api-terms  
La página consultada indica actualización del 8 de octubre de 2026. Verifica especialmente reproducción, caché, almacenamiento, atribución y secretos; no construyas el offline de videos suponiendo derechos que no concede.

**[R7] wger — documentación oficial del proyecto.**  
https://wger.readthedocs.io/en/latest/  
Punto de partida para evaluar catálogo/API. La cobertura visual y los derechos de cada recurso requieren comprobación independiente.

**[R8] MDN — IndexedDB API.**  
https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API  
Referencia para almacenamiento estructurado y transacciones del navegador.

**[R9] W3C — Understanding SC 1.4.1: Use of Color.**  
https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html  
Respalda no comunicar categorías únicamente mediante color; añade etiquetas y alternativas perceptibles.

**[R10] MDN — HTMLMediaElement.playbackRate.**  
https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate  
Referencia para controles reales de velocidad de reproducción en medios compatibles.

**[R11] MDN — Service Worker API.**  
https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API  
Referencia para shell, gestión de solicitudes y recursos preparados para uso offline. La capacidad técnica de caché no constituye permiso de almacenamiento de terceros.

**[R12] MDN — StorageManager.**  
https://developer.mozilla.org/en-US/docs/Web/API/StorageManager  
Referencia para consultar cuotas y solicitar persistencia cuando exista soporte.

**[R13] Dexie — documentación oficial.**  
https://dexie.org/docs  
Referencia del adaptador propuesto para IndexedDB. La elección debe encajar en el stack y no implica contratar sincronización cloud.

---

**Fin del prompt. Comienza inspeccionando el entorno y construyendo la primera prueba vertical; continúa con la implementación, pruebas y documentación.**
