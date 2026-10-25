<script setup lang="ts">
// Miniaturas de 160x240 (~10 KB): el botón se muestra a ~70 px, no necesita el PNG de 1024 px (~2 MB).
//
// `yieldSpace`: en móvil esta burbuja flota fija sobre el extremo derecho de la pantalla (ver
// .mascot-companion en main.css) — la misma esquina donde cae la acción de reservar de la
// tarjeta de servicio en turno y la barra fija de "Reservar cita" (pages/index.vue). Con tres
// elementos de toque tan cerca, quien usa el sitio en el pulgar derecho podía tocar la mascota
// en vez del botón. Se cede el espacio (se oculta) mientras esa barra fija ya ofrece la misma
// acción de reservar, que es el caso real donde compite.
const props = defineProps<{ yieldSpace?: boolean }>()
const mascots = [{ name: 'Nava', file: 'nava-panther-thumb.webp' }, { name: 'Bladebot', file: 'bladebot-thumb.webp' }, { name: 'Bruno', file: 'bruno-raven-thumb.webp' }] as const
const active = ref(0)
const expanded = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
function select(index: number) { active.value = index; expanded.value = true }
onMounted(() => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => { active.value = (active.value + 1) % mascots.length }, 8000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
// Al ceder el espacio se cierra el panel expandido: evita dejarlo abierto e invisible.
watch(() => props.yieldSpace, (cede) => { if (cede) expanded.value = false })
</script>
<template>
  <aside v-show="!yieldSpace" class="mascot-companion" aria-label="Mascotas de UrbanBlade">
    <button type="button" class="mascot-companion__toggle" :aria-expanded="expanded" @click="expanded = !expanded"><img :src="`/images/mascots/${mascots[active].file}`" :alt="mascots[active].name" width="160" height="240" decoding="async"><span>{{ mascots[active].name }}</span></button>
    <div v-show="expanded" class="mascot-companion__panel"><p>Tu equipo UrbanBlade</p><div><button v-for="(mascot, index) in mascots" :key="mascot.name" type="button" :class="{ active: index === active }" @click="select(index)"><img :src="`/images/mascots/${mascot.file}`" :alt="mascot.name" width="160" height="240" loading="lazy" decoding="async"><span>{{ mascot.name }}</span></button></div></div>
  </aside>
</template>
