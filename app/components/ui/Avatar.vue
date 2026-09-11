<script setup lang="ts">
const props = withDefaults(defineProps<{ src?: string | null, name?: string | null }>(), { src: null, name: null })
const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
const initials = computed(() => (props.name?.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('') || '?').toUpperCase())
</script>

<template>
  <span class="ui-avatar" :title="name || undefined">
    <img v-if="src && !failed" :src="src" :alt="`Foto de ${name || 'usuario'}`" loading="lazy" decoding="async" @error="failed = true">
    <span v-else aria-hidden="true">{{ initials }}</span>
  </span>
</template>
