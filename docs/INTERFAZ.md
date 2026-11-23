# Interfaz e identidad

La interfaz comparte componentes y navegación entre los temas noir, acero, salon
y libreta. Los estilos no deben duplicar permisos ni lógica de negocio.
Fuentes: [componentes](../app/components), [layouts](../app/layouts),
[useNavigation](../app/composables/useNavigation.ts),
[useTheme](../app/composables/useTheme.ts) y
[useShellState](../app/composables/useShellState.ts).

## Criterios de mantenimiento

- Mantener navegación por rol, estado activo, foco visible y controles con nombre accesible.
- Probar sidebar expandido/compacto, drawer móvil, zoom y contenido largo.
- Respetar reduced motion y contrastes en los cuatro temas.
- El objetivo interno de interacción es 44 px; no afirmar que todo el producto lo cumple
  sin una medición vigente.
- Usar estados vacíos, carga y error que expliquen la acción disponible.
- El dorado como **texto** usa `--gold-text` (en el tema claro es más oscuro que `--gold`); `--gold`
  queda para bordes, iconos y rellenos. El degradado del botón principal usa `--gold-end`.
- El selector de tema es `ShellThemePicker` (radios nativos); no volver a un `<select>` suelto.
- Las páginas públicas no deben desbordar a 320 px (`e2e/SIT/publico-320.spec.ts`) y las pantallas de
  acceso llevan `<main>`.
- Reutilizar el kit existente antes de crear otro selector, modal, badge o tabla.
- No sustituir datos ausentes por cifras o series inventadas.

## Navegación (rediseño de noviembre de 2026)

- El menú del personal usa los mismos grupos y el mismo orden que «Más» en la app Android: Clientes, Caja,
  Inventario, Equipo y catálogo, Análisis y, al final, Sistema (configuración, logs y estado del servidor).
- «Citas» es una sola entrada: la lista y el calendario se cambian con `UiViewSwitch` («Lista | Calendario»),
  que son enlaces a sus rutas, no pestañas. El barbero tiene lo mismo entre su agenda y su calendario.
- El menú del cliente tiene cinco entradas (Inicio, Mis citas, Tienda, Membresía y Notificaciones). Lo demás se
  abre desde la pantalla a la que pertenece con `UiRelatedLinks` y sigue en el buscador (`shortcuts` de
  `useNavigation`). Antes de agregar una entrada al menú, comprobar si cabe como acceso dentro de una pantalla.
- El panel del administrador muestra primero lo de hoy; el desempeño por barbero, las predicciones y el uso de
  Bladebot están en Análisis. Prueba: `e2e/UAT/navegacion.spec.ts`.

## Mascotas

Nava representa orientación/estados vacíos; Bladebot, asistencia/espera/éxito;
Bruno, conocimiento/errores/reportes. La selección por tema y contexto está en
[useBrandMascots](../app/composables/useBrandMascots.ts).
Las mascotas acompañan el contenido sin tapar acciones ni reemplazar textos accesibles.

Los recursos ausentes en el checkout no se recrean ni se restauran automáticamente
por una tarea documental. Una revisión visual necesita los assets de la versión evaluada.

## Evidencia

[Auditoría UI/UX](AUDITORIA_UI_UX.md) conserva la revisión del 2 de octubre y sus
limitaciones; [design-qa](../design-qa.md) conserva el contexto de sidebar.
No son una nueva certificación de accesibilidad o de producción.
La matriz para repetir pruebas está en [PRUEBAS](PRUEBAS.md).
