<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    currentPage: number;
    lastPage: number;
    total?: number;
    perPage?: number;
    busy?: boolean;
  }>(),
  {
    total: 0,
    perPage: 15,
    busy: false,
  },
);

const emit = defineEmits<{
  "update:currentPage": [page: number];
}>();

const pageNumbers = computed(() => {
  const last = Math.max(1, props.lastPage);
  const start = Math.max(1, Math.min(props.currentPage - 2, last - 4));
  const end = Math.min(last, start + 4);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
});

const firstItem = computed(() =>
  props.total > 0 ? (props.currentPage - 1) * props.perPage + 1 : 0,
);
const lastItem = computed(() =>
  props.total > 0
    ? Math.min(props.currentPage * props.perPage, props.total)
    : 0,
);

function goTo(page: number) {
  const nextPage = Math.min(Math.max(page, 1), Math.max(1, props.lastPage));
  if (nextPage !== props.currentPage && !props.busy) {
    emit("update:currentPage", nextPage);
  }
}
</script>

<template>
  <nav
    v-if="lastPage > 1"
    class="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between"
    aria-label="Paginación"
  >
    <p class="text-xs text-muted" aria-live="polite">
      Mostrando {{ firstItem }}–{{ lastItem }} de {{ total }} resultados
    </p>

    <div class="flex items-center justify-center gap-1">
      <button
        type="button"
        class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-line px-2 text-sm text-ink transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="currentPage <= 1 || busy"
        aria-label="Página anterior"
        @click="goTo(currentPage - 1)"
      >
        <span aria-hidden="true">←</span>
      </button>

      <button
        v-for="page in pageNumbers"
        :key="page"
        type="button"
        class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border px-2 text-sm transition-colors"
        :class="
          page === currentPage
            ? 'border-gold bg-gold/15 font-bold text-ink'
            : 'border-line text-muted hover:bg-gold/10 hover:text-ink'
        "
        :aria-current="page === currentPage ? 'page' : undefined"
        :aria-label="`Ir a la página ${page}`"
        :disabled="busy"
        @click="goTo(page)"
      >
        {{ page }}
      </button>

      <button
        type="button"
        class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-line px-2 text-sm text-ink transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="currentPage >= lastPage || busy"
        aria-label="Página siguiente"
        @click="goTo(currentPage + 1)"
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>
  </nav>
</template>
