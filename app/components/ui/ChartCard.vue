<script setup lang="ts">
/* Marco de gráfica del kit (skill urbanblade-ui-kit): título, subtítulo, acción y estado vacío. */
withDefaults(
  defineProps<{
    title: string;
    subtitle?: string | null;
    empty?: boolean;
    emptyText?: string;
    /** Alto del área de la gráfica (clase de Tailwind). */
    height?: string;
  }>(),
  { subtitle: null, empty: false, emptyText: "Todavía no hay datos para mostrar.", height: "h-64" },
);
</script>

<template>
  <section class="ub-rise flex flex-col rounded-2xl border border-line bg-card p-5">
    <header class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-ink">{{ title }}</h3>
        <p v-if="subtitle" class="mt-0.5 text-sm text-muted">{{ subtitle }}</p>
      </div>
      <slot name="action" />
    </header>
    <div :class="height" class="relative">
      <div v-if="empty" class="flex h-full items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
        {{ emptyText }}
      </div>
      <slot v-else />
    </div>
    <slot name="footer" />
  </section>
</template>
