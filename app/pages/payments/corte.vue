<script setup lang="ts">
/*
 * Corte de caja del día (P0-5 de urbanblade-market-web).
 *
 * El dinero del día son DOS fuentes: los cobros de citas (Payment
 * verificado) y las ventas de tienda (Order entregado), que no generan
 * Payment. El backend las suma en CashCloseService; aquí solo se muestran.
 *
 * El arqueo compara únicamente el EFECTIVO: tarjeta y transferencia no pasan
 * por el cajón físico, aunque sí cuenten en el total del día. La diferencia
 * la calcula el servidor, nunca esta pantalla.
 */
definePageMeta({ middleware: ["auth", "staff"], layout: "dashboard" });

interface Cierre {
  fecha: string;
  esperado_total: number;
  efectivo_esperado: number;
  efectivo_contado: number;
  diferencia: number;
  notas: string | null;
  cerrado_por_nombre: string | null;
}
interface Preview {
  fecha: string;
  esperado: Record<string, number>;
  esperado_total: number;
  efectivo_esperado: number;
  propinas: number;
  pagos: number;
  pedidos: number;
  cierre: Cierre | null;
}

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  desconocido: "Sin método",
};

const { apiFetch } = useApi();

function hoyLocal() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const fecha = ref(hoyLocal());

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData(
  "cash-close-preview",
  () =>
    apiFetch<{ data: Preview }>("/cash-closes/preview", {
      query: { date: fecha.value },
    }),
  { watch: [fecha] },
);
const preview = computed(() => response.value?.data ?? null);
const cierre = computed(() => preview.value?.cierre ?? null);

const metodos = computed(() =>
  Object.entries(preview.value?.esperado ?? {}).map(([key, monto]) => ({
    key,
    label: METODO_LABEL[key] ?? key,
    monto,
  })),
);

// ── Arqueo ────────────────────────────────────────────────────────────────
const contado = ref<number | null>(null);
const notas = ref("");
const saving = ref(false);
const saveError = ref("");

// Anticipo local de la diferencia, solo para que el usuario vea a dónde va
// antes de confirmar. El valor que queda guardado es el que calcula el
// servidor en CashCloseController::store().
const diferenciaPreview = computed(() => {
  if (contado.value === null || !preview.value) return null;

  return Number((contado.value - preview.value.efectivo_esperado).toFixed(2));
});

async function cerrarCaja() {
  if (contado.value === null) return;
  saving.value = true;
  saveError.value = "";
  try {
    await apiFetch("/cash-closes", {
      method: "POST",
      body: {
        date: fecha.value,
        efectivo_contado: contado.value,
        notas: notas.value.trim() || null,
      },
    });
    contado.value = null;
    notas.value = "";
    await refresh();
  } catch (err: unknown) {
    saveError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo registrar el corte.";
  } finally {
    saving.value = false;
  }
}

