<script setup lang="ts">
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
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Centro de <span class="text-gold">Reportes</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Métricas agregadas del negocio, exportables en Excel o PDF.
        </p>
      </div>
      <select
        v-model="period"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option
          v-for="(label, value) in PERIOD_LABEL"
          :key="value"
          :value="value"
        >
          {{ label }}
        </option>
      </select>
    </header>

    <p v-if="anyPending" class="mb-4 text-sm text-muted">
      Calculando métricas…
    </p>

    <div class="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section class="ui-card p-5">
        <h2 class="mb-3 text-sm font-black uppercase tracking-wide text-ink">
          Ingresos
        </h2>
        <div v-if="revenue" class="grid grid-cols-3 gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Total</p>
            <p class="mt-1 text-lg font-black text-gold">
              {{ fmtMoney(revenue.totalRevenue) }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">
              Citas cobradas
            </p>
            <p class="mt-1 text-lg font-black text-ink">
              {{ revenue.totalAppointments }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Promedio</p>
            <p class="mt-1 text-lg font-black text-ink">
              {{ fmtMoney(revenue.averageRevenue) }}
            </p>
          </div>
        </div>
        <ul v-if="revenue" class="mt-4 space-y-1 text-xs text-muted">
          <li v-for="(row, id) in revenue.revenueByBarber" :key="id">
            {{ row.barber }}: {{ fmtMoney(row.total) }} ({{ row.count }} citas)
          </li>
        </ul>
      </section>

      <section class="ui-card p-5">
        <h2 class="mb-3 text-sm font-black uppercase tracking-wide text-ink">
          Citas
        </h2>
        <div v-if="appt" class="grid grid-cols-3 gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Total</p>
            <p class="mt-1 text-lg font-black text-ink">
              {{ appt.totalAppointments }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">
              Finalización
            </p>
            <p class="mt-1 text-lg font-black text-emerald-400">
              {{ appt.completionRate }}%
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Prom./día</p>
            <p class="mt-1 text-lg font-black text-ink">
              {{ appt.averageAppointmentsPerDay }}
            </p>
          </div>
        </div>
        <ul v-if="appt" class="mt-4 space-y-1 text-xs text-muted">
          <li
            v-for="(count, estado) in appt.appointmentsByStatus"
            :key="estado"
          >
            {{ estado }}: {{ count }}
          </li>
        </ul>
      </section>

      <section class="ui-card p-5">
        <h2 class="mb-3 text-sm font-black uppercase tracking-wide text-ink">
          Inventario
        </h2>
        <div v-if="inventory" class="grid grid-cols-2 gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Productos</p>
            <p class="mt-1 text-lg font-black text-ink">
              {{ inventory.totalProducts }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">
              Valor total
            </p>
            <p class="mt-1 text-lg font-black text-gold">
              {{ fmtMoney(inventory.totalValue) }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Stock bajo</p>
            <p class="mt-1 text-lg font-black text-amber-400">
              {{ inventory.lowStockCount }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Crítico</p>
            <p class="mt-1 text-lg font-black text-red-400">
              {{ inventory.criticalCount }}
            </p>
          </div>
        </div>
      </section>

      <section class="ui-card p-5">
        <h2 class="mb-3 text-sm font-black uppercase tracking-wide text-ink">
          Clientes
        </h2>
        <div v-if="clients" class="grid grid-cols-2 gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Total</p>
            <p class="mt-1 text-lg font-black text-ink">
              {{ clients.totalClients }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Nuevos</p>
            <p class="mt-1 text-lg font-black text-gold">
              {{ clients.newClients }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Activos</p>
            <p class="mt-1 text-lg font-black text-emerald-400">
              {{ clients.activeClients }}
            </p>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase text-muted">Retención</p>
            <p class="mt-1 text-lg font-black text-ink">
              {{ clients.clientRetention }}%
            </p>
          </div>
        </div>
      </section>
    </div>

    <section class="ui-card mb-8 p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-black uppercase tracking-wide text-ink">
          Comisiones de barberos
        </h2>
        <p v-if="commissions" class="text-xs text-muted">
          {{ commissions.periodo.desde }} — {{ commissions.periodo.hasta }}
        </p>
      </div>
      <div v-if="commissions" class="mb-4 grid grid-cols-2 gap-3">
        <div>
          <p class="text-[10px] font-bold uppercase text-muted">Generado (precio de lista)</p>
          <p class="mt-1 text-lg font-black text-ink">{{ fmtMoney(commissions.total_generado) }}</p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase text-muted">Total a pagar</p>
          <p class="mt-1 text-lg font-black text-gold">{{ fmtMoney(commissions.total_comisiones) }}</p>
        </div>
      </div>
      <p v-if="commissions && !commissions.barberos.length" class="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
        Sin citas completadas en este periodo.
      </p>
      <div v-else-if="commissions" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[10px] font-bold uppercase text-muted">
              <th class="pb-2">Barbero</th>
              <th class="pb-2 text-right">Citas</th>
              <th class="pb-2 text-right">Generado</th>
              <th class="pb-2 text-right">%</th>
              <th class="pb-2 text-right">Comisión</th>
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
      <p class="mt-3 text-[10px] italic text-muted">
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
      <p v-if="exportError" class="mb-3 text-sm text-red-400">
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
