<script setup lang="ts">
/*
 * Ventana de detalle que se abre al hacer clic en una barra, punto o porción de cualquier gráfica.
 * Una sola instancia en el layout escucha el evento "ub:chart-detail" que dispara registerChartjs.ts,
 * así que todas las gráficas la usan sin cablear nada por pantalla. Es un <dialog> nativo: Esc cierra,
 * el foco queda atrapado y regresa al elemento anterior.
 */
import type { ChartDetail } from "~/utils/chartDetail";

const detail = ref<ChartDetail | null>(null);
const dialog = ref<HTMLDialogElement | null>(null);
let previous: HTMLElement | null = null;

function onDetail(event: Event) {
  previous = document.activeElement as HTMLElement | null;
  detail.value = (event as CustomEvent<ChartDetail>).detail;
}
function close() {
  detail.value = null;
}

watch(detail, async (value) => {
  await nextTick();
  if (value) dialog.value?.showModal();
  else {
    dialog.value?.close();
    previous?.focus();
  }
});

onMounted(() => window.addEventListener("ub:chart-detail", onDetail));
onBeforeUnmount(() => window.removeEventListener("ub:chart-detail", onDetail));

const toneClass = (tone?: string) => (tone === "up" ? "text-success" : tone === "down" ? "text-danger" : "text-ink");
</script>

<template>
  <Teleport to="body">
    <dialog
      v-if="detail"
      ref="dialog"
      class="ub-chart-detail"
      aria-labelledby="ub-chart-detail-title"
      @cancel.prevent="close"
      @click="$event.target === dialog && close()"
    >
      <div class="p-5 sm:p-6">
        <header class="mb-4 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-[11px] font-black uppercase tracking-[0.2em] text-gold">{{ detail.chartTitle }}</p>
            <h2 id="ub-chart-detail-title" class="mt-1 text-xl font-bold leading-tight text-ink">{{ detail.title }}</h2>
          </div>
          <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:text-ink" aria-label="Cerrar detalle" @click="close">✕</button>
        </header>

        <ul class="space-y-2.5" aria-label="Valores">
          <li v-for="row in detail.rows" :key="row.label" class="flex items-center gap-3 rounded-xl border border-line bg-ink/[0.03] px-4 py-3">
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ background: row.color }" aria-hidden="true" />
            <span class="text-base font-semibold text-ink">{{ row.label }}</span>
          </li>
        </ul>

        <dl v-if="detail.facts.length" class="mt-4 grid gap-2 sm:grid-cols-2">
          <div v-for="fact in detail.facts" :key="fact.label" class="rounded-xl bg-ink/[0.03] px-4 py-3">
            <dt class="text-[11px] font-bold uppercase tracking-wide text-muted">{{ fact.label }}</dt>
            <dd class="mt-0.5 text-sm font-bold" :class="toneClass(fact.tone)">{{ fact.value }}</dd>
          </div>
        </dl>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.ub-chart-detail {
  width: min(28rem, calc(100vw - 2rem));
  margin: auto;
  border: 1px solid var(--line);
  border-radius: 1rem;
  padding: 0;
  color: var(--ink);
  background: var(--bg-card);
  box-shadow: 0 30px 80px rgb(0 0 0 / 0.5);
}
.ub-chart-detail::backdrop {
  background: rgb(0 0 0 / 0.55);
  backdrop-filter: blur(3px);
}
.ub-chart-detail[open] {
  animation: ub-detail-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes ub-detail-in {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .ub-chart-detail[open] { animation: none; }
}
</style>
