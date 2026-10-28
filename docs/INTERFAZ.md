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
- Reutilizar el kit existente antes de crear otro selector, modal, badge o tabla.
- No sustituir datos ausentes por cifras o series inventadas.

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
