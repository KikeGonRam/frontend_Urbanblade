<script setup lang="ts">
import type { MascotId } from '~/composables/useBrandMascots'
withDefaults(defineProps<{ title: string; message: string; mascot?: MascotId; actionLabel?: string }>(), { mascot: 'nava', actionLabel: '' })
defineEmits<{ action: [] }>()
</script>
<template>
  <section class="brand-empty-state" aria-live="polite">
    <BrandMascot :mascot="mascot" state="empty" size="sm" />
    <div><h2>{{ title }}</h2><p>{{ message }}</p><button v-if="actionLabel" type="button" class="brand-empty-state__action" @click="$emit('action')">{{ actionLabel }}</button></div>
  </section>
</template>
