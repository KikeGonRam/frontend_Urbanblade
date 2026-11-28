<script setup lang="ts">
import type { PayChoice } from '~/types/booking'

defineProps<{
  code: string
  serviceName: string | undefined
  barberName: string | undefined
  date: string
  time: string
  productsWarning: string
  paymentWarning: string
  includedInPlan?: boolean
  payChoice: PayChoice
  cancellationHours: number | null | undefined
}>()
</script>

<template>
  <section class="ui-card p-6 text-center sm:p-10">
    <BrandMascot mascot="bladebot" state="success" size="md" class="mx-auto" />
    <h1 class="mt-4 text-2xl font-black uppercase tracking-tight text-ink">
      Solicitud de cita registrada
    </h1>
    <p class="mt-2 text-sm text-muted">
      Tu código de cita es
      <strong class="font-black tracking-widest text-gold">{{ code }}</strong>
    </p>
    <dl class="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
      <div class="flex justify-between gap-4 border-b border-line pb-2">
        <dt class="text-muted">Servicio</dt>
        <dd class="text-right font-bold text-ink">{{ serviceName }}</dd>
      </div>
      <div class="flex justify-between gap-4 border-b border-line pb-2">
        <dt class="text-muted">Barbero</dt>
        <dd class="text-right font-bold text-ink">{{ barberName }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-muted">Cuándo</dt>
        <dd class="text-right font-bold text-ink">{{ bookingPrettyDate(date) }} · {{ time }}</dd>
      </div>
    </dl>
    <p v-if="productsWarning" role="alert" class="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
      Tu cita quedó confirmada, pero no pudimos agregar los productos: {{ productsWarning }}
    </p>
    <p v-if="includedInPlan" class="mt-4 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success">
      Este servicio está incluido en tu membresía: no tienes que pagarlo. El uso se descuenta al atenderte.
    </p>
    <p v-if="paymentWarning" role="alert" class="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
      Tu cita quedó confirmada, pero no pudimos procesar el pago: {{ paymentWarning }} Podrás pagar en el salón.
    </p>
    <p v-else-if="payChoice === 'ahora_tarjeta'" class="mt-4 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success">
      Pago con tarjeta procesado correctamente.
    </p>
    <p v-else-if="payChoice === 'ahora_transferencia'" class="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs text-gold">
      Recibimos tu comprobante de transferencia. Te avisaremos cuando se verifique.
    </p>
    <p v-if="cancellationHours" class="mt-6 text-xs leading-5 text-muted">
      Puedes cancelar o reprogramar hasta {{ cancellationHours }} horas antes de tu cita.
    </p>
    <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <NuxtLink to="/my/appointments" class="ui-btn px-8 py-3">Ver mis citas</NuxtLink>
      <NuxtLink to="/" class="ui-btn-secondary px-8 py-3">Volver al inicio</NuxtLink>
    </div>
  </section>
</template>
