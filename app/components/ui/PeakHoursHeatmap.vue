<script setup lang="ts">
/*
 * Mapa de calor de horas pico: demanda real de citas por día de la semana y hora (GET /admin/reports/peak-hours).
 * Cada celda es un botón (teclado y lector de pantalla) y abre la ventana de detalle de las gráficas del kit.
 */
import type { ChartDetail } from "~/utils/chartDetail";
import { fmtInt } from "~/utils/chartTheme";

interface PeakSlot {
  weekday: string;
  hour: number;
  label: string;
  total: number;
  avgPerWeek: number;
}
interface PeakHoursData {
  days: number;
  startDate: string;
  endDate: string;
  totalAppointments: number;
  hours: number[];
  weekdays: { iso: number; label: string; short: string; total: number; occurrences: number }[];
  matrix: number[][];
  hourlyTotals: { hour: number; label: string; total: number }[];
  peakSlots: PeakSlot[];
  quietSlots: PeakSlot[];
}

const WINDOWS = [
  { days: 30, label: "30 días" },
  { days: 90, label: "3 meses" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 año" },
] as const;

const { apiFetch } = useApi();
const days = ref<number>(90);
const { data: res, pending } = await useAsyncData(
  "reports-peak-hours",
  () => apiFetch<{ data: PeakHoursData }>("/admin/reports/peak-hours", { query: { days: days.value } }),
  { watch: [days], lazy: true },
);

const data = computed(() => res.value?.data);
const hasData = computed(() => (data.value?.totalAppointments ?? 0) > 0);
const maxCell = computed(() => Math.max(1, ...(data.value?.matrix.flat() ?? [0])));
const maxHour = computed(() => Math.max(1, ...(data.value?.hourlyTotals.map((h) => h.total) ?? [0])));
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
const peak = computed(() => data.value?.peakSlots[0]);

/* Intensidad continua: la celda vacía queda neutra y las demás suben de tono con la demanda. */
function cellStyle(count: number) {
  if (!count) return { background: "rgb(var(--ink-rgb) / 0.05)" };
  const alpha = 0.18 + (count / maxCell.value) * 0.78;

  return { background: `rgb(var(--gold-rgb) / ${alpha.toFixed(2)})`, color: alpha > 0.6 ? "#0a0a0a" : "var(--ink)" };
}

function openCell(dayIndex: number, hourIndex: number) {
  const d = data.value;
  if (!d) return;
  const weekday = d.weekdays[dayIndex]!;
  const count = d.matrix[dayIndex]![hourIndex]!;
  const share = d.totalAppointments ? (count / d.totalAppointments) * 100 : 0;
  const detail: ChartDetail = {
    chartTitle: "Horas pico",
    title: `${weekday.label} ${hourLabel(d.hours[hourIndex]!)}`,
    rows: [{ label: `${fmtInt(count)} ${count === 1 ? "cita" : "citas"} en ${d.days} días`, color: "rgb(var(--gold-rgb))" }],
    facts: [
      { label: "Promedio por semana", value: (count / Math.max(weekday.occurrences, 1)).toFixed(1) },
      { label: "Del total de citas", value: `${share.toFixed(1)} %` },
      { label: `Total del ${weekday.label.toLowerCase()}`, value: fmtInt(weekday.total) },
      { label: "Vs. hora más fuerte", value: peak.value ? `${Math.round((count / Math.max(peak.value.total, 1)) * 100)} %` : "—" },
    ],
  };
  window.dispatchEvent(new CustomEvent("ub:chart-detail", { detail }));
}
</script>

<template>
  <section class="ub-rise rounded-2xl border border-line bg-card p-5 sm:p-6" aria-labelledby="peak-title">
    <header class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 id="peak-title" class="text-base font-semibold text-ink">Horas pico</h3>
        <p class="mt-0.5 text-sm text-muted">
          Cuándo se llena la agenda: citas por día de la semana y hora, sin contar canceladas.
        </p>
      </div>
      <div role="tablist" aria-label="Ventana de análisis" class="inline-flex shrink-0 gap-1 rounded-xl border border-line p-1">
        <button
          v-for="w in WINDOWS"
          :key="w.days"
          type="button"
          role="tab"
          :aria-selected="days === w.days"
          class="min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors"
          :class="days === w.days ? 'bg-gold text-black' : 'text-muted hover:text-ink'"
          @click="days = w.days"
        >
          {{ w.label }}
        </button>
      </div>
    </header>

    <p v-if="pending && !data" class="py-10 text-center text-sm text-muted" role="status">Calculando horas pico…</p>

    <p v-else-if="!hasData" class="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">
      Aún no hay citas en esta ventana para calcular horas pico.
    </p>

    <template v-else-if="data">
      <ul class="mb-5 grid gap-3 sm:grid-cols-2" aria-label="Resumen de demanda">
        <li class="rounded-xl border border-gold/30 bg-gold/10 p-4">
          <p class="text-xs font-bold uppercase tracking-wide text-gold">Más demanda</p>
          <ul class="mt-2 space-y-1.5">
            <li v-for="slot in data.peakSlots" :key="slot.label" class="flex items-baseline justify-between gap-3 text-sm">
              <span class="font-semibold text-ink">{{ slot.label }}</span>
              <span class="tabular-nums text-muted">{{ fmtInt(slot.total) }} citas · {{ slot.avgPerWeek }} por semana</span>
            </li>
          </ul>
        </li>
        <li class="rounded-xl border border-line bg-ink/[0.03] p-4">
          <p class="text-xs font-bold uppercase tracking-wide text-muted">Para promocionar</p>
          <ul class="mt-2 space-y-1.5">
            <li v-for="slot in data.quietSlots" :key="slot.label" class="flex items-baseline justify-between gap-3 text-sm">
              <span class="font-semibold text-ink">{{ slot.label }}</span>
              <span class="tabular-nums text-muted">{{ fmtInt(slot.total) }} {{ slot.total === 1 ? "cita" : "citas" }}</span>
            </li>
          </ul>
        </li>
      </ul>

      <div class="overflow-x-auto pb-1">
        <table class="w-full min-w-[34rem] border-separate border-spacing-1 text-center" aria-label="Citas por día de la semana y hora">
          <thead>
            <tr>
              <th scope="col" class="w-12"><span class="sr-only">Día</span></th>
              <th v-for="hour in data.hours" :key="hour" scope="col" class="text-xs font-semibold tabular-nums text-muted">{{ hourLabel(hour) }}</th>
              <th scope="col" class="w-14 text-xs font-semibold text-muted">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(weekday, dayIndex) in data.weekdays" :key="weekday.iso">
              <th scope="row" class="pr-1 text-right text-xs font-semibold text-ink">{{ weekday.short }}</th>
              <td v-for="(hour, hourIndex) in data.hours" :key="hour" class="p-0">
                <button
                  type="button"
                  class="peak-cell flex h-9 w-full min-w-9 items-center justify-center rounded-md text-xs font-bold tabular-nums transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  :style="cellStyle(data.matrix[dayIndex]![hourIndex]!)"
                  :aria-label="`${weekday.label} ${hourLabel(hour)}: ${data.matrix[dayIndex]![hourIndex]} citas`"
                  @click="openCell(dayIndex, hourIndex)"
                >
                  {{ data.matrix[dayIndex]![hourIndex] || "" }}
                </button>
              </td>
              <td class="text-xs font-bold tabular-nums text-ink">{{ fmtInt(weekday.total) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="pr-1 text-right text-xs font-semibold text-muted">Hora</th>
              <td v-for="h in data.hourlyTotals" :key="h.hour" class="px-0.5 pt-2 align-bottom">
                <div class="mx-auto flex h-14 w-full items-end" :title="`${h.label}: ${h.total} citas`">
                  <div class="peak-bar w-full rounded-t" :style="{ height: `${Math.max(6, (h.total / maxHour) * 100)}%` }" />
                </div>
                <span class="mt-1 block text-xs font-semibold tabular-nums text-muted">{{ fmtInt(h.total) }}</span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <footer class="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p>
          {{ fmtInt(data.totalAppointments) }} citas analizadas del {{ data.startDate }} al {{ data.endDate }}. Toca una celda para ver su detalle.
        </p>
        <p class="flex items-center gap-2" aria-hidden="true">
          Menos
          <span class="flex gap-0.5">
            <span v-for="a in [0.18, 0.36, 0.54, 0.75, 0.96]" :key="a" class="h-3 w-5 rounded-sm" :style="{ background: `rgb(var(--gold-rgb) / ${a})` }" />
          </span>
          Más
        </p>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.peak-bar {
  background: linear-gradient(to top, rgb(var(--gold-rgb) / 0.35), rgb(var(--gold-rgb) / 0.95));
  transform-origin: bottom;
  animation: peak-grow 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes peak-grow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
@media (prefers-reduced-motion: reduce) {
  .peak-bar { animation: none; }
  .peak-cell { transition: none; }
}
</style>
