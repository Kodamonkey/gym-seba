# Respaldo, importación y límites del almacenamiento local

## Dónde están tus datos

Todo se guarda en **IndexedDB de este navegador, en este dispositivo**. Eso significa:

- **No es un respaldo.** Si borras los datos del sitio, desinstalas el navegador, usas navegación privada o el sistema libera espacio, el historial puede perderse.
- **No se sincroniza** entre dispositivos ni navegadores.
- **No está cifrado por ATLAS** (aplica la protección que tenga tu dispositivo).
- En *Perfil y ajustes → Almacenamiento* puedes ver el uso aproximado y solicitar **almacenamiento persistente**; reduce el riesgo de borrado automático, pero tampoco es un respaldo.

## Exportar

*Perfil y ajustes → Datos y respaldo*:

- **Exportar respaldo (JSON):** un archivo `atlas-respaldo-AAAA-MM-DD-HH-MM.json` con `app`, `schemaVersion`, `exportedAt` y todas las tablas de usuario (perfil, preferencias, catálogo, equipos y notas, plantilla y versiones, programa y calendario, sesiones, series, descansos, mediciones, cardio, decisiones y metadatos de medios externos). Se registra la fecha como "Último respaldo".
- **Exportar CSV:** dos archivos (`atlas-sesiones-…csv` y `atlas-series-…csv`). Separador coma, punto decimal, fechas ISO 8601 con desfase local (p. ej. `2026-10-11T09:30:00-03:00`) y zona IANA. Las series incluyen carga, unidad, carga normalizada en kg, convención, implementos, lateralidad, modo de repeticiones y volumen registrado. Los textos que empiezan por `=`, `+`, `-`, `@`, tabulación o retorno se prefijan con `'` para que una hoja de cálculo no los ejecute.

El respaldo **no incluye** claves, tokens ni archivos de medios de terceros (solo sus metadatos, si registraste alguno).

Recordatorio configurable en *Preferencias → Recordatorio de respaldo* (por defecto, cada 7 días si hay sesiones registradas).

## Importar

1. *Importar respaldo* → elige el archivo JSON.
2. Se valida todo el archivo antes de tocar la base: estructura, tablas conocidas, ids únicos y valores (cargas no negativas, repeticiones enteras, fechas válidas, URLs `https`…). Si algo falla se listan los errores y **la base no se modifica**. Los respaldos de un esquema más nuevo que la app se rechazan.
3. **Vista previa:** por tabla, cuántos registros son nuevos, idénticos (mismo id y contenido) o en conflicto (mismo id, contenido distinto).
4. **Política:**
   - *Añadir solo lo nuevo* — conserva lo actual en conflictos (no duplica nada: la detección es por id).
   - *Añadir lo nuevo y reemplazar conflictos* — exige descargar antes un respaldo de los datos actuales.
   - *Reemplazar todos mis datos* — exige el respaldo previo; avisa si hay una sesión en curso.
5. La importación se aplica en **una sola transacción**: si falla a mitad, no queda nada a medias.

## Borrar todos los datos

*Datos y respaldo → Borrar todos mis datos…* exige descargar un respaldo y escribir `BORRAR`. Es irreversible.

## Limitaciones conocidas

- El navegador puede negar el almacenamiento persistente; depende de su política (uso, instalación como app, espacio).
- Con la cuota agotada, las escrituras fallan: la app conserva lo que escribiste en pantalla, muestra el error y sugiere exportar un respaldo.
- Los medios externos (si registras alguno) requieren conexión y no forman parte del respaldo.
