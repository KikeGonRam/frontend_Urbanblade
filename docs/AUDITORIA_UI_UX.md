# Auditoría UI/UX medida — UrbanBlade (2026-10-02)

Auditoría de la web (`frontend-urban`) y revisión estática de la app Android
(`UrbanBladeMobile`). A diferencia de `design-qa.md`, que compara contra un
mockup de referencia, esto **mide**: contraste WCAG, tamaños de blanco táctil,
foco, nombres accesibles, jerarquía de encabezados y desbordes de layout, en los
**4 temas** y en **4 anchos**.

## Método y alcance

| Qué | Cómo |
|---|---|
| Herramienta | `e2e/auditoria-ui.spec.ts` (Playwright + medición propia en el navegador) |
| Cobertura web | 4 temas × 8 páginas × 4 anchos (320, 375, 768, 1440) = 128 mediciones |
| Contraste | WCAG 2.1 AA: 4.5:1 texto normal, 3:1 texto grande (≥24 px, o ≥18.66 px en negrita) |
| Blancos táctiles | 44 px, **el mínimo que declara `design-qa.md`** |
| Móvil | Revisión estática del código Compose (no hay SDK ni Gradle en este entorno) |

### Límites, dichos por delante

1. **No hay axe, pa11y ni Lighthouse instalados**, y no hay red para instalarlos.
   Las comprobaciones son propias. No sustituye una auditoría certificada ni
   pruebas con lectores de pantalla reales (NVDA, TalkBack).
2. **Las páginas autenticadas se midieron con el mock de la API**, que devuelve
   colecciones vacías. Se auditó la estructura, el chrome (sidebar, topbar,
   selector de tema) y las páginas públicas con contenido; **no** estados con
   datos densos (tablas llenas, listas largas).
3. **El detector de contraste solo recorre ancestros.** Un overlay posicionado
   como *hermano* (`absolute inset-0`) no lo ve. Esto produjo un falso positivo
   que luego verifiqué a mano (ver "Falsos positivos").
4. **870–914 elementos quedan como "contraste no verificable"** porque su fondo
   es un degradado o una imagen. Eso no significa que estén mal: significa que
   **no se pueden auditar automáticamente**, lo cual ya es un problema propio.

## Resultado global

| Tipo | Casos | Lectura |
|---|---:|---|
| Contraste no verificable | 914 | fondos con degradado o imagen |
| Blanco táctil < 44 px | 768 | la mayoría son enlaces en línea (exentos por WCAG 2.5.8); los controles reales están en P2 |
| **Contraste bajo** | **262** | **240 son del tema `libreta`** |
| Jerarquía de encabezados | 60 | ver P2 |
| Sin `<main>` | 32 | 2 páginas × 4 temas |
| Desborde horizontal | 16 | ver P1 |
| Sin `<title>` | 48 → **0** | corregido en esta sesión |
| `lang` vacío | → **0** | corregido en esta sesión |

---

## P1 — Contraste del tema claro `libreta`

**240 de los 262 fallos de contraste son del tema `libreta`.** Los tres temas
oscuros pasan con holgura (mayoría AAA). El tema claro, que es el único claro del
producto, es el que no es usable con baja visión.

Parejas medidas (texto → fondo, tamaño real, mínimo AA = 4.5):

| Pareja | Ratio | Casos | Recomendado |
|---|---:|---:|---|
| `muted` #7A6F60 sobre #F3EDE0 | **4.22** | 81 | `#74695B` (4.60) |
| `muted` #7A6F60 sobre #ECE2CC | **3.82** | 12 | `#6E6456` (4.51) |
| `gold` #B8860B sobre #F3EDE0 | **2.79** | 58 | `#8A6408` (4.61) |
| `gold` #B8860B a 36 px (título, mínimo 3) | **2.79** | 14 | igual, o `#956D09` (4.55) |
| blanco 40 % sobre #080808 (pie del shell de acceso) | **3.75** | 16 | `#787878` (4.54) — aplica a los 4 temas |
| `gold` #C1703D sobre #22262C (`acero`) | **4.09** | 8 | `#C57A4B` (4.53) |

