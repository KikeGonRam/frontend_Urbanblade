---
name: auth-pages-plan
description: Mantener login, registro y recuperación existentes sin repetir planes cerrados.
---

# Pantallas de autenticación

Las páginas login.vue, register.vue, forgot-password.vue y reset-password.vue
ya están implementadas. Revisar app/components/auth y useAuth antes de cambiar.

Conservar errores comprensibles, autocomplete, fuerza de contraseña, accesibilidad,
redirección segura y control de perfil incompleto. La API controla autorización
y vigencia de tokens. Nunca insertar cuentas o contraseñas reales en mocks.

Fuentes: [ARQUITECTURA](../../../docs/ARQUITECTURA.md),
[PRUEBAS](../../../docs/PRUEBAS.md). Probar formulario y error relevante; los
mocks no acreditan el proveedor OAuth ni el correo real. Mantener copias sincronizadas.
