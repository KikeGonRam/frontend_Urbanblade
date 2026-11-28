<script setup lang="ts">
import { includedLabel, includedSavings, includedValue, type IncludedService } from "~/utils/membership";
/*
 * Administración mínima de planes de membresía recurrente (roadmap de
 * mercado): crear y desactivar. Cada plan crea un Product+Price real en
 * Stripe del lado servidor (ver StripePaymentService::createMonthlyPrice()
 * en barber) -- aquí solo se captura nombre/descripción/precio/descuento.
 * Editar el precio de un plan existente (que exige crear un Price nuevo en
 * Stripe) queda fuera de esta primera rebanada; para cambiar un precio,
 * desactivar el plan viejo y crear uno nuevo.
 */
definePageMeta({ middleware: ["auth", "admin"], layout: "dashboard" });
useSeoMeta({ title: 'Planes de membresía — UrbanBlade', robots: 'noindex' })


interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_mensual: number;
  descuento_pct: number;
  activo: boolean;
  servicios_incluidos?: IncludedService[];
  valor_lista?: number;
}

const { apiFetch } = useApi();
const { confirm } = useConfirm();

const { data: response, pending, error, refresh } = await useAsyncData(
  "admin-membership-plans",
  () => apiFetch<{ data: Plan[] }>("/admin/membership-plans"),
);
const plans = computed(() => response.value?.data ?? []);

function fmtMoney(n: number) {
  return formatMoney(n)
}

const showCreate = ref(false);
const form = reactive({ nombre: "", descripcion: "", precio_mensual: 299, descuento_pct: 10 });

// Planes Club: servicios incluidos cada mes (opcional). Sin filas, el plan es solo de descuento.
const included = ref<{ service_id: string; usos: number }[]>([]);
const { data: catalog } = await useAsyncData(
  "admin-membership-services",
  () => apiFetch<{ data: { id: string; nombre: string; precio: number }[] }>("/services"),
  { lazy: true },
);
const services = computed(() => catalog.value?.data ?? []);
const chosen = computed(() => included.value.filter((row) => row.service_id && row.usos > 0));
const listValue = computed(() =>
  includedValue(chosen.value.map((row) => ({ usos: row.usos, precio: services.value.find((s) => s.id === row.service_id)?.precio ?? 0 }))),
);
const savings = computed(() => includedSavings(listValue.value, form.precio_mensual));
const createError = ref("");
const saving = ref(false);

function openCreate() {
  form.nombre = "";
  form.descripcion = "";
  form.precio_mensual = 299;
  form.descuento_pct = 10;
  included.value = [];
  createError.value = "";
  showCreate.value = true;
}

async function submitCreate() {
  saving.value = true;
  createError.value = "";
  try {
    await apiFetch("/admin/membership-plans", {
      method: "POST",
      body: {
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        precio_mensual: form.precio_mensual,
        descuento_pct: form.descuento_pct,
        servicios_incluidos: chosen.value.length ? chosen.value : undefined,
      },
    });
    showCreate.value = false;
    await refresh();
  } catch (err: unknown) {
    createError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo crear el plan.";
  } finally {
    saving.value = false;
  }
}

const deactivating = ref<string | null>(null);