> **El dorado de marca es la raíz del problema en `libreta`.** Una salida que no
> toca la identidad visual: conservar `#B8860B` para decoración (bordes, iconos
> grandes, fondos) y usar un tono oscurecido **solo para texto**, p. ej.
> `--color-gold-text: #8A6408` en el tema claro. A 45 % de luminosidad el dorado
> llega a 8.93:1, así que hay margen de sobra.

---

## P1 — Desborde horizontal

| Página | Ancho | Medido | Exceso |
|---|---|---|---|
| `/` (landing) | 768 | 913 > 768 | **145 px** |
| `/equipo`, `/reservar`, `/servicios` | 320 | 334 > 320 | 14 px |

En los 4 temas. El de la landing a 768 es el grave: **145 px de scroll lateral en
tablet**. El móvil de 320 px es el ancho más estrecho que aún se usa (iPhone SE).

## P1 — Falta el landmark `<main>`

`/` (landing) y `/login` no tienen `<main>`. Los tres layouts sí lo tienen
(`public.vue:32`, `legal.vue:19`, `dashboard.vue:28`) y `error.vue` también
(`error.vue:16`), pero **la landing no usa layout** (no tiene `definePageMeta`) y
el login tampoco. Afecta a WCAG 1.3.1 (estructura) y 2.4.1 (evitar bloques).

## P2 — Jerarquía de encabezados

| Página | Problema |
|---|---|
| `/login` | **2 `<h1>`** en la misma página |
| `/dashboard` | **ningún `<h1>`** |
| `/` (landing) | salto `h2 → h4` |
| `/servicios` | salto `h1 → h3` |

Un solo `h1` por página y sin saltos de nivel: es la base de la navegación por
encabezados de un lector de pantalla.

## P2 — Blancos táctiles

`design-qa.md` afirma *"Targets are at least 44px"*. **Medido, no se cumple:**

| Control | Tamaño |
|---|---|
| `button.ub-sidebar__collapse "‹"` | 29 × 29 |
| `button.ub-sidebar__section-title` (Análisis, Gestión, Operación, Sistema) | 246 × 28 |
| `button "Salir"` | 31 × 24 |
| `button.ub-topbar-button` | 39 × 39 |
| `input` (buscador de la topbar) | 286 × **24** |
| `a.ub-topbar-profile` | 135 × 37 |
| `a.ub-error-brand "UrbanBlade"` | 118 × 24 |
| `a.ub-skip-link "Saltar al contenido"` | 135 × 40 |

El más incómodo es el **buscador de 24 px de alto**. Nótese que la mayoría son
enlaces de texto en línea, que WCAG 2.5.8 exime; los `button` no lo están.

## P3 — Deuda

- **Android: 201 textos de UI en duro.** `res/values/strings.xml` sólo contiene
  `app_name`. No es un fallo de accesibilidad (la app es monolingüe), pero impide
  traducir sin tocar 201 puntos y mezcla copy con layout.
- **Android, píldoras de estado.** `UrbanStatusPill` mezcla el color con `Ink` al
  30 % con el comentario *"el ámbar o verde puros casi no se leen sobre el crema
  de Libreta"*: el problema estaba detectado, pero la corrección fue a ojo.
  **Medido, no alcanza AA en 3 de 4 tonos** (sobre `card` de `libreta`):

  | Tono | Crudo | Con su mezcla 30 % | Necesita |
  |---|---:|---:|---:|
  | Success | 2.37 | 4.05 | **t = 0.36** |
  | Warning | 2.05 | 3.51 | **t = 0.42** |
  | Info | 2.52 | 4.22 | **t = 0.34** |
  | Danger | 3.05 | 4.92 | pasa |

  Y `UrbanRolePill` usa `Gold` crudo sobre fondo dorado al 12 %: **2.79:1, sin
  mitigación alguna**. Se arreglan los dos con el mismo criterio, sólo en el tema
  claro (en los oscuros la mezcla actual ya pasa y subirla desaturaría el color):

  ```kotlin
  // UrbanComponents.kt, UrbanStatusPill
  val factor = if (UrbanColors.current.isLight) 0.55f else 0.30f
  val content = lerp(color, UrbanColors.Ink, factor)

  // UrbanComponents.kt, UrbanRolePill: hoy usa UrbanColors.Gold crudo
  val content = if (UrbanColors.current.isLight)
      lerp(UrbanColors.Gold, UrbanColors.Ink, 0.50f) else UrbanColors.Gold
  ```

