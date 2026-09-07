# UrbanBlade — identidad, mascotas y sidebar

## Objetivo
Unificar Laravel y Nuxt con una identidad accesible, cuatro temas coherentes, mascotas con propósito y un sidebar inspirado en la claridad estructural de Spike Admin sin copiar su marca o contenido.

## Personajes
- **Nava — Guía de experiencia.** Pantera nacida alrededor de la barbería como punto de encuentro. Representa exploración, cercanía y confianza. Atiende 404, rutas perdidas y estados vacíos.
- **Bladebot — Asistente de precisión.** Creado en el taller digital de UrbanBlade para ordenar sin perder el trato humano. Representa tecnología útil, eficiencia y servicio. Atiende bienvenida, espera, éxito y Concierge.
- **Bruno — Guardián del conocimiento.** Cuervo que conserva las historias y observa antes de resolver. Representa análisis, memoria y criterio. Atiende errores, reportes y ayuda técnica.

## Adaptación por tema
- `noir`: estructura tecnológica, Bladebot, negro y oro.
- `acero`: estructura tecnológica más compacta, Bladebot, grafito y cobre.
- `salon`: estructura editorial, Nava, verde inglés y latón.
- `libreta`: estructura tipo cuaderno, Bruno, marfil, tinta y oro antiguo.

## Fases
1. Identidad base: símbolo UB, favicon, familia de personajes e historias.
2. Sistema de mascotas: componente único y estados `welcome`, `waiting`, `success`, `empty`, `forbidden`, `lost`, `error`.
3. Errores: 401/403/404/419/429/500/503 en Laravel y Nuxt.
4. Estados vacíos: citas, clientes, pagos, productos y notificaciones.
5. Concierge: mascota contextual abre el asistente sin cubrir contenido.
6. Sidebar: navegación agrupada, activo de ancho completo, perfil al pie, colapso persistente, móvil y cuatro variantes temáticas.
7. Rendimiento y QA: formatos modernos, carga diferida, reducción de movimiento, contraste, teclado, responsive y regresión visual.

## Sidebar V2 implementado
- Escritorio: panel lateral flotante de 272 px, separado del viewport y con perfil anclado.
- Modo compacto: rail persistente de 88 px con isotipo, accesos por icono y tooltips.
- Topbar: control de expansión, contexto de página, búsqueda, selector de los cuatro temas, notificaciones y usuario.
- Responsive: el shell V2 sólo actúa desde `md`; la navegación móvil existente se conserva.
- Integración segura: `AppSidebarV2.vue` es independiente del sidebar anterior para no sobrescribir el trabajo paralelo.
- Referencia visual: se adopta el mecanismo de Spike Admin, conservando la identidad, permisos y contenido propios de UrbanBlade.

## Criterios de aceptación
- Misma navegación y permisos en las cuatro variantes.
- Objetivos táctiles de al menos 44 px y foco visible.
- Sin contenido cubierto por mascotas.
- Animación desactivada con `prefers-reduced-motion`.
- ESLint y build sin errores; comparación visual documentada en `design-qa.md`.
