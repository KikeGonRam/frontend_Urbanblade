<script setup lang="ts">
import { Bar } from "vue-chartjs";
import type { DashboardInsight } from "~/components/dashboard/AnalyticsInsights.vue";
import { chartAxisClean, chartColor, chartScale, chartTooltip, fmtInt, fmtMoney, goldRgba } from "~/utils/chartTheme";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

interface ReceptionistData {
  todayLabel: string;
  kpis: {
    appointments_today: number;
    collected_today: number;
    pending_payments: number;
    pending_orders: number;
    new_clients_today: number;
    low_stock_count: number;
  };
  nextAppointments: Array<{
    id: string;
    code: string;
    hora_inicio: string;
    /** Hora de llegada registrada por el check-in (ISO) o null. */
    llegada_en?: string | null;
    cliente: string;
    servicio: string;
    barbero: string;
  }>;
  pendingOrders: Array<{
    id: string;
    folio: string;
    cliente: string;
    creadoEn: string | null;
    itemsCount: number;
    total: number;
  }>;
  flowChart: { labels: string[]; values: number[] };
  sparkHighlights: DashboardInsight[];
}

const props = defineProps<{ data: ReceptionistData; firstName: string }>();

// Consola de mostrador: tiempo relativo de cada llegada, al día cada minuto.
const ahora = ref(new Date());
let reloj: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  reloj = setInterval(() => { ahora.value = new Date(); }, 60_000);
});
onBeforeUnmount(() => { if (reloj) clearInterval(reloj); });
// Check-in «Llegó»: POST /appointments/{code}/check-in registra la llegada sin cambiar el estado de la cita.
const { apiFetch } = useApi();
const llegadas = ref<Record<string, string>>({});
const llegandoCodigo = ref<string | null>(null);
const errorLlegada = ref("");
const enSala = (appt: { code: string; llegada_en?: string | null }) => !!(llegadas.value[appt.code] ?? appt.llegada_en);

async function marcarLlegada(appt: { code: string }) {
  llegandoCodigo.value = appt.code;
  errorLlegada.value = "";
  try {
    const res = await apiFetch<{ llegada_en: string }>(`/appointments/${appt.code}/check-in`, { method: "POST" });
    llegadas.value = { ...llegadas.value, [appt.code]: res.llegada_en };
  } catch (err: unknown) {
    errorLlegada.value = (err as { data?: { message?: string } })?.data?.message ?? "No se pudo registrar la llegada.";
  } finally {
    llegandoCodigo.value = null;
  }
}
const yaPaso = (hora: string) => (minutosDelDia(hora) ?? 0) < minutosAhora(ahora.value);

// Cita abierta en la ventana de detalle (se toca desde «Próximas llegadas»).
const detailCode = ref<string | null>(null);

// Mismos 6 números de GET /dashboard; cada tarjeta lleva a la pantalla donde se atienden.
const kpiCards = computed(() => [
  { label: "Citas de hoy", value: fmtInt(props.data.kpis.appointments_today), hint: "En la agenda", to: "/appointments" },
  { label: "Cobrado hoy", value: fmtMoney(props.data.kpis.collected_today), hint: "Pagos registrados", to: "/payments" },
  { label: "Por cobrar", value: fmtInt(props.data.kpis.pending_payments), hint: "Citas sin cobrar", to: "/payments" },
  { label: "Pedidos", value: fmtInt(props.data.kpis.pending_orders ?? 0), hint: "Por entregar", to: "/orders" },
  { label: "Clientes nuevos", value: fmtInt(props.data.kpis.new_clients_today), hint: "Registrados hoy", to: "/clients" },
  { label: "Stock crítico", value: fmtInt(props.data.kpis.low_stock_count), hint: "Bajo el mínimo", to: "/inventory/products" },
]);

const hasFlow = computed(() =>
  (props.data.flowChart.values ?? []).some((v) => v),
);

/*
 * Barras tipo "cápsula": son horas discretas del día (buckets), no una serie
 * continua. En el oro del tema; la hora con más citas en oro pleno.
 */
const flowChartData = computed(() => {
  const values = props.data.flowChart.values ?? [];
  const peak = Math.max(0, ...values);

  return {
    labels: props.data.flowChart.labels ?? [],
    datasets: [
      {
        label: "Citas",
        data: values,
        backgroundColor: values.map((v) => (v === peak && v > 0 ? chartColor(0, 0.95) : chartColor(1, 0.55))),
        hoverBackgroundColor: goldRgba(1),
        borderRadius: 999,
        borderSkipped: false,
        maxBarThickness: 16,
      },
    ],
  };
});

const flowChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...chartTooltip(),
      callbacks: {
        label: (ctx: { parsed: { y: number } }) =>
          `${fmtInt(ctx.parsed.y)} cita${ctx.parsed.y === 1 ? "" : "s"}`,
      },
    },
  },
  scales: {
    y: {
      ...chartScale(),
      beginAtZero: true,
      ticks: { ...chartScale().ticks, stepSize: 1, precision: 0, maxTicksLimit: 5 },
    },
    x: chartAxisClean(),
  },
};
</script>