- **Gráficas:** las barras son `clickable(indication = null)`, sin *ripple*. Sí
  hay feedback de selección (la barra elegida pasa a opaca), así que es una
  decisión estética defendible, pero un toque no produce respuesta inmediata.
- **Degradados por todas partes.** 914 elementos de texto no se pueden verificar
  automáticamente por tener fondo con degradado o imagen. Cualquier auditoría
  futura chocará con lo mismo.

---

## Falsos positivos que descarté

Rigor también es no reportar lo que no es. La primera pasada marcó como **P0
"texto invisible"** (`h4 "Nava Panther"`, blanco sobre #FFFBF3, **1.03:1**) en la
landing. Al ir al código (`app/pages/index.vue:481-491`) resultó ser un **falso
positivo de la herramienta**: el `<h4>` está sobre un overlay
`absolute inset-0 from-black/90` (línea 489) que el detector no ve, porque sólo
recorre **ancestros** y ese overlay es un **hermano**. El contraste real es
~17:1. **No se tocó el código.**

Otro error propio en el camino: la primera versión del cálculo de contraste leía
los tokens `0xAARRGGBB` saltándose el alfa, lo que daba 3.63:1 donde hay 17.68:1.
Se detectó porque el número era imposible para `#F2F2F2` sobre `#0A0A0A`, se
corrigió y se verificó a mano.

---

## Lo que está bien (y conviene no romper)

- **Android tiene una accesibilidad muy por encima de la media:** descripciones
  en las gráficas ("Gráfica de barras con N valores; el más alto es X"),
  `stateDescription` en acordeones, `liveRegion` en errores y en el chat,
  `heading()` en títulos de sección, `Role.RadioButton` con `selected` en
  tarjetas seleccionables, `onClickLabel` en botones de sólo icono,
  `mergeDescendants` en la valoración por estrellas, y los esqueletos anuncian
  "Cargando contenido". Los 22 `contentDescription = null` son iconos
  decorativos junto a texto: **es lo correcto**, no un descuido.
- **Los estados usan color *e* icono** (`UrbanStatus.kt`), que es justo lo que
  pide WCAG 1.4.1 para no depender sólo del color.
- Existe **enlace de salto** (`ub-skip-link "Saltar al contenido"`).
- `<main>` en los 3 layouts y en la página de error.
- `useSeoMeta` en 9 páginas públicas; la página de error tiene copy e imágenes
  propias por cada estado (404, 403, 503).
- Los 3 temas oscuros pasan contraste con holgura (mayoría AAA).

## Correcciones aplicadas y verificadas

| Cambio | Verificación |
|---|---|
| `lang="es"` en `nuxt.config.ts` (WCAG 2.1 A, 3.1.1) | fallos de idioma: **→ 0** |
| Títulos en `login.vue`, `dashboard/index.vue`, `error.vue` (WCAG A, 2.4.2) | páginas sin `<title>`: **48 → 0** |
| `e2e/auditoria-ui.spec.ts` con guarda `UB_AUDITORIA` | no altera la suite normal |

## Cómo reproducir

```powershell
cd frontend-urban
$env:UB_AUDITORIA=1
npx playwright test e2e/auditoria-ui.spec.ts --workers=1 --reporter=list
```

## Lo que deliberadamente no hice

- **No cambié la paleta de marca.** El dorado es identidad visual; los valores
  recomendados están arriba para que la decisión sea suya.
- **No escribí el parche Kotlin.** No hay SDK ni Gradle en este entorno, así que
  no puedo compilarlo, y no voy a dejar código sin verificar en el repositorio.
  El parche está arriba, listo para pegar.
- **No cambié alturas de controles** del sidebar y la topbar: son visibles y
  afectan al espaciado del panel, que ya está validado contra el mockup.
- **No toqué los degradados**, aunque sean los que impiden auditar el contraste.
