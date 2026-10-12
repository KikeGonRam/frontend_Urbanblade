<script setup lang="ts">
defineProps<{
  title: string
  items: { label: string; description: string; to: string }[]
}>()
</script>

<template>
  <section class="ui-card-premium p-4 sm:p-5">
    <h2 class="mb-3 text-lg font-semibold text-ink">{{ title }}</h2>
    <ul class="divide-y divide-line">
      <li v-for="item in items" :key="item.to">
        <NuxtLink :to="item.to" class="flex min-h-12 items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-gold">
          <span class="min-w-0 flex-1">
            <span class="block font-semibold text-ink">{{ item.label }}</span>
            <span class="block text-sm text-muted">{{ item.description }}</span>
          </span>
          <span class="text-muted" aria-hidden="true">→</span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