// El signo va ANTES del símbolo: un faltante es "-$60.00", no "$-60.00".
// Aquí importa de verdad porque la diferencia del arqueo es negativa siempre
// que falte dinero en el cajón.
function money(n: number | null | undefined) {
  const valor = Number(n ?? 0);
  const monto = Math.abs(valor).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${valor < 0 ? "-" : ""}$${monto}`;
}
</script>

<template>
  <main class="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <NuxtLink
          to="/payments"
          class="text-xs font-bold uppercase tracking-widest text-muted transition-colors hover:text-gold"
        >
          ← Volver a pagos
        </NuxtLink>
        <h1 class="mt-2 text-2xl font-black text-ink">Corte de caja</h1>
        <p class="mt-1 text-sm text-muted">
          Cobros de citas y ventas de tienda realmente recibidos en el día.
        </p>
      </div>
      <label class="text-xs font-bold uppercase tracking-widest text-muted">
        <span class="mb-1 block">Fecha</span>
        <input
          v-model="fecha"
          type="date"
          class="rounded-xl border border-line bg-main px-3 py-2 text-sm text-ink"
        >
      </label>
    </header>

    <BrandStatePanel
      v-if="pending"
      mascot="bladebot"
      state="waiting"
      title="Calculando el corte…"
    />
    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo calcular el corte"
      description="Revisa tu conexión e inténtalo nuevamente."
    />

    <template v-else-if="preview">
      <!-- Desglose -->
      <section class="ui-card p-5">
        <h2 class="text-sm font-black uppercase tracking-widest text-ink">
          Esperado del día
        </h2>
        <p class="mt-1 text-xs text-muted">
          {{ preview.pagos }} cobro(s) de cita y {{ preview.pedidos }} pedido(s) entregado(s).
        </p>

        <BrandStatePanel
          v-if="!metodos.length"
          class="mt-4"
          mascot="nava"
          state="empty"
          title="Sin movimientos ese día"
          description="Cuando se registre un cobro o se entregue un pedido aparecerá aquí."
        />
        <dl v-else class="mt-4 space-y-2 text-sm">
          <div
            v-for="metodo in metodos"
            :key="metodo.key"
            class="flex justify-between border-b border-line/60 pb-2"
          >
            <dt class="text-muted">{{ metodo.label }}</dt>
            <dd class="font-bold text-ink">{{ money(metodo.monto) }}</dd>
          </div>
          <div v-if="preview.propinas > 0" class="flex justify-between text-xs">
            <dt class="text-muted">Incluye propinas</dt>
            <dd class="text-muted">{{ money(preview.propinas) }}</dd>
          </div>
          <div class="flex justify-between pt-2">
            <dt class="font-black uppercase tracking-widest text-ink">Total</dt>
            <dd class="text-lg font-black text-gold">{{ money(preview.esperado_total) }}</dd>
          </div>
        </dl>
      </section>

      <!-- Corte ya registrado -->
      <section v-if="cierre" class="ui-card p-5">
        <h2 class="text-sm font-black uppercase tracking-widest text-ink">
          Caja cerrada
        </h2>
        <dl class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-muted">Efectivo esperado</dt>
            <dd class="font-bold text-ink">{{ money(cierre.efectivo_esperado) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">Efectivo contado</dt>
            <dd class="font-bold text-ink">{{ money(cierre.efectivo_contado) }}</dd>
          </div>
          <div class="flex justify-between border-t border-line pt-2">
            <dt class="font-black uppercase tracking-widest text-ink">Diferencia</dt>
            <dd
              class="text-lg font-black"
              :class="cierre.diferencia === 0 ? 'text-emerald-400' : 'text-red-400'"
            >
              {{ cierre.diferencia > 0 ? "+" : "" }}{{ money(cierre.diferencia) }}
            </dd>
          </div>
        </dl>
        <p v-if="cierre.notas" class="mt-3 text-xs leading-5 text-muted">{{ cierre.notas }}</p>
        <p v-if="cierre.cerrado_por_nombre" class="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted">
          Cerró {{ cierre.cerrado_por_nombre }}
        </p>
      </section>

      <!-- Arqueo pendiente -->
      <section v-else class="ui-card p-5">
        <h2 class="text-sm font-black uppercase tracking-widest text-ink">
          Arqueo de efectivo
        </h2>
        <p class="mt-1 text-xs text-muted">
          Solo se cuenta el efectivo: tarjeta y transferencia no pasan por el cajón.
          Esperado en caja: <strong class="text-ink">{{ money(preview.efectivo_esperado) }}</strong>
        </p>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
              Efectivo contado
            </span>
            <input
              v-model.number="contado"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              class="w-full rounded-xl border border-line bg-main p-3 text-sm text-ink"
              placeholder="0.00"
            >
          </label>
          <div class="rounded-xl border border-dashed border-line p-3">
            <span class="block text-[10px] font-bold uppercase tracking-widest text-muted">
              Diferencia
            </span>
            <span
              v-if="diferenciaPreview !== null"
              class="mt-1 block text-xl font-black"
              :class="diferenciaPreview === 0 ? 'text-emerald-400' : 'text-red-400'"
            >
              {{ diferenciaPreview > 0 ? "+" : "" }}{{ money(diferenciaPreview) }}
            </span>
            <span v-else class="mt-1 block text-sm text-muted">Captura el efectivo contado</span>
          </div>
        </div>

        <label class="mt-4 block">
          <span class="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">
            Observaciones
          </span>
          <textarea
            v-model="notas"
            rows="2"
            maxlength="1000"
            class="w-full rounded-xl border border-line bg-main p-3 text-sm text-ink"
            placeholder="Ej. Faltante por cambio de un billete."
          />
        </label>

        <p v-if="saveError" role="alert" class="mt-3 text-sm font-bold text-red-400">
          {{ saveError }}
        </p>

        <button
          type="button"
          class="ui-btn mt-4 min-h-11 w-full py-3 text-[11px] tracking-widest disabled:opacity-50 sm:w-auto sm:px-8"
          :disabled="saving || contado === null"
          @click="cerrarCaja"
        >
          {{ saving ? "Registrando…" : "Cerrar caja del día" }}
        </button>
      </section>
    </template>
  </main>
</template>
