<script setup lang="ts">
import type { MascotId, MascotState } from '~/composables/useBrandMascots'
const props = withDefaults(defineProps<{ mascot?: MascotId; state?: MascotState; size?: 'sm' | 'md' | 'lg'; caption?: boolean }>(), { mascot: undefined, state: 'idle', size: 'md', caption: false })
const { mascots, themeMascot } = useBrandMascots()
const selected = computed(() => mascots[props.mascot ?? themeMascot.value])
const image = computed(() => selected.value.stateImages[props.state] ?? selected.value.image)
</script>
<template>
  <figure class="brand-mascot" :class="[`brand-mascot--${size}`, `brand-mascot--${state}`]">
    <span class="brand-mascot__halo" aria-hidden="true" />
    <img
      :src="image"
      :alt="`${selected.name}, ${selected.role} de UrbanBlade`"
      loading="lazy"
      decoding="async"
    >
    <figcaption v-if="caption"><strong>{{ selected.name }}</strong><span>{{ selected.role }}</span></figcaption>
  </figure>
</template>
