<script setup lang="ts">
import type { MascotId, MascotState } from '~/composables/useBrandMascots'
const props = withDefaults(defineProps<{ mascot?: MascotId; state?: MascotState; size?: 'sm' | 'md' | 'lg'; caption?: boolean }>(), { mascot: undefined, state: 'idle', size: 'md', caption: false })
const { mascots, themeMascot } = useBrandMascots()
const selected = computed(() => mascots[props.mascot ?? themeMascot.value])
</script>
<template>
  <figure class="brand-mascot" :class="[`brand-mascot--${size}`, `brand-mascot--${state}`]">
    <span class="brand-mascot__halo" aria-hidden="true" />
    <img :src="selected.image" :alt="`${selected.name}, ${selected.role} de UrbanBlade`">
    <figcaption v-if="caption"><strong>{{ selected.name }}</strong><span>{{ selected.role }}</span></figcaption>
  </figure>
</template>
