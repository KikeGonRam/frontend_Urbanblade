---
name: landing-page-plan
description: Mantener la landing existente con SSR, datos y temas coherentes.
---

# Landing pública

Fuente: app/pages/index.vue, componentes públicos y assets/css/main.css.
Consultar [ARQUITECTURA](../../../docs/ARQUITECTURA.md) e
[INTERFAZ](../../../docs/INTERFAZ.md).

No confundir contenido hidratado con HTML inicial: los datos SEO de barbería
usan SSR, mientras las listas de servicios/barberos se cargan en cliente.
No inventar coordenadas, testimonios o métricas. Revisar estados de carga/error,
cuatro temas, responsive, reduced motion y enlaces de reserva.
La existencia de páginas y rutas se comprueba en el código; el plan de septiembre
no es un inventario vigente. Mantener copias sincronizadas.