async function deactivate(plan: Plan) {
  const accepted = await confirm({
    title: "Desactivar plan",
    message: `¿Desactivar "${plan.nombre}"? Las membresías ya contratadas no se ven afectadas.`,
    confirmText: "Sí, desactivar",
    isDanger: true,
  });
  if (!accepted) return;

  deactivating.value = plan.id;
  try {
    await apiFetch(`/admin/membership-plans/${plan.id}`, { method: "DELETE" });
    await refresh();
  } finally {
    deactivating.value = null;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Planes de <span class="text-gold">Membresía</span>
        </h1>
        <p class="mt-1 text-sm text-muted">Define los planes que los clientes pueden contratar.</p>
      </div>
      <button type="button" class="ui-btn" @click="openCreate">+ Nuevo plan</button>
    </header>

    <p v-if="pending" class="text-sm text-muted">Cargando…</p>
    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudieron cargar los planes"
      action-label="Reintentar"
      @action="refresh"
    />
    <p v-else-if="!plans.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      Todavía no hay planes de membresía.
    </p>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="plan in plans" :key="plan.id" class="ui-card p-5">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-black uppercase text-ink">{{ plan.nombre }}</h3>
          <span
            class="rounded-full border px-2 py-0.5 text-xs font-black uppercase"
            :class="plan.activo ? 'border-success/25 bg-success/10 text-success' : 'border-ink/15 bg-ink/5 text-ink/50'"
          >{{ plan.activo ? "Activo" : "Desactivado" }}</span>
        </div>
        <p v-if="plan.descripcion" class="mt-1 text-xs text-muted">{{ plan.descripcion }}</p>
        <p class="mt-2 text-xl font-black text-gold">
          {{ fmtMoney(plan.precio_mensual) }}<span class="text-xs text-muted">/mes</span>
        </p>
        <ul v-if="plan.servicios_incluidos?.length" class="mt-2 space-y-1 text-sm text-ink">
          <li v-for="item in plan.servicios_incluidos" :key="item.service_id">{{ includedLabel(item) }}</li>
        </ul>
        <p class="text-sm text-ink/80">{{ plan.descuento_pct }}% de descuento{{ plan.servicios_incluidos?.length ? " en lo demás" : "" }}</p>
        <button
          v-if="plan.activo"
          type="button"
          class="ui-btn-secondary mt-4 text-xs"
          :disabled="deactivating === plan.id"
          @click="deactivate(plan)"
        >
          {{ deactivating === plan.id ? "Desactivando…" : "Desactivar" }}
        </button>
      </div>
    </div>

    <UiFormSheet
      v-if="showCreate"
      title="Nuevo plan"
      kicker="Membresías"
      icon="tag"
      subtitle="Precio mensual y descuento que recibe quien lo contrata."
      hint="Disponible para contratar al crearlo"
      badge="Alta"
      form-id="plan-form"
      submit-label="Crear plan"
      :busy="saving"
      @close="showCreate = false"
    >
      <form id="plan-form" class="space-y-4" @submit.prevent="submitCreate">
        <UiFormField field-id="plan-nombre" label="Nombre del plan" icon="tag">
          <input id="plan-nombre" v-model="form.nombre" aria-label="Nombre" type="text" required class="ui-input w-full">
        </UiFormField>
        <UiFormField field-id="plan-descripcion" label="Descripción (opcional)" icon="text" top>
          <textarea id="plan-descripcion" v-model="form.descripcion" aria-label="Descripción (opcional)" rows="2" class="ui-input w-full" />
        </UiFormField>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UiFormField field-id="plan-precio" label="Precio mensual (MXN)" icon="cash">
            <input id="plan-precio" v-model.number="form.precio_mensual" aria-label="Precio mensual (MXN)" type="number" min="1" step="1" required class="ui-input w-full">
          </UiFormField>
          <UiFormField field-id="plan-descuento" label="Descuento (%)" icon="percent">
            <input id="plan-descuento" v-model.number="form.descuento_pct" aria-label="Descuento (%)" type="number" min="1" max="100" step="1" required class="ui-input w-full">
          </UiFormField>
        </div>
        <fieldset class="m-0 space-y-2 border-0 p-0">
          <legend class="ub-form-section__title">Servicios incluidos cada mes (opcional)</legend>
          <div v-for="(row, index) in included" :key="index" class="flex items-center gap-2">
            <select v-model="row.service_id" :aria-label="`Servicio incluido ${index + 1}`" class="ui-input min-w-0 flex-1">
              <option value="" disabled>Elige un servicio</option>
              <option v-for="s in services" :key="s.id" :value="s.id">{{ s.nombre }} ({{ fmtMoney(s.precio) }})</option>
            </select>
            <input v-model.number="row.usos" :aria-label="`Usos al mes ${index + 1}`" type="number" min="1" max="31" step="1" class="ui-input w-20">
            <button type="button" class="ui-btn-secondary text-xs" @click="included.splice(index, 1)">Quitar</button>
          </div>
          <button type="button" class="ui-btn-secondary text-xs" :disabled="included.length >= 10" @click="included.push({ service_id: '', usos: 2 })">+ Añadir servicio</button>
          <p v-if="chosen.length" class="text-xs" :class="savings > 0 ? 'text-muted' : 'text-warning'">
            Valor de lista: {{ fmtMoney(listValue) }}.
            {{ savings > 0 ? `El cliente ahorra ${fmtMoney(savings)} al mes.` : "La cuota iguala o supera lo incluido: al cliente no le conviene." }}
          </p>
        </fieldset>
        <div class="ub-apptcard" aria-label="Vista previa del plan">
          <span class="ub-apptcard__avatar"><UiIcon name="tag" /></span>
          <span class="min-w-0 flex-1">
            <b class="block truncate text-sm text-ink">{{ form.nombre || "Nombre del plan" }}</b>
            <small class="block truncate text-xs text-muted">{{ form.descuento_pct || 0 }}% de descuento en servicios</small>
          </span>
          <span class="ub-apptcard__pill">${{ form.precio_mensual || 0 }}/mes</span>
        </div>
        <p v-if="createError" role="alert" class="text-sm text-danger">{{ createError }}</p>
      </form>
    </UiFormSheet>
  </div>
</template>
