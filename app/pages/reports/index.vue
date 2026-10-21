<script setup lang="ts">
import { Bar } from "vue-chartjs";
import { appointmentStatus } from "~/utils/appointmentStatus";
import {
  appointmentStatusColor,
  chartAxisClean,
  chartScale,
  chartTooltip,
  fmtInt,
  fmtMoney as money,
  goldRgba,
  tokenRgba,
} from "~/utils/chartTheme";
import { ensureChartjsRegistered } from "~/utils/registerChartjs";

ensureChartjsRegistered();

/*
 * Fase 9.9 — Centro de Reportes. `barber` tiene dos sistemas de reportes en
 * paralelo (ver .claude/skills/nuxt-migration-plan/SKILL.md): esta página
 * usa Api\Admin\Report\ReportAdminController (revenue/appointments/
 * inventory/clients — ya reales, con agregaciones completas) para los
 * tableros, y Api\Report\ReportController::export() (ReportService, ya
 * genera Excel/PDF reales) para las descargas — no se usa
 * ReportAdminController::exportReport()/listReports()/generateCustomReport(),
 * que son placeholders sin persistencia ni archivo real.
 */
definePageMeta({ middleware: ["auth", "engineer"], layout: "dashboard" });
useSeoMeta({ title: 'Reportes — UrbanBlade', robots: 'noindex' })


type Period = "dia" | "semana" | "mes" | "trimestre" | "año";

const PERIOD_LABEL: Record<Period, string> = {
  dia: "Hoy",
  semana: "Esta semana",
  mes: "Este mes",
  trimestre: "Este trimestre",
  año: "Este año",
};

interface RevenueData {
  totalRevenue: number;
  totalAppointments: number;
  averageRevenue: number;
  revenueByBarber: Record<
    string,
    { barber: string; total: number; count: number; average: number }
  >;
}
interface AppointmentsData {
  totalAppointments: number;
  appointmentsByStatus: Record<string, number>;
  completionRate: number;
  averageAppointmentsPerDay: number;
}
interface InventoryData {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  criticalCount: number;
}
interface ClientsData {
  totalClients: number;
  newClients: number;
  activeClients: number;
  inactiveClients: number;
  clientRetention: number;
}
interface BarberCommissionRow {
  barber: { id: string; nombre: string };
  citas_completadas: number;
  total_generado: number;
  comision_pct: number;
  comision_monto: number;
}
interface CommissionsData {
  periodo: { desde: string; hasta: string };
  barberos: BarberCommissionRow[];
  total_generado: number;
  total_comisiones: number;
}

const { apiFetch } = useApi();
const period = ref<Period>("mes");

const { data: revenueRes, pending: revenuePending } = await useAsyncData(
  buildDataKey("reports-revenue", { period: period.value }),
  () =>
    apiFetch<{ data: RevenueData }>("/admin/reports/revenue", {
      query: { period: period.value },
    }),
  { watch: [period], lazy: true },
);
const { data: apptRes, pending: apptPending } = await useAsyncData(
  buildDataKey("reports-appointments", { period: period.value }),
  () =>
    apiFetch<{ data: AppointmentsData }>("/admin/reports/appointments", {
      query: { period: period.value },
    }),
  { watch: [period], lazy: true },
);
const { data: inventoryRes, pending: inventoryPending } = await useAsyncData(
  "reports-inventory",
  () => apiFetch<{ data: InventoryData }>("/admin/reports/inventory"),
  { lazy: true },
);
const { data: clientsRes, pending: clientsPending } = await useAsyncData(
  buildDataKey("reports-clients", { period: period.value }),
  () =>
    apiFetch<{ data: ClientsData }>("/admin/reports/clients", {
      query: { period: period.value },
    }),
  { watch: [period], lazy: true },
);
const { data: commissionsRes, pending: commissionsPending } = await useAsyncData(
  buildDataKey("reports-barber-commissions", { period: period.value }),
  () =>
    apiFetch<{ data: CommissionsData }>("/admin/reports/barber-commissions", {
      query: { period: period.value },
    }),
  { watch: [period], lazy: true },
);

const revenue = computed(() => revenueRes.value?.data);
const appt = computed(() => apptRes.value?.data);
const inventory = computed(() => inventoryRes.value?.data);
const clients = computed(() => clientsRes.value?.data);
const commissions = computed(() => commissionsRes.value?.data);
const anyPending = computed(
  () =>
    revenuePending.value ||
    apptPending.value ||
    inventoryPending.value ||
    clientsPending.value ||
    commissionsPending.value,
);