<template>
  <div class="space-y-5">
    <DashboardHeader
      label="Recepción"
      color="text-gold"
      :today-label="data.todayLabel"
    />

    <p class="text-sm text-muted">
      Hola, <span class="font-semibold text-ink">{{ firstName }}</span>. Esto es lo que conviene atender hoy.
    </p>

    <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Resumen del turno">
      <UiStatCard
        v-for="kpi in kpiCards"
        :key="kpi.label"
        :label="kpi.label"
        :value="kpi.value"
        :hint="kpi.hint ?? null"
        :to="kpi.to"
      />
    </section>

    <section class="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <section class="rounded-2xl border border-line bg-card p-5 lg:col-span-7">
        <header class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-ink">Próximas llegadas</h3>
            <p class="mt-0.5 text-sm text-muted">Citas de hoy por atender</p>
          </div>
          <NuxtLink to="/appointments" class="text-sm font-semibold text-gold hover:underline">Ver agenda</NuxtLink>
        </header>
        <p v-if="errorLlegada" role="alert" class="mb-2 text-xs text-danger">{{ errorLlegada }}</p>
        <ul v-if="data.nextAppointments.length" class="divide-y divide-line">
          <li v-for="appt in data.nextAppointments" :key="appt.id" class="flex items-center gap-2">
            <button
              type="button"
              class="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
              :aria-label="`Ver detalle de la cita de ${appt.cliente}`"
              @click="detailCode = appt.code"
            >
              <span class="w-14 shrink-0 text-sm font-semibold tabular-nums text-gold">
                {{ appt.hora_inicio?.slice(0, 5) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-ink">{{ appt.cliente }}</p>
                <p class="truncate text-xs text-muted">{{ appt.servicio }} · {{ appt.barbero }}</p>
              </div>
              <span class="shrink-0 text-xs font-semibold" :class="yaPaso(appt.hora_inicio) ? 'text-warning' : 'text-muted'">
                {{ etiquetaRelativa(appt.hora_inicio, ahora) }}
              </span>
            </button>
            <span v-if="enSala(appt)" class="shrink-0 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-bold text-success">En sala</span>
            <button
              v-else
              type="button"
              :disabled="llegandoCodigo === appt.code"
              class="flex min-h-10 shrink-0 items-center rounded-lg bg-gold px-3 text-xs font-bold text-black transition-colors hover:bg-gold-dim disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
              :aria-label="`Marcar que ${appt.cliente} llegó`"
              @click="marcarLlegada(appt)"
            >
              {{ llegandoCodigo === appt.code ? "…" : "Llegó" }}
            </button>
            <!-- Cobro directo desde la llegada: abre Pagos con la cita preseleccionada. -->
            <NuxtLink
              :to="`/payments?cita=${appt.id}`"
              class="flex min-h-10 shrink-0 items-center rounded-lg border border-success/30 px-3 text-xs font-bold text-success transition-colors hover:bg-success/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
              :aria-label="`Cobrar la cita de ${appt.cliente}`"
            >
              Cobrar
            </NuxtLink>
          </li>
        </ul>
        <p
          v-else
          class="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted"
        >
          No hay más llegadas por hoy. Buen momento para revisar los pedidos o el corte de caja.
        </p>
      </section>

      <UiChartCard
        class="lg:col-span-5"
        title="Citas por hora"
        subtitle="Cómo se reparte el día"
        :empty="!hasFlow"
        empty-text="Todavía no hay citas registradas hoy."
        height="h-56"
      >
        <Bar :data="flowChartData" :options="flowChartOptions" />
      </UiChartCard>
    </section>

    <section
      v-if="data.kpis.pending_payments > 0"
      class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/10 px-5 py-4"
      aria-label="Citas por cobrar"
    >
      <p class="text-sm text-ink">
        <strong class="text-success">{{ data.kpis.pending_payments }}</strong>
        cita{{ data.kpis.pending_payments !== 1 ? "s" : "" }} sin cobrar. Cobra antes de que se vayan.
      </p>
      <NuxtLink to="/payments" class="flex min-h-10 items-center rounded-lg bg-success px-4 text-sm font-bold text-black hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
        Ir a cobrar
      </NuxtLink>
    </section>

    <section class="rounded-2xl border border-line bg-card p-5">
      <header class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-base font-semibold text-ink">Pedidos por entregar</h3>
          <p class="mt-0.5 text-sm text-muted">Compras de la tienda listas para el cliente</p>
        </div>
        <NuxtLink to="/orders" class="text-sm font-semibold text-gold hover:underline">Ver pedidos</NuxtLink>
      </header>
      <ul v-if="data.pendingOrders.length" class="divide-y divide-line">
        <li
          v-for="order in data.pendingOrders"
          :key="order.id"
          class="flex items-center gap-3 py-3"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-ink">
              {{ order.folio }} · {{ order.cliente }}
            </p>
            <p class="truncate text-xs text-muted">
              {{ order.creadoEn }} · {{ order.itemsCount }} artículo{{ order.itemsCount !== 1 ? "s" : "" }}
            </p>
          </div>
          <UiBadge tone="warning">Por entregar</UiBadge>
          <NuxtLink
            to="/orders"
            class="flex min-h-10 shrink-0 items-center rounded-lg border border-line px-3 text-xs font-bold text-gold transition-colors hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
            :aria-label="`Entregar el pedido ${order.folio}`"
          >
            Entregar
          </NuxtLink>
          <p class="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
            {{ fmtMoney(order.total) }}
          </p>
        </li>
      </ul>
      <p
        v-else
        class="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted"
      >
        No hay pedidos pendientes.
      </p>
    </section>

    <DashboardAnalyticsInsights :insights="data.sparkHighlights" show-link />

    <UiAppointmentDetailModal v-if="detailCode" :code="detailCode" @close="detailCode = null" />
  </div>
</template>
