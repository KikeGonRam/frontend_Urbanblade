<script setup lang="ts">
/*
 * Ticket del servicio terminado (GET /appointments/{cita}/ticket o el `ticket` de la respuesta de «completada»).
 * Lo ven el barbero al terminar y el cliente en su historial. El PDF (comprobante) se abre en otra pestaña.
 */
defineProps<{ ticket: ServiceTicket }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <UiModal title="Ticket del servicio" @close="$emit('close')">
    <div class="mx-auto max-w-md space-y-4">
      <div class="text-center">
        <p class="text-[10px] font-black uppercase tracking-[0.3em] text-gold">Servicio terminado</p>
        <p class="mt-1 text-sm text-muted">Folio {{ ticket.folio }}<span v-if="ticket.fecha"> · {{ ticket.fecha }}</span></p>
      </div>

      <dl class="space-y-2 rounded-xl border border-line p-4 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Cliente</dt>
          <dd class="text-right font-semibold text-ink">{{ ticket.cliente ?? '—' }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Barbero</dt>
          <dd class="text-right font-semibold text-ink">{{ ticket.barbero ?? '—' }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Servicio</dt>
          <dd class="text-right font-semibold text-ink">{{ ticket.servicio ?? '—' }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Duración</dt>
          <dd class="text-right text-ink">
            {{ ticket.duracion_min }} min<span v-if="ticket.minutos_extra > 0"> + {{ ticket.minutos_extra }} extra</span>
          </dd>
        </div>
      </dl>

      <dl class="space-y-2 rounded-xl border border-line p-4 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Precio del servicio</dt>
          <dd class="text-ink">{{ money(ticket.precio_servicio) }}</dd>
        </div>
        <div v-if="ticket.descuentos > 0" class="flex justify-between gap-4">
          <dt class="text-muted">Descuentos</dt>
          <dd class="text-emerald-300">−{{ money(ticket.descuentos) }}</dd>
        </div>
        <div v-if="ticket.deposito_aplicado > 0" class="flex justify-between gap-4">
          <dt class="text-muted">Pagado al reservar</dt>
          <dd class="text-ink">{{ money(ticket.deposito_aplicado) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Cobro ({{ ticket.metodo_pago ?? '—' }})</dt>
          <dd class="text-ink">{{ money(ticket.monto) }}</dd>
        </div>
        <div v-if="ticket.propina > 0" class="flex justify-between gap-4">
          <dt class="text-muted">Propina</dt>
          <dd class="text-ink">{{ money(ticket.propina) }}</dd>
        </div>
        <div class="flex justify-between gap-4 border-t border-line pt-2 text-base font-black">
          <dt class="text-ink">Total pagado</dt>
          <dd class="text-gold">{{ money(ticket.total_pagado) }}</dd>
        </div>
      </dl>

      <a
        v-if="ticket.comprobante_url"
        :href="ticket.comprobante_url"
        target="_blank"
        rel="noopener"
        class="ui-btn block w-full px-6 py-3 text-center"
      >
        Ver comprobante (PDF)
      </a>
      <p class="text-center text-xs text-muted">También lo enviamos al correo del cliente con su factura.</p>
    </div>
  </UiModal>
</template>