// ── Gráficas ────────────────────────────────────────────────────────────
const statusItems = computed(() =>
  Object.entries(appt.value?.appointmentsByStatus ?? {}).map(([estado, value]) => ({
    label: appointmentStatus(estado).label,
    value: Number(value),
    color: appointmentStatusColor(estado),
  })),
);

const clientItems = computed(() => {
  const c = clients.value;
  if (!c) return [];
  const inactive = c.inactiveClients ?? Math.max(0, c.totalClients - c.activeClients);

  return [
    { label: "Activos", value: c.activeClients, color: tokenRgba("success", 0.9) },
    { label: "Inactivos", value: inactive, color: tokenRgba("ink", 0.25) },
  ];
});

const barberRevenue = computed(() =>
  Object.values(revenue.value?.revenueByBarber ?? {}).sort((a, b) => b.total - a.total),
);
const hasBarberRevenue = computed(() => barberRevenue.value.some((b) => b.total > 0));
const barberRevenueData = computed(() => ({
  labels: barberRevenue.value.map((b) => b.barber),
  datasets: [
    {
      label: "Ingresos",
      data: barberRevenue.value.map((b) => b.total),
      backgroundColor: barberRevenue.value.map((_, i) => goldRgba(i === 0 ? 0.95 : 0.55)),
      borderRadius: 6,
      maxBarThickness: 26,
    },
  ],
}));
const barberRevenueOptions = computed(() => ({
  indexAxis: "y" as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...chartTooltip(),
      callbacks: {
        label: (ctx: { parsed: { x: number }; dataIndex: number }) =>
          `${money(ctx.parsed.x)} · ${barberRevenue.value[ctx.dataIndex]?.count ?? 0} citas`,
      },
    },
  },
  scales: {
    x: { ...chartScale(), beginAtZero: true, ticks: { ...chartScale().ticks, maxTicksLimit: 5, callback: (v: number | string) => money(Number(v)) } },
    y: chartAxisClean(),
  },
}));

const inventoryHealth = computed(() => {
  const i = inventory.value;
  if (!i || !i.totalProducts) return null;
  const critical = i.criticalCount;
  const low = Math.max(0, i.lowStockCount - critical);
  const ok = Math.max(0, i.totalProducts - critical - low);
  const total = ok + low + critical || 1;

  return [
    { label: "Stock sano", value: ok, pct: (ok / total) * 100, bar: "bg-success", dot: "bg-success" },
    { label: "Stock bajo", value: low, pct: (low / total) * 100, bar: "bg-warning", dot: "bg-warning" },
    { label: "Crítico", value: critical, pct: (critical / total) * 100, bar: "bg-danger", dot: "bg-danger" },
  ];
});

