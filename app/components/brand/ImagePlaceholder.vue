<script setup lang="ts">
/*
 * Imagen por defecto de la marca para servicios y productos sin foto (auditoría UI/UX C-01). Antes la tienda mostraba
 * un icono de tijeras sobre gris y el inicio un recuadro vacío, lo que hacía ver la plataforma como una maqueta.
 * Aquí el recuadro mantiene la iluminación de la marca (degradado dorado sobre fondo oscuro) y un trazo según la
 * categoría. No sustituye a la foto real: pide subirla en el panel de administración.
 */
const props = withDefaults(defineProps<{ category?: string | null, label?: string }>(), { category: null, label: '' })

type Trazo = 'tijeras' | 'navaja' | 'frasco' | 'peine' | 'marca'

const trazo = computed<Trazo>(() => {
  const c = (props.category ?? '').toLowerCase()
  if (c.includes('barba') || c.includes('afeit')) return 'navaja'
  if (c.includes('cuidado') || c.includes('producto')) return 'frasco'
  if (c.includes('accesor')) return 'peine'
  if (c.includes('corte') || c.includes('combo')) return 'tijeras'

  return 'marca'
})

const TRAZOS: Record<Trazo, string> = {
  tijeras: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8.1 7.9 20 18M8.1 16.1 20 6',
  navaja: 'M7 9c0-3.5 2-6 5-6s5 2.5 5 6H7Zm1 0h8M10 9v2m4-2v2m-5 2h6l-.8 7.5a1 1 0 0 1-1 .5h-2.4a1 1 0 0 1-1-.5L9 13Z',
  frasco: 'M9 2h6v3H9V2Zm-1 3h8l1 4v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9l1-4Zm-1 7h10',
  peine: 'M3 7h18v4H3V7Zm2 4v6m3-6v6m3-6v6m3-6v6m3-6v6m3-6v6',
  marca: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
}
</script>

<template>
  <div
    class="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-gold/20 via-card to-main"
    role="img"
    :aria-label="label || 'Imagen no disponible'"
  >
    <span class="pointer-events-none absolute inset-0 opacity-[0.07]" style="background-image: repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 14px)" aria-hidden="true" />
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" class="relative h-1/3 w-1/3 max-h-24 max-w-24 text-gold/60" aria-hidden="true">
      <path :d="TRAZOS[trazo]" />
    </svg>
  </div>
</template>
