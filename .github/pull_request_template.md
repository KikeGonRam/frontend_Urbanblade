## Qué cambia y por qué

<!-- Una o dos frases. Enlaza la tarea o historia (por ejemplo T077 / HT-26). -->

## Lista de verificación del revisor (T077)

Marca cada punto antes de aprobar. Si no aplica, escribe «N/A» y por qué.

### Estándares
- [ ] El cambio hace una sola cosa y el título del PR la describe (en español, sin créditos de herramientas).
- [ ] El código sigue el estilo del archivo que toca: nombres, comentarios y formato.
- [ ] No quedan código muerto, `console.log` ni comentarios de depuración.
- [ ] Los textos que ve el usuario están en español y sin faltas.

### Seguridad
- [ ] No hay secretos, tokens, contraseñas ni correos reales en el código, los datos de prueba ni los comentarios.
- [ ] Toda entrada del usuario se valida; ningún HTML sin escapar.
- [ ] Un permiso nuevo o cambiado tiene prueba de quién sí y quién no puede usarlo.
- [ ] Una dependencia nueva está justificada y `npm audit` no empeora.

### Pruebas
- [ ] Hay pruebas nuevas o actualizadas que fallan sin el cambio.
- [ ] Las pruebas pasaron en local y el CI está en verde.
- [ ] Probé el caso feliz y al menos un caso de error.

### Documentación y contrato
- [ ] El README o la documentación afectada está actualizada.
- [ ] Si cambió la API, el contrato (`contract/openapi.yaml`) y los tipos están al día.

### Despliegue
- [ ] Sé si requiere migración, variable de entorno nueva o reinicio, y está anotado aquí.
- [ ] Sé cómo volver atrás si falla.

## Cómo lo probé

<!-- Comandos ejecutados y resultado, o capturas si es un cambio visual. -->
