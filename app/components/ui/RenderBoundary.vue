<script setup lang="ts">
/*
 * Marco de error acotado a errores de DIBUJO (setup, render o actualización de un componente).
 * Si una pantalla recibe datos con otra forma y revienta al dibujarse, en vez de quedar en blanco
 * muestra un aviso con «Reintentar». Los errores de botones, eventos o watchers NO se atrapan:
 * siguen su camino normal, porque taparían pantallas que funcionan. Por eso no se usa
 * NuxtErrorBoundary, que atrapa todo (se probó y rompió 7 pruebas e2e, nov-2026).
 */
const route = useRoute()
const failed = ref(false)

onErrorCaptured((err, _instance, info) => {
  if (!esErrorDeDibujo(info)) return
  console.error('[UiRenderBoundary] error al dibujar la pantalla:', info, err)
  failed.value = true
  return false
})

// Al reintentar o cambiar de ruta se vuelve a montar la pantalla desde cero.
function retry() {
  failed.value = false
}
watch(() => route.fullPath, retry)
</script>

<template>
  <BrandStatePanel
    v-if="failed"
    mascot="bruno"
    state="error"
    tone="danger"
    title="Esta sección no se pudo mostrar"
    description="Algo en los datos no vino como esperábamos. Puedes reintentar o ir a otra sección."
    action-label="Reintentar"
    @action="retry"
  />
  <slot v-else />
</template>
