---
name: ui-ux-visual-polish
description: Mejora la presentacion y accesibilidad visual de frontend-urban sin cambiar contratos, rutas, permisos, datos ni flujos de negocio.
---

# Pulido visual UrbanBlade

Usa esta skill al mejorar la UI/UX de `frontend-urban` cuando el producto ya funciona y el alcance es visual.

## Limites innegociables

- Conserva contratos de API, autenticacion, rutas, permisos, composables y acciones de mutacion.
- Respeta los cuatro temas mediante tokens existentes; no introduzcas paletas hardcodeadas.
- `AppSidebarV2.vue` conserva la navegacion y permisos de `useNavigation()`; los shells moviles se preservan.
- Las mascotas comunican estado: no cubras contenido ni controles y conserva `prefers-reduced-motion`.
- Revisa `git status` y el diff de los archivos a tocar; no sobrescribas cambios locales ajenos.

## Criterios del pase

Prioriza jerarquia, legibilidad, foco de teclado visible, objetivos tactiles de 44 px, contraste por tema, estados hover/activo/disabled y responsive. No conviertas un control visual en una funcion nueva.

No inicies ni reinicies el servidor de desarrollo si el usuario indica que ya esta corriendo. Si surge un defecto funcional o vulnerabilidad, reportalo con evidencia breve sin corregirlo durante el pase visual.
