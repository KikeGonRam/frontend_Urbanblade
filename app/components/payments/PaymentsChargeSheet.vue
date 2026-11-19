<script setup lang="ts">
import type { ChoiceOption } from "~/types/choice";
import type { LoyaltyChargeResult } from "~/utils/loyaltyCharge";
import type {
  ChargeableAppointment,
  ChargeForm,
  PaymentMethod,
  ProductoSugerido,
} from "~/types/payments";

defineProps<{
  chargeable: ChargeableAppointment[];
  selected: ChargeableAppointment | null;
  loading: boolean;
  saving: boolean;
  chargeError: string;
  preview: LoyaltyChargeResult;
  metodoOptions: ChoiceOption<PaymentMethod>[];
  tipPresets: number[];
  tipFor: (pct: number) => number;
  sugerencias: ProductoSugerido[];
  productosAgregados: string[];
  productosCount: number;
  productosTotal: number;
  total: number;
  stripeErrors: string;
  stripeProcessing: boolean;
}>();
defineEmits<{
  close: [];
  submit: [];
  "select-appointment": [];
  "pay-card": [];
  "toggle-producto": [id: string];
}>();

const form = defineModel<ChargeForm>("form", { required: true });
const cardEl = defineModel<HTMLDivElement | null>("cardEl", { required: true });
const ocultarSugerencias = defineModel<boolean>("ocultarSugerencias", { required: true });

function fmtMoney(n: number | string) {
  return formatMoney(n)
}
</script>

<template>
  <!-- Nuevo Cobro -->
  <UiFormSheet
    title="Registro de cobro"
    kicker="Pagos"
    icon="cash"
    subtitle="Elige la cita, el método de pago y confirma el cobro."
    form-id="charge-form"
    submit-label="Confirmar y cerrar servicio"
    hint="Cierra el servicio al confirmar"
    :hide-submit="loading || !selected || form.metodo === 'tarjeta'"
    :busy="saving"
    @close="$emit('close')"
  >

      <div v-if="loading" class="flex items-center gap-3 rounded-xl border border-line bg-main/50 p-4 text-sm text-muted">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden="true" />
        <span>Cargando citas por cobrar…</span>
      </div>

      <form v-else id="charge-form" class="space-y-4" @submit.prevent="$emit('submit')">
        <div v-if="!chargeable.length" class="rounded-xl border border-dashed border-line bg-main/40 p-6 text-center">
          <p class="text-sm font-bold text-ink">Por ahora no hay citas listas para cobrar</p>
          <p class="mt-1 text-xs leading-relaxed text-muted">Las citas aprobadas y pendientes de pago aparecerán aquí cuando estén disponibles.</p>
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted"
            >Seleccionar cita pendiente de cobro</label
          >
          <select
            v-model="form.appointmentId"
            required
            class="ui-input w-full"
            @change="$emit('select-appointment')"
          >
            <option value="" disabled>
              Selecciona el servicio a cobrar…
            </option>
            <option
              v-for="a in chargeable"
              :key="a.id"
              :value="a.id"
            >
              {{ a.fecha }} — {{ a.client_name }} ({{ a.service_name }})
            </option>
          </select>
        </div>

        <template v-if="selected">
          <div class="ub-apptcard">
            <span class="ub-apptcard__avatar">{{ initialsOf(selected.client_name) }}</span>
            <span class="min-w-0 flex-1">
              <b class="block truncate text-sm text-ink">{{ selected.client_name }}</b>
              <small class="block truncate text-xs text-muted">{{ selected.service_name }} · {{ selected.fecha }}</small>
            </span>
            <span class="ub-apptcard__pill">{{ selected.nivel_label }}</span>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UiFormField field-id="charge-monto" label="Monto del servicio" icon="tag">
              <input
                id="charge-monto"
                :value="fmtMoney(selected.precio)"
                aria-label="Monto del servicio"
                type="text"
                readonly
                class="ui-input w-full text-ink/70"
              >
            </UiFormField>
            <UiFormField field-id="charge-propina" label="Propina" icon="spark">
              <input
                id="charge-propina"
                v-model.number="form.propina"
                aria-label="Propina"
                type="number"
                step="0.01"
                min="0"
                class="ui-input w-full"
              >
            </UiFormField>
          </div>
          <fieldset class="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
            <legend class="sr-only">Propina rápida</legend>
            <button
              v-for="pct in tipPresets"
              :key="pct"
              type="button"
              class="ub-chip"
              :aria-pressed="form.propina === tipFor(pct)"
              @click="form.propina = tipFor(pct)"
            >
              {{ pct === 0 ? "Sin propina" : pct + "%" }}
            </button>
          </fieldset>

          <PaymentsChargeBenefits
            v-model:form="form"
            :selected="selected"
            :max-puntos-canjeables="preview.maxPuntosCanjeables"
          />

          <UiChoiceCards
            v-model="form.metodo"
            label="Método de pago"
            :options="metodoOptions"
          />

          <PaymentsChargeCardPanel
            v-model:card-el="cardEl"
            :visible="form.metodo === 'tarjeta'"
            :errors="stripeErrors"
            :processing="stripeProcessing"
            @pay="$emit('pay-card')"
          />

          <PaymentsChargeSummary
            :selected="selected"
            :form="form"
            :preview="preview"
            :productos-count="productosCount"
            :productos-total="productosTotal"
            :total="total"
          />

          <PaymentsChargeSuggestions
            v-if="!ocultarSugerencias && sugerencias.length && form.metodo !== 'tarjeta'"
            :sugerencias="sugerencias"
            :productos-agregados="productosAgregados"
            @hide="ocultarSugerencias = true"
            @toggle="$emit('toggle-producto', $event)"
          />

          <p v-if="chargeError" class="text-sm text-danger">
            {{ chargeError }}
          </p>

        </template>
      </form>
  </UiFormSheet>
</template>
