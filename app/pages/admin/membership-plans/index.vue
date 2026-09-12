<script setup lang="ts">
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

interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_mensual: number;
  descuento_pct: number;
  activo: boolean;
}

const { apiFetch } = useApi();
const { confirm } = useConfirm();

const { data: response, pending, error, refresh } = await useAsyncData(
  "admin-membership-plans",
  () => apiFetch<{ data: Plan[] }>("/admin/membership-plans"),
);
const plans = computed(() => response.value?.data ?? []);

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

const showCreate = ref(false);
const form = reactive({ nombre: "", descripcion: "", precio_mensual: 299, descuento_pct: 10 });
const createError = ref("");
const saving = ref(false);

function openCreate() {
  form.nombre = "";
  form.descripcion = "";
  form.precio_mensual = 299;
  form.descuento_pct = 10;
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
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Planes de <span class="text-gold">Membresía</span>
        </h1>
        <p class="mt-1 text-sm text-muted">Define los planes que los clientes pueden contratar.</p>
      </div>
      <button type="button" class="ui-btn" @click="openCreate">+ Nuevo plan</button>
    </header>

    <p v-if="pending" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudieron cargar los planes.</p>
    <p v-else-if="!plans.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      Todavía no hay planes de membresía.
    </p>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="plan in plans" :key="plan.id" class="ui-card p-5">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-black uppercase text-ink">{{ plan.nombre }}</h3>
          <span
            class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase"
            :class="plan.activo ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-ink/15 bg-ink/5 text-ink/50'"
          >{{ plan.activo ? "Activo" : "Desactivado" }}</span>
        </div>
        <p v-if="plan.descripcion" class="mt-1 text-xs text-muted">{{ plan.descripcion }}</p>
        <p class="mt-2 text-xl font-black text-gold">
          {{ fmtMoney(plan.precio_mensual) }}<span class="text-xs text-muted">/mes</span>
        </p>
        <p class="text-sm text-ink/80">{{ plan.descuento_pct }}% de descuento</p>
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

    <!-- Modal de creación -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-md rounded-2xl border border-line bg-card p-6">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-black uppercase text-ink">Nuevo plan</h3>
          <button type="button" class="text-sm text-muted hover:text-ink" @click="showCreate = false">✕</button>
        </div>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div>
            <label class="mb-1 block text-xs text-muted">Nombre</label>
            <input v-model="form.nombre" type="text" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Descripción (opcional)</label>
            <textarea v-model="form.descripcion" rows="2" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Precio mensual (MXN)</label>
              <input v-model.number="form.precio_mensual" type="number" min="1" step="1" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Descuento (%)</label>
              <input v-model.number="form.descuento_pct" type="number" min="1" max="100" step="1" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
          </div>
          <p v-if="createError" role="alert" class="text-sm text-red-400">{{ createError }}</p>
          <button type="submit" class="ui-btn w-full justify-center" :disabled="saving">
            {{ saving ? "Creando…" : "Crear plan" }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
