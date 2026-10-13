# Respaldo, importación y límites del almacenamiento local

## Dónde están tus datos

Todo se guarda en **IndexedDB de este navegador, en este dispositivo**. Eso significa:

- **No es un respaldo.** Si borras los datos del sitio, desinstalas el navegador, usas navegación privada o el sistema libera espacio, el historial puede perderse.
- **No se sincroniza** entre dispositivos ni navegadores.
- **No está cifrado por ATLAS** (aplica la protección que tenga tu dispositivo).
- Al abrir la app se solicita **almacenamiento persistente** cuando el navegador lo permite. Puede negarlo; tampoco es un respaldo.

## Exportar

*Inicio → Ajustes → Respaldo*:

- **Exportar respaldo (JSON):** un archivo `atlas-respaldo-AAAA-MM-DD-HH-MM.json` con `app`, `schemaVersion`, `exportedAt` y todas las tablas de usuario (perfil, preferencias, catálogo, equipos y notas, plantilla y versiones, programa y calendario, sesiones, series, descansos, mediciones, cardio, decisiones y metadatos de medios externos). Se registra la fecha como "Último respaldo".
- **Exportar para una hoja de cálculo:** descarga cada CSV por separado (`atlas-sesiones-…csv` y `atlas-series-…csv`), para evitar bloqueos de descargas múltiples en el teléfono. Separador coma, punto decimal, fechas ISO 8601 con desfase local (p. ej. `2026-10-11T09:30:00-03:00`) y zona IANA. Las series incluyen carga, unidad, carga normalizada en kg, convención, implementos, lateralidad, modo de repeticiones y volumen registrado. Los textos que empiezan por `=`, `+`, `-`, `@`, tabulación o retorno se prefijan con `'` para que una hoja de cálculo no los ejecute. El CSV no sirve para restaurar la app.

El respaldo **no incluye** claves, tokens ni archivos de medios de terceros (solo sus metadatos, si registraste alguno).

Los nombres de archivo y la fecha del último respaldo usan la zona del perfil (`America/Santiago` inicialmente). La app prepara la descarga; comprueba que conservaste el archivo. La interfaz actual no incluye recordatorios automáticos de respaldo.

## Importar

1. *Importar respaldo* → elige el archivo JSON.
2. Se valida el archivo antes de confirmar cambios: estructura, campos necesarios para abrir la app, tablas conocidas, ids únicos, zonas horarias y valores (cargas no negativas, repeticiones enteras, fechas válidas, URLs `https`…). También se comprueban las relaciones entre registros dentro de la transacción. Si algo falla se listan los errores y **la base no se modifica**. Los respaldos de un esquema más nuevo que la app se rechazan.
3. **Vista previa:** por tabla, cuántos registros son nuevos, idénticos (mismo id y contenido) o en conflicto (mismo id, contenido distinto).
4. **Política:**
   - *Añadir solo lo nuevo* — conserva lo actual en conflictos (no duplica nada: la detección es por id).
   - *Añadir y reemplazar lo distinto* — exige preparar antes un respaldo de los datos actuales y finalizar la sesión en curso.
   - *Reemplazar todo por el archivo* — exige el respaldo previo, un archivo completo y finalizar la sesión en curso. Un archivo parcial no puede vaciar la app.
5. La importación se aplica en **una sola transacción**: si falla a mitad, no queda nada a medias.

La interfaz actual no incluye un botón para borrar toda la base. Eliminar un entrenamiento del historial exige confirmar y lo conserva marcado como descartado en el respaldo.

## Versiones de rutina

La rutina v2 actualiza la plantilla original v1 únicamente si sigue intacta y no hay sesión activa. Guarda ambas versiones en `routineVersions`, que se exporta en JSON. Conserva sesiones, calendario y decisiones.

Para volver a la rutina anterior, importa un respaldo JSON previo con una política que reemplace la plantilla, después de finalizar el entrenamiento y conservar los datos actuales. La importación marca las plantillas realmente incorporadas para que una actualización automática no las sustituya; la marca se guarda en la misma transacción. Una fusión que no escribe la plantilla no cambia su procedencia.

Las importaciones antiguas idénticas a v1, hechas antes de registrar esa procedencia, son indistinguibles de la plantilla inicial. Se mantiene el historial y se conserva v1 al actualizarlas. La protección no modifica el formato del respaldo ni exige borrar la base.

## Limitaciones conocidas

- El navegador puede negar el almacenamiento persistente; depende de su política (uso, instalación como app, espacio).
- Con la cuota agotada, las escrituras fallan: la app conserva lo que escribiste en pantalla, muestra el error y sugiere exportar un respaldo.
- El borrador se guarda al escribir, con una espera de 250 ms, y al ocultar o salir de la página. Un cierre forzado antes de confirmar la escritura en IndexedDB puede perder la última entrada; no es una garantía contra apagados.
- Los medios externos (si registras alguno) requieren conexión y no forman parte del respaldo.
