<script setup lang="ts">
import type { ChargeableAppointment, ChargeForm } from "~/types/payments";
import type { LoyaltyChargeResult } from "~/utils/loyaltyCharge";

defineProps<{
  selected: ChargeableAppointment;
  form: ChargeForm;
  preview: LoyaltyChargeResult;
  productosCount: number;
  productosTotal: number;
  total: number;
}>();

function fmtMoney(n: number | string) {
  return formatMoney(n)
}
</script>

<template>
  <div class="rounded-xl border border-gold/30 bg-black/20 p-5">
    <div class="space-y-2 text-sm">
      <div class="flex justify-between">
        <span class="text-xs font-bold uppercase text-muted"
          >Subtotal</span
        ><span class="text-ink">{{ fmtMoney(selected.precio) }}</span>
      </div>
      <div v-if="form.usarPremioRifa" class="flex justify-between">
        <span class="text-xs font-bold uppercase text-muted"
          >Premio de rifa</span
        ><span class="text-fuchsia-400"
          >-{{ fmtMoney(selected.precio) }}</span
        >
      </div>
      <div v-else-if="form.usarPaquete" class="flex justify-between">
        <span class="text-xs font-bold uppercase text-muted"
          >{{ selected.paquete_disponible?.origen === "membresia" ? "Incluido en su membresía" : "Paquete prepagado" }}</span
        ><span class="text-info"
          >-{{ fmtMoney(selected.precio) }}</span
        >
      </div>
      <div
        v-else-if="selected.nivel_pct > 0"
        class="flex justify-between"
      >
        <span class="text-xs font-bold uppercase text-muted"
          >Descuento nivel ({{ selected.nivel_pct }}%)</span
        ><span class="text-success"
          >-{{
            fmtMoney(selected.precio - preview.montoConNivel)
          }}</span
        >
      </div>
      <div
        v-if="preview.descuentoPuntos > 0"
        class="flex justify-between"
      >
        <span class="text-xs font-bold uppercase text-muted"
          >Puntos canjeados</span
        ><span class="text-success"
          >-{{ fmtMoney(preview.descuentoPuntos) }}</span
        >
      </div>
      <div class="flex justify-between">
        <span class="text-xs font-bold uppercase text-muted"
          >Propina</span
        ><span class="text-gold">{{ fmtMoney(form.propina) }}</span>
      </div>
      <div
        v-if="productosCount"
        class="flex justify-between"
      >
        <span class="text-xs font-bold uppercase text-muted"
          >Productos</span
        ><span class="tabular-nums text-ink">{{
          fmtMoney(productosTotal)
        }}</span>
      </div>
      <div class="my-2 border-t border-line" />
      <div class="flex justify-between">
        <span class="text-xs font-black uppercase text-ink"
          >Total a pagar</span
        ><span class="text-xl font-black tabular-nums text-gold">{{
          fmtMoney(total)
        }}</span>
      </div>
    </div>
  </div>
</template>
