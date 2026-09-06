<script setup lang="ts">
const mascots = [{ name: 'Nava', file: 'nava-panther.png' }, { name: 'Bladebot', file: 'bladebot.png' }, { name: 'Bruno', file: 'bruno-raven.png' }] as const
const active = ref(0)
const expanded = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
function select(index: number) { active.value = index; expanded.value = true }
onMounted(() => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => { active.value = (active.value + 1) % mascots.length }, 8000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>
<template>
  <aside class="mascot-companion" aria-label="Mascotas de UrbanBlade">
    <button type="button" class="mascot-companion__toggle" :aria-expanded="expanded" @click="expanded = !expanded"><img :src="`/images/mascots/${mascots[active].file}`" :alt="mascots[active].name"><span>{{ mascots[active].name }}</span></button>
    <div v-show="expanded" class="mascot-companion__panel"><p>Tu equipo UrbanBlade</p><div><button v-for="(mascot, index) in mascots" :key="mascot.name" type="button" :class="{ active: index === active }" @click="select(index)"><img :src="`/images/mascots/${mascot.file}`" :alt="mascot.name"><span>{{ mascot.name }}</span></button></div></div>
  </aside>
</template>