const commissionsData = computed(() => ({
  labels: (commissions.value?.barberos ?? []).map((b) => b.barber.nombre),
  datasets: [
    { label: "Generado", data: (commissions.value?.barberos ?? []).map((b) => b.total_generado), backgroundColor: goldRgba(0.35), borderRadius: 6, maxBarThickness: 32 },
    { label: "Comisión", data: (commissions.value?.barberos ?? []).map((b) => b.comision_monto), backgroundColor: goldRgba(0.95), borderRadius: 6, maxBarThickness: 32 },
  ],
}));
const commissionsOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index" as const, intersect: false },
  plugins: {
    legend: { display: true, position: "top" as const, align: "end" as const, labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
    tooltip: { ...chartTooltip(), displayColors: true, callbacks: { label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` } },
  },
  scales: {
    y: { ...chartScale(), beginAtZero: true, ticks: { ...chartScale().ticks, maxTicksLimit: 5, callback: (v: number | string) => money(Number(v)) } },
    x: chartAxisClean(),
  },
}));
const hasCommissions = computed(() => (commissions.value?.barberos ?? []).length > 0);

function fmtMoney(n: number | undefined) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

// ── Exportar (excel/pdf reales vía ReportService) ───────────────────────
const EXPORT_TYPES = [
  { value: "ingresos", label: "Ingresos" },
  { value: "citas", label: "Citas" },
  { value: "inventario", label: "Inventario" },
  { value: "clientes", label: "Clientes" },
] as const;

const exporting = ref<string | null>(null);
const exportError = ref("");

async function downloadReport(type: string, format: "excel" | "pdf") {
  const key = `${type}-${format}`;
  exporting.value = key;
  exportError.value = "";
  try {
    const blob = await apiFetch<Blob>(`/reports/${type}/${format}`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}.${format === "excel" ? "xlsx" : "pdf"}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    exportError.value = "No se pudo generar el archivo.";
  } finally {
    exporting.value = null;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Centro de <span class="text-gold">Reportes</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Métricas agregadas del negocio, exportables en Excel o PDF.
        </p>
      </div>
      <div role="tablist" aria-label="Periodo del reporte" class="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
        <button
          v-for="(label, value) in PERIOD_LABEL"
          :key="value"
          type="button"
          role="tab"
          :aria-selected="period === value"
          class="min-h-10 rounded-lg px-3.5 text-sm font-semibold transition-colors"
          :class="period === value ? 'bg-gold text-black' : 'text-muted hover:text-ink'"
          @click="period = value"
        >
          {{ label }}
        </button>
      </div>
    </header>

    <p v-if="anyPending" class="mb-4 text-sm text-muted" role="status">Calculando métricas…</p>

    <section class="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Indicadores del periodo">
      <UiStatCard label="Ingresos" :value="money(revenue?.totalRevenue)" :hint="`${fmtInt(revenue?.totalAppointments)} citas cobradas`" />
      <UiStatCard label="Ticket promedio" :value="money(revenue?.averageRevenue)" hint="Por cita" />
      <UiStatCard label="Citas" :value="fmtInt(appt?.totalAppointments)" :hint="`${appt?.averageAppointmentsPerDay ?? 0} por día`" />
      <UiStatCard label="Finalización" :value="`${appt?.completionRate ?? 0}%`" hint="Citas completadas" :progress="Number(appt?.completionRate ?? 0)" />
      <UiStatCard label="Clientes activos" :value="fmtInt(clients?.activeClients)" :hint="`${fmtInt(clients?.newClients)} nuevos · ${fmtInt(clients?.totalClients)} en total`" />
      <UiStatCard label="Retención" :value="`${clients?.clientRetention ?? 0}%`" hint="Clientes que regresan" :progress="Number(clients?.clientRetention ?? 0)" />
      <UiStatCard label="Valor del inventario" :value="money(inventory?.totalValue)" :hint="`${fmtInt(inventory?.totalProducts)} productos`" to="/inventory/products" />
      <UiStatCard label="Stock crítico" :value="fmtInt(inventory?.criticalCount)" :hint="`${fmtInt(inventory?.lowStockCount)} con stock bajo`" to="/inventory/products" />
    </section>

    <section class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <UiDonutCard
        title="Citas por estado"
        subtitle="Cómo terminaron las citas del periodo"
        :items="statusItems"
        center-label="Citas"
        empty-text="No hay citas en este periodo."
      />
      <UiChartCard
        title="Ingresos por barbero"
        subtitle="Total cobrado en el periodo"
        height="h-72"
        :empty="!hasBarberRevenue"
        empty-text="Sin ingresos en este periodo."
      >
        <Bar :data="barberRevenueData" :options="barberRevenueOptions" />
      </UiChartCard>
      <UiDonutCard
        title="Base de clientes"
        subtitle="Activos frente a inactivos"
        :items="clientItems"
        :center-value="`${clients?.clientRetention ?? 0}%`"
        center-label="Retención"
        empty-text="Todavía no hay clientes registrados."
      />
      <section class="ub-rise flex flex-col rounded-2xl border border-line bg-card p-5 sm:p-6" aria-labelledby="rep-inv">
        <header class="mb-5">
          <h3 id="rep-inv" class="text-base font-semibold text-ink">Salud del inventario</h3>
          <p class="mt-0.5 text-sm text-muted">Productos por nivel de existencias</p>
        </header>
        <template v-if="inventoryHealth">
          <div class="flex h-4 w-full overflow-hidden rounded-full bg-ink/10" role="img" :aria-label="inventoryHealth.map((x) => `${x.label}: ${x.value}`).join(', ')">
            <div v-for="seg in inventoryHealth" :key="seg.label" :class="seg.bar" :style="{ width: `${seg.pct}%` }" />
          </div>
          <ul class="mt-5 space-y-3">
            <li v-for="seg in inventoryHealth" :key="seg.label" class="flex items-center gap-3 text-sm">
              <span class="h-3 w-3 rounded-full" :class="seg.dot" aria-hidden="true" />
              <span class="flex-1 text-ink">{{ seg.label }}</span>
              <span class="font-semibold tabular-nums text-ink">{{ fmtInt(seg.value) }}</span>
              <span class="w-10 text-right text-xs tabular-nums text-muted">{{ Math.round(seg.pct) }}%</span>
            </li>
          </ul>
          <NuxtLink to="/inventory/products" class="mt-5 text-sm font-semibold text-gold hover:underline">Ir al inventario →</NuxtLink>
        </template>
        <p v-else class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">
          Todavía no hay productos registrados.
        </p>
      </section>
    </section>

    <section class="ui-card mb-8 p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-black uppercase tracking-wide text-ink">
          Comisiones de barberos
        </h2>
        <p v-if="commissions" class="text-xs text-muted">
          {{ commissions.periodo.desde }} — {{ commissions.periodo.hasta }}
        </p>
      </div>
      <div v-if="commissions" class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p class="text-[11px] font-bold uppercase text-muted">Generado (precio de lista)</p>
          <p class="mt-1 text-lg font-black text-ink">{{ fmtMoney(commissions.total_generado) }}</p>
        </div>
        <div>
          <p class="text-[11px] font-bold uppercase text-muted">Total a pagar</p>
          <p class="mt-1 text-lg font-black text-gold">{{ fmtMoney(commissions.total_comisiones) }}</p>
        </div>
      </div>
      <div v-if="hasCommissions" class="mb-5 h-64">
        <Bar :data="commissionsData" :options="commissionsOptions" />
      </div>
      <p v-if="commissions && !commissions.barberos.length" class="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
        Sin citas completadas en este periodo.
      </p>
      <div v-else-if="commissions" class="overflow-x-auto">
        <table aria-label="Comisiones de barberos" class="w-full text-sm">
          <thead>
            <tr class="text-left text-[11px] font-bold uppercase text-muted">
              <th scope="col" class="pb-2">Barbero</th>
              <th scope="col" class="pb-2 text-right">Citas</th>
              <th scope="col" class="pb-2 text-right">Generado</th>
              <th scope="col" class="pb-2 text-right">%</th>
              <th scope="col" class="pb-2 text-right">Comisión</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in commissions.barberos" :key="row.barber.id" class="border-t border-line">
              <td class="py-2 text-ink">{{ row.barber.nombre }}</td>
              <td class="py-2 text-right text-ink">{{ row.citas_completadas }}</td>
              <td class="py-2 text-right text-ink">{{ fmtMoney(row.total_generado) }}</td>
              <td class="py-2 text-right text-muted">{{ row.comision_pct }}%</td>
              <td class="py-2 text-right font-black text-gold">{{ fmtMoney(row.comision_monto) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-[11px] italic text-muted">
        Sobre el precio de lista del servicio, no lo que realmente entró en caja
        (descuentos, paquetes, gift cards y premios de rifa son decisión del
        negocio, no reducen lo que se le debe al barbero). Este reporte solo
        informa -- el pago real se sigue manejando fuera del sistema.
      </p>
    </section>

    <section class="ui-card p-5">
      <h2 class="mb-3 text-sm font-black uppercase tracking-wide text-ink">
        Exportar reporte detallado
      </h2>
      <p v-if="exportError" class="mb-3 text-sm text-danger">
        {{ exportError }}
      </p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="t in EXPORT_TYPES"
          :key="t.value"
          class="rounded-xl border border-line p-4"
        >
          <p class="mb-3 text-sm font-bold text-ink">{{ t.label }}</p>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="exporting === `${t.value}-excel`"
              class="flex-1 rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-50"
              @click="downloadReport(t.value, 'excel')"
            >
              {{ exporting === `${t.value}-excel` ? "Generando…" : "Excel" }}
            </button>
            <button
              type="button"
              :disabled="exporting === `${t.value}-pdf`"
              class="flex-1 rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-50"
              @click="downloadReport(t.value, 'pdf')"
            >
              {{ exporting === `${t.value}-pdf` ? "Generando…" : "PDF" }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
