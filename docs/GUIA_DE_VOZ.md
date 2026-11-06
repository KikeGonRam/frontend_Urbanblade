# Guía de voz de UrbanBlade

Cómo suena la interfaz. Aplica a la web y se recomienda para la app móvil. Nace de la
[investigación de calidez](INVESTIGACION_UX_CALIDEZ_2026-11-06.md); no es una norma legal ni de marca externa.

## Principios

1. **Cercano y directo:** hablar de tú, frases cortas, sin jerga técnica ni tono de formulario.
2. **Útil antes que simpático:** cada mensaje dice qué pasó y qué se puede hacer ahora.
3. **Honesto:** no decir «listo» si algo sigue en curso ni prometer lo que no está confirmado.
4. **Sin culpar a la persona:** el error es del sistema o de la conexión, no de quien escribe.
5. **Consistente:** el mismo patrón para el mismo caso en todos los roles.

## Patrones

| Caso | Patrón | Ejemplo |
| --- | --- | --- |
| Vacío por falta de datos | «Todavía no hay…» + acción siguiente | «Todavía no hay productos registrados» |
| Vacío temporal | «Por ahora no hay…» + cuándo volver | «Por ahora no hay servicios disponibles» |
| Todo al día | «Estás al día: …» | «Estás al día: no hay comprobantes pendientes» |
| Vacío por filtros | Decir que no hay coincidencias y cómo ampliar | «No encontramos citas con estos filtros» |
| Error de carga | «No se pudo cargar X» + causa probable + «Reintentar» | «No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo» |
| Éxito | Breve y concreto | «Cita confirmada» |
| Acción destructiva | Nombrar lo que se pierde y ofrecer cancelar | «Eliminar a este cliente borra su historial. ¿Continuar?» |

## Evitar

- «Sin …» a secas como título de un estado vacío («Sin registros que mostrar»).
- «Error», «Inválido», «Fallo» sin decir qué hacer.
- Mayúsculas sostenidas fuera de las etiquetas de sección.
- Prometer porcentajes, plazos o políticas que no están en la configuración real.

## Estado

El barrido de la Fase A cubrió los estados vacíos más visibles (16 textos). Los mensajes de error ya traen una
descripción y la acción «Reintentar» en la mayoría de las pantallas. Quedan por revisar los textos de los
estados dentro de tablas y los de la app móvil.
