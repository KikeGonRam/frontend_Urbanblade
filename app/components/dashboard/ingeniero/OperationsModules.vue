<script setup lang="ts">
import type { IngenieroData } from "~/types/dashboard";
import { useEngineerModuleTelemetry } from "~/composables/useEngineerModuleTelemetry";
import { fmtInt, fmtMoney } from "~/utils/chartTheme";

const props = defineProps<{ data: IngenieroData }>();

const { moduleTelemetry } = useEngineerModuleTelemetry(() => props.data);
</script>

<template>
  <!-- Cobertura agregada de módulos operativos, sin abrir sus pantallas ni datos individuales. -->
  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-ink">Pagos</h3>
      </div>
      <span
        class="rounded-full border px-2 py-1 text-xs font-black uppercase"
        :class="
          moduleTelemetry.payments.pending > 0
            ? 'border-warning/25 bg-warning/[0.06] text-warning'
            : 'border-success/25 bg-success/[0.06] text-success'
        "
        >{{
          moduleTelemetry.payments.pending > 0 ? "Revisión" : "Al día"
        }}</span
      >
    </div>
    <p class="text-2xl font-semibold text-ink">
      {{ fmtMoney(moduleTelemetry.payments.amount) }}
    </p>
    <p class="text-xs font-black uppercase tracking-widest text-ink/45">
      recaudado en la ventana
    </p>
    <div class="mt-4 grid grid-cols-3 gap-2 text-center">
      <div class="rounded-lg bg-ink/[0.03] p-2">
        <p class="text-sm font-black text-success">
          {{ moduleTelemetry.payments.verified }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">
          Verificados
        </p>
      </div>
      <div class="rounded-lg bg-ink/[0.03] p-2">
        <p class="text-sm font-black text-warning">
          {{ moduleTelemetry.payments.pending }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">
          Pendientes
        </p>
      </div>
      <div class="rounded-lg bg-ink/[0.03] p-2">
        <p class="text-sm font-black text-danger">
          {{ moduleTelemetry.payments.rejected }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">
          Rechazados
        </p>
      </div>
    </div>
  </div>

  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-ink">Pedidos</h3>
      </div>
      <span
        class="rounded-full border px-2 py-1 text-xs font-black uppercase"
        :class="
          moduleTelemetry.orders.pending > 0
            ? 'border-warning/25 bg-warning/[0.06] text-warning'
            : 'border-success/25 bg-success/[0.06] text-success'
        "
        >{{ moduleTelemetry.orders.pending }} en espera</span
      >
    </div>
    <div class="grid grid-cols-3 gap-3 text-center">
      <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
        <p class="text-lg font-semibold text-warning">
          {{ moduleTelemetry.orders.pending }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">
          Pendientes
        </p>
      </div>
      <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
        <p class="text-lg font-semibold text-ink">
          {{ moduleTelemetry.orders.delivered }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">
          Entregados
        </p>
      </div>
      <div class="rounded-xl border border-ink/[0.05] bg-ink/[0.02] p-3">
        <p class="text-lg font-semibold text-danger">
          {{ moduleTelemetry.orders.cancelled }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">
          Cancelados
        </p>
      </div>
    </div>
  </div>

  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-ink">Campañas</h3>
      </div>
      <span class="text-xs font-black uppercase text-ink/40"
        >{{ moduleTelemetry.campaigns.scheduled }} programadas</span
      >
    </div>
    <div class="grid grid-cols-3 gap-2 text-center">
      <div class="rounded-lg bg-ink/[0.03] p-2">
        <p class="text-base font-semibold text-ink">
          {{ moduleTelemetry.campaigns.sent }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">Enviadas</p>
      </div>
      <div class="rounded-lg bg-ink/[0.03] p-2">
        <p class="text-base font-semibold text-ink">
          {{ moduleTelemetry.campaigns.opens }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">Aperturas</p>
      </div>
      <div class="rounded-lg bg-ink/[0.03] p-2">
        <p class="text-base font-semibold text-ink">
          {{ moduleTelemetry.campaigns.clicks }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">Clics</p>
      </div>
    </div>
    <p class="mt-3 text-xs text-ink/50">
      {{ fmtInt(moduleTelemetry.campaigns.recipients) }} destinatarios
      acumulados en la ventana.
    </p>
  </div>

  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4">
      <h3 class="text-base font-semibold text-ink">Sorteos</h3>
    </div>
    <div class="grid grid-cols-3 gap-2 text-center">
      <div class="rounded-lg bg-ink/[0.03] p-2">
        <p class="text-base font-semibold text-ink">
          {{ moduleTelemetry.raffles.redeemable }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">Vigentes</p>
      </div>
      <div class="rounded-lg bg-ink/[0.03] p-2">
        <p class="text-base font-semibold text-ink">
          {{ moduleTelemetry.raffles.claimed }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">Canjeados</p>
      </div>
      <div class="rounded-lg bg-ink/[0.03] p-2">
        <p class="text-base font-semibold text-danger">
          {{ moduleTelemetry.raffles.expired }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">Vencidos</p>
      </div>
    </div>
  </div>

  <div class="ub-rise rounded-2xl border border-line bg-card p-5">
    <div class="mb-4">
      <h3 class="text-base font-semibold text-ink">Muro</h3>
      <p class="mt-0.5 text-sm text-muted">Telemetría social</p>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div class="rounded-lg bg-ink/[0.03] p-2.5">
        <p class="text-base font-semibold text-ink">
          {{ moduleTelemetry.social.works }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">
          Publicaciones
        </p>
      </div>
      <div class="rounded-lg bg-ink/[0.03] p-2.5">
        <p class="text-base font-semibold text-ink">
          {{ moduleTelemetry.social.reactions }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">
          Reacciones
        </p>
      </div>
      <div class="rounded-lg bg-ink/[0.03] p-2.5">
        <p class="text-base font-semibold text-ink">
          {{ moduleTelemetry.social.comments }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">
          Comentarios
        </p>
      </div>
      <div class="rounded-lg bg-ink/[0.03] p-2.5">
        <p class="text-base font-semibold text-ink">
          {{ moduleTelemetry.social.saves }}
        </p>
        <p class="text-xs font-black uppercase text-ink/45">Guardados</p>
      </div>
    </div>
    <p class="mt-3 text-xs leading-relaxed text-ink/50">
      Sólo comportamiento agregado; el feed y sus acciones siguen fuera de
      este rol.
    </p>
  </div>
</template>
