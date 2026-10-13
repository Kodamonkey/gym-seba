# Auditoría del proyecto para uso móvil

Revisión del **12 de octubre de 2026**, contra `objetivos.json`, la rutina acordada y el alcance vigente. Se revisaron interfaz, dominio, IndexedDB, respaldos, temporizador, PWA y pruebas. La emulación se ejecuta con Microsoft Edge instalado; no constituye una prueba en teléfono físico ni una revisión profesional del entrenamiento.

## Alineación con los objetivos

La rutina conserva cuatro días de gimnasio, ocho semanas, adaptación inicial con hasta dos series y RIR objetivo 2–3. No se cambiaron ejercicios, cargas iniciales ni volumen del programa. El reparto orientativo de 7 minutos de calentamiento, 40 de fuerza, 10 de cardio y 3 de cierre ahora aparece en la página del día.

El flujo sigue siendo Inicio → Día → Sesión, con historial y ajustes como accesos secundarios. No se añadieron las pantallas retiradas de editor, calendario, progreso o mediciones. Los registros, estadísticas semanales y valores anteriores salen de los datos reales del dispositivo. Pasar ocho semanas ya no se presenta como haber completado el programa.

La app ayuda a registrar y aprender la rutina. No demuestra que se hayan logrado salud, físico, ocho semanas completas o progresión segura: esos objetivos personales siguen `en_curso`. Las animaciones, textos y roles musculares conservan sus estados pendientes de revisión profesional.

## Problemas corregidos

| Problema encontrado | Resultado |
|---|---|
| Un campo numérico con foco solo guardaba al salir. | Guardado automático de borradores, espera de 250 ms, cola serializada y guardado al ocultar o salir; los borradores no cuentan como realizados. |
| Revisión externa o toma de control podía usar un borrador antiguo. | Se cancelan entradas obsoletas y se conserva el control de revisiones. |
| Sustituir después de una serie aumentaba el total esperado. | Original y alternativa reparten las series pendientes; el total se conserva. Los lados incompletos y calentamientos requieren corregirse antes de sustituir. |
| Sesiones parciales aparecían como hechas en Inicio. | Etiqueta «Parcial» y conteo semanal de completas separado. |
| Sesiones parciales contaban como completas para salir de adaptación. | El umbral usa solo completas; una parcial sigue contando como actividad reciente para evitar avisos falsos de inactividad. Las decisiones anteriores se conservan. |
| Consejo de subir peso comprobaba solo repeticiones. | Se usa el dominio de progresión con estado de sesión, prescripción, técnica, dolor, RIR y comparabilidad. No se sugiere un aumento cuando faltan condiciones. |
| Historial en lb se copiaba como kg. | Conversión de sugerencias y decisiones a la unidad actual; historial conserva su unidad original. |
| Descanso no tenía controles de pausa. | Pausa, reanudación y recuperación tras recarga, además de ±15 s y omitir. |
| CSV existía en código, sin acceso desde Ajustes. | Descarga independiente de sesiones y series, con fechas y unidades reales. JSON sigue siendo el formato para restaurar. |
| Respaldo incompleto podía borrar configuración o catálogo. | Validación estructural y de relaciones dentro de una transacción; reemplazo requiere archivo completo utilizable. |
| Reemplazar datos durante una sesión podía reutilizar revisiones antiguas. | Reemplazos bloqueados mientras hay una sesión activa; exportar y añadir solo lo nuevo siguen disponibles. |
| Controles pequeños, contraste débil e iconos del tema anterior. | Tema claro verde, tarjetas blancas, estados con texto, controles principales de al menos 44 px e iconos PWA propios coherentes. |
| Técnica necesitaba entrar al menú. | Botón directo por ejercicio, con retorno del foco al cerrar. |
| Teclado y descanso podían tapar campos. | El desplazamiento utiliza las dimensiones reales del encabezado, viewport y temporizador. |
| Demostración imponía autoplay pese a preferencia desactivada. | Se respeta `autoplayDemos`; el valor inicial es falso. |

## Verificación

Los resultados ejecutados y sus límites están en `TEST_RESULTS.md`. Las pruebas cubren entradas decimales, recuperación, conflictos entre pestañas, sustituciones, conversión de unidades, importación atómica, descarga CSV, pausa y reanudación, offline y fin del calendario. El flujo móvil se recorre a 320, 375 y 390 px, comprobando desbordamiento horizontal, áreas táctiles y foco.

Se inspeccionaron capturas de Inicio, Día, Sesión, descanso, técnica y Ajustes. Los navegadores de prueba usan contextos aislados y no crean entrenamientos en el perfil de Seba.

## Lo necesario antes de usarla a diario

1. **Hosting HTTPS:** sigue pendiente una URL instalada y comprobada en el celular. El repositorio no se publicó ni se hizo push durante esta auditoría. `README.md` explica build, base y rutas; la app funciona offline después de preparar sus recursos.
2. **Teléfono real:** comprobar instalación Android/iOS, teclado, bloqueo, recuperación y almacenamiento. Un cierre forzado antes de confirmar una escritura en IndexedDB puede perder la última entrada. Sonido y vibración con pantalla bloqueada no están garantizados.
3. **Revisión profesional:** rutina, técnica, animaciones y roles musculares siguen pendientes. Las máquinas de la sede y sus incrementos mínimos no están confirmados.
4. **Progresión completa:** faltan controles para registrar RIR, técnica y dolor, además de identificar la máquina. La orientación actual es conservadora y no inventa esas confirmaciones.
5. **Respaldo:** conservar un JSON periódicamente. IndexedDB y la instalación PWA no sustituyen un respaldo ni sincronizan dispositivos.

Los demás límites permanecen en `PENDIENTES.md`: edición de rutina retirada, equipos por verificar, vistas anatómicas adicionales y funcionalidades fuera de alcance.
