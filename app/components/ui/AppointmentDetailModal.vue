<script setup lang="ts">
/*
 * Detalle completo de una cita (GET /appointments/{código}): servicio, estado, fecha y hora, cliente (con contacto
 * si eres personal), barbero, precio, depósito, pagos y notas. Se abre al tocar una cita en cualquier lista de los
 * paneles; así las filas pueden ser cortas y el detalle no obliga a salir de la pantalla.
 */
import { appointmentStatus } from "~/utils/appointmentStatus";
import { fmtMoney } from "~/utils/chartTheme";

interface Payment {
  metodo_pago: string | null;
  estado: string | null;
  monto: number;
  propina: number;
  fecha: string | null;
}
interface Detail {
  code: string;
  fecha: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  estado: string;
  notas: string | null;
  precio_cobrado: number | null;
  propina_sugerida: number | null;
  deposito_requerido: boolean;
  deposito_monto: number | null;
  deposito_estado: string | null;
  client: { user: { name: string | null; avatar_url?: string | null } };
  barber: { user: { name: string | null }; foto_url?: string | null };
  service: { nombre: string | null; precio: number | null; duracion_min: number | null };
  contacto: { email: string | null; telefono: string | null } | null;
  pagos: Payment[];
  creada_en: string | null;
}

const props = defineProps<{ code: string }>();
defineEmits<{ close: [] }>();

const { apiFetch } = useApi();
const detail = ref<Detail | null>(null);
const loading = ref(true);
const failed = ref("");

onMounted(async () => {
  try {
    detail.value = (await apiFetch<{ data: Detail }>(`/appointments/${props.code}`)).data;
  } catch (err: unknown) {
    failed.value = (err as { data?: { message?: string } })?.data?.message ?? "No se pudo cargar el detalle de la cita.";
  } finally {
    loading.value = false;
  }
});

const status = computed(() => appointmentStatus(detail.value?.estado));
const when = computed(() => {
  const d = detail.value;
  if (!d?.fecha) return "—";
  const day = new Date(`${d.fecha}T00:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const first = day.charAt(0).toUpperCase() + day.slice(1);

  return `${first} · ${d.hora_inicio?.slice(0, 5) ?? "--:--"}${d.hora_fin ? ` a ${d.hora_fin.slice(0, 5)}` : ""}`;
});
const created = computed(() =>
  detail.value?.creada_en
    ? new Date(detail.value.creada_en).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null,
);
const money = (value: number | null | undefined) => (value === null || value === undefined ? "—" : fmtMoney(value));
const label = (value: string | null) => (value ? value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ") : "—");
</script>

<template>
  <UiModal title="Detalle de la cita" @close="$emit('close')">
    <p v-if="loading" class="py-10 text-center text-sm text-muted" role="status">Cargando detalle…</p>
    <p v-else-if="failed" class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{{ failed }}</p>

    <div v-else-if="detail" class="space-y-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-xl font-semibold text-ink">{{ detail.service.nombre ?? "Servicio" }}</h3>
          <p class="mt-1 text-sm text-muted">{{ when }}</p>
        </div>
        <UiBadge :tone="status.tone" class="shrink-0">{{ status.label }}</UiBadge>
      </header>

      <div class="grid gap-3 sm:grid-cols-2">
        <section class="rounded-xl border border-line p-4" aria-label="Cliente">
          <p class="text-xs font-bold uppercase tracking-wide text-muted">Cliente</p>
          <div class="mt-2 flex items-center gap-3">
            <UiAvatar :src="detail.client.user.avatar_url" :name="detail.client.user.name ?? 'Cliente'" />
            <p class="min-w-0 truncate text-sm font-semibold text-ink">{{ detail.client.user.name ?? "Cliente" }}</p>
          </div>
          <dl v-if="detail.contacto" class="mt-3 space-y-1 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-muted">Correo</dt><dd class="truncate text-ink">{{ detail.contacto.email ?? "—" }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted">Teléfono</dt><dd class="text-ink">{{ detail.contacto.telefono ?? "—" }}</dd></div>
          </dl>
        </section>

        <section class="rounded-xl border border-line p-4" aria-label="Barbero">
          <p class="text-xs font-bold uppercase tracking-wide text-muted">Barbero</p>
          <div class="mt-2 flex items-center gap-3">
            <UiAvatar :src="detail.barber.foto_url" :name="detail.barber.user.name ?? 'Barbero'" />
            <p class="min-w-0 truncate text-sm font-semibold text-ink">{{ detail.barber.user.name ?? "—" }}</p>
          </div>
          <dl class="mt-3 space-y-1 text-sm">
            <div class="flex justify-between gap-3"><dt class="text-muted">Duración</dt><dd class="text-ink">{{ detail.service.duracion_min ? `${detail.service.duracion_min} min` : "—" }}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-muted">Precio de lista</dt><dd class="text-ink">{{ money(detail.service.precio) }}</dd></div>
          </dl>
        </section>
      </div>

      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-xl bg-ink/[0.03] p-3">
          <dt class="text-xs font-bold uppercase tracking-wide text-muted">Cobrado</dt>
          <dd class="mt-1 text-lg font-semibold tabular-nums text-ink">{{ money(detail.precio_cobrado) }}</dd>
        </div>
        <div class="rounded-xl bg-ink/[0.03] p-3">
          <dt class="text-xs font-bold uppercase tracking-wide text-muted">Propina sugerida</dt>
          <dd class="mt-1 text-lg font-semibold tabular-nums text-ink">{{ money(detail.propina_sugerida) }}</dd>
        </div>
        <div class="rounded-xl bg-ink/[0.03] p-3">
          <dt class="text-xs font-bold uppercase tracking-wide text-muted">Depósito</dt>
          <dd class="mt-1 text-lg font-semibold tabular-nums text-ink">
            {{ detail.deposito_requerido ? money(detail.deposito_monto) : "No requiere" }}
          </dd>
          <dd v-if="detail.deposito_requerido" class="text-xs text-muted">{{ label(detail.deposito_estado ?? "pendiente") }}</dd>
        </div>
        <div class="rounded-xl bg-ink/[0.03] p-3">
          <dt class="text-xs font-bold uppercase tracking-wide text-muted">Código</dt>
          <dd class="mt-1 break-all text-sm font-semibold text-ink">{{ detail.code }}</dd>
        </div>
      </dl>

      <section v-if="detail.pagos.length" aria-label="Pagos">
        <h4 class="mb-2 text-sm font-semibold text-ink">Pagos registrados</h4>
        <ul class="divide-y divide-line rounded-xl border border-line">
          <li v-for="(pago, i) in detail.pagos" :key="i" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span class="font-semibold text-ink">{{ label(pago.metodo_pago) }}</span>
            <span class="text-muted">{{ label(pago.estado) }}</span>
            <span class="tabular-nums text-ink">{{ money(pago.monto) }}<span v-if="pago.propina" class="text-muted"> + {{ money(pago.propina) }} de propina</span></span>
          </li>
        </ul>
      </section>

      <section v-if="detail.notas" aria-label="Notas">
        <h4 class="mb-1 text-sm font-semibold text-ink">Notas</h4>
        <p class="rounded-xl bg-ink/[0.03] p-3 text-sm leading-relaxed text-muted">{{ detail.notas }}</p>
      </section>

      <p v-if="created" class="text-xs text-muted">Cita creada el {{ created }}.</p>
    </div>
  </UiModal>
</template>
