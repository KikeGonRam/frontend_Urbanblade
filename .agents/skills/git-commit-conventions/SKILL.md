---
name: git-commit-conventions
description: "Prepara mensajes de commit en español para que el usuario humano los ejecute. Ningún proveedor de IA puede crear commits ni hacer push en UrbanBlade."
---

# Convención de commits — UrbanBlade

## Propiedad humana de Git

**Regla absoluta del propietario:** ningún agente o proveedor de IA ejecuta `git
commit`, `git push`, merge, rebase, publicación de PR ni reescritura de historial en
`barber`, `frontend-urban` o `spark`. Tampoco debe pedir permiso para hacerlo: esa
responsabilidad queda reservada al usuario humano.

La IA puede inspeccionar, editar y validar dentro del alcance autorizado. Al finalizar
entrega en español el resumen, archivos afectados, pruebas, pendientes y un mensaje de
commit sugerido, además de comandos opcionales para que el usuario los revise y ejecute.

## Idioma

Todos los mensajes de commit van en **español**, tanto el resumen (primera
línea) como el cuerpo. Términos técnicos sin traducción natural (nombres de
archivos, comandos, clases, métodos, mensajes de error citados tal cual) se
dejan en su idioma original.

## Autoría

Los commits de este repositorio deben quedar a nombre de un solo autor
humano: el dueño del proyecto (`git config user.name`/`user.email` ya
configurado localmente como `KikeGonRam`). No agregar líneas de coautoría de
herramientas de IA (`Co-Authored-By: ...`, `Generated with ...`, badges de
"AI-assisted", o similares) al final del mensaje.

Como las IA ya no crean commits, no debe aparecer coautoría automática de herramientas.
No reescribir commits históricos para quitarla.

## Formato

- Primera línea: resumen corto en imperativo (`Corrige`, `Agrega`,
  `Actualiza`, `Elimina` — no `Corrigiendo`/`Corregido`/`Agregando`), menos
  de 72 caracteres, sin punto final.
- Cuerpo (si el cambio necesita contexto): explica el *por qué*, no solo el
  *qué* — el diff ya muestra el qué. Útil para decisiones no obvias, bugs
  encontrados durante el cambio, o hallazgos que quedan pendientes a
  propósito.
- Nunca incluir credenciales, tokens, contraseñas ni otros datos sensibles en
  el mensaje.

## Ejemplo

```
Corrige el gate de perfil incompleto en login y registro

login() y register() mandaban siempre a /dashboard sin mirar
profile_complete. Como el registro por correo nunca pide teléfono ni fecha
de nacimiento, esos usuarios entraban con el perfil incompleto y nada
volvía a pedírselo -- solo el callback de Google respetaba el gate.
```
