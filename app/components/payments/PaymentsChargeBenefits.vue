<script setup lang="ts">
import {
  METODO_LABEL,
  type ChargeableAppointment,
  type ChargeForm,
} from "~/types/payments";

defineProps<{
  selected: ChargeableAppointment;
  maxPuntosCanjeables: number;
}>();

const form = defineModel<ChargeForm>("form", { required: true });
</script>

<template>
  <!-- Fragmento (sin raíz única): los bloques siguen siendo hijos directos del space-y-4 del formulario -->
    <div
      v-if="selected.paquete_disponible"
      class="rounded-xl border border-info/25 bg-info/5 p-4"
    >
      <div class="flex items-start gap-3">
        <span class="min-w-0 flex-1">
          <span
            class="block text-xs font-black uppercase tracking-widest text-info"
            >{{ selected.paquete_disponible.origen === "membresia" ? "Incluido en su membresía" : "Paquete prepagado disponible" }}</span
          >
          <span class="mt-0.5 block text-xs text-ink/80"
            >Le quedan {{ selected.paquete_disponible.usos_restantes }}
            uso{{ selected.paquete_disponible.usos_restantes === 1 ? "" : "s" }}
            de este servicio</span
          >
          <span class="mt-1 block text-xs italic text-muted"
            >Cubre el 100% del servicio (no se combina con puntos ni
            gift card).</span
          >
        </span>
        <UiSwitch v-model="form.usarPaquete" :label="selected.paquete_disponible.origen === 'membresia' ? 'Usar uso de la membresía' : 'Usar paquete prepagado'" hide-label />
      </div>
    </div>

    <UiFormField
      v-if="!form.usarPremioRifa && !form.usarPaquete"
      field-id="charge-giftcard"
      label="Código de gift card (opcional)"
      icon="tag"
      :hint="`Se aplica al total antes de cobrar el resto por ${METODO_LABEL[form.metodo]?.toLowerCase()}. Si el saldo no alcanza, cubre solo una parte.`"
    >
      <input
        id="charge-giftcard"
        v-model="form.codigoGiftCard"
        aria-label="Código de gift card (opcional)"
        type="text"
        placeholder="Ej. A1B2C3D4"
        class="ui-input w-full uppercase"
      >
    </UiFormField>

    <div
      v-if="selected.premio_rifa"
      class="rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/5 p-4"
    >
      <div class="flex items-start gap-3">
        <span class="min-w-0 flex-1">
          <span
            class="block text-xs font-black uppercase tracking-widest text-fuchsia-300"
            >Premio de rifa disponible</span
          >
          <span class="mt-0.5 block text-xs text-ink/80">{{
            selected.premio_rifa
          }}</span>
          <span class="mt-1 block text-xs italic text-muted"
            >Aplica el premio como 100% de descuento (no se combina con
            puntos).</span
          >
        </span>
        <UiSwitch v-model="form.usarPremioRifa" label="Usar premio de rifa" hide-label />
      </div>
    </div>

    <div
      v-if="selected.nivel_pct > 0 || selected.puntos_disponibles > 0"
      v-show="!form.usarPremioRifa && !form.usarPaquete"
      class="space-y-3 rounded-xl border border-gold/20 bg-ink/3 p-4"
    >
      <p
        class="text-xs font-black uppercase tracking-widest text-gold"
      >
        Cliente {{ selected.nivel_label }}
        <span v-if="selected.nivel_pct > 0"
          >· {{ selected.nivel_pct }}% de descuento</span
        >
      </p>
      <div>
        <label for="cobro-puntos-canjear" class="mb-1 block text-xs text-muted"
          >Puntos a canjear (disponibles:
          {{ selected.puntos_disponibles }}, máximo:
          {{ maxPuntosCanjeables }})</label
        >
        <input
          id="cobro-puntos-canjear"
          v-model.number="form.puntosCanjear"
          type="number"
          step="1"
          min="0"
          :max="maxPuntosCanjeables"
          class="ui-input w-full"
        >
        <p class="mt-1 text-xs italic text-muted">
          1 punto = $1 MXN. Tope: 50% del total con descuento de nivel,
          o el saldo del cliente.
        </p>
      </div>
    </div>
</template>
