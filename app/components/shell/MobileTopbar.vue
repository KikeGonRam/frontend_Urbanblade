<script setup lang="ts">
const { user } = useAuth()
</script>

<template>
  <header class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-main/95 px-4 backdrop-blur md:hidden">
    <NuxtLink to="/dashboard" class="font-analytics text-lg font-semibold text-ink">
      Urban<span class="text-gold">Blade</span>
    </NuxtLink>

    <div class="flex items-center gap-3">
      <span
        class="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-xs font-semibold text-gold"
        :title="user?.name"
      >
        {{ (user?.name ?? 'U').slice(0, 2).toUpperCase() }}
      </span>
    </div>
  </header>
</template>
