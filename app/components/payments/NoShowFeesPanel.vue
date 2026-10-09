<script setup lang="ts">
/*
 * Adeudos por inasistencia (flujo de citas V2, etapa 2). Un cliente que no llegó a su cita y al que no se le pudo cobrar
 * en su tarjeta guardada queda con un adeudo que le bloquea nuevas reservas. Recepción lo cobra aquí en sucursal
 * (efectivo o transferencia) y administración puede condonarlo con un motivo. Consume GET /no-show-fees, y
 * POST /no-show-fees/{id}/pay | waive.
 */
interface NoShowFee {
  id: string
  appointment_id: string
  cita: { code: string | null, fecha: string | null, servicio: string | null, cliente: string | null } | null
  monto: number
  monto_base: number
  credito_anticipo: number
  porcentaje: number
  estado: string
}

const { apiFetch } = useApi()
const { hasRole } = useAuth()
const { confirm } = useConfirm()

const busy = ref<string | null>(null)
const message = ref('')
const isError = ref(false)
const waiving = ref<string | null>(null)
const motivo = ref('')

const { data, pending, refresh } = await useAsyncData(
  'no-show-fees-pending',
  () => apiFetch<{ data: NoShowFee[] }>('/no-show-fees').catch(() => ({ data: [] as NoShowFee[] })),
  { lazy: true },
)
const fees = computed(() => data.value?.data ?? [])
const total = computed(() => fees.value.reduce((sum, fee) => sum + Number(fee.monto), 0))

async function pay(fee: NoShowFee, metodo: 'efectivo' | 'transferencia') {
  const ok = await confirm({
    title: 'Cobrar cargo por inasistencia',
    message: `Confirma que ${fee.cita?.cliente ?? 'el cliente'} pagó ${money(fee.monto)} en ${metodo}.`,
    confirmText: 'Sí, ya se cobró',
  })
  if (!ok) return
  busy.value = fee.id
  message.value = ''
  try {
    await apiFetch(`/no-show-fees/${fee.id}/pay`, { method: 'POST', body: { metodo } })
    isError.value = false
    message.value = 'Cargo cobrado. El cliente ya puede volver a reservar.'
    await refresh()
  } catch (err: unknown) {
    isError.value = true
    message.value = apiMessage(err, 'No se pudo registrar el cobro.')
  } finally {
    busy.value = null
  }
}

async function waive(fee: NoShowFee) {
  busy.value = fee.id
  message.value = ''
  try {
    await apiFetch(`/no-show-fees/${fee.id}/waive`, { method: 'POST', body: { motivo: motivo.value.trim() } })
    isError.value = false
    message.value = 'Cargo condonado.'
    waiving.value = null
    motivo.value = ''
    await refresh()
  } catch (err: unknown) {
    isError.value = true
    message.value = apiMessage(err, 'No se pudo condonar el cargo.')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <section class="mb-8" aria-labelledby="adeudos-titulo">
    <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id="adeudos-titulo" class="text-lg font-semibold text-ink">
          Adeudos por <span class="text-gold">inasistencia</span>
        </h2>
        <p class="text-sm text-muted">
          Clientes que no llegaron a su cita y no se les pudo cobrar a su tarjeta. No pueden reservar hasta pagar.
        </p>
      </div>
      <p v-if="fees.length" class="text-sm font-bold text-amber-300">{{ fees.length }} pendiente(s) · {{ money(total) }}</p>
    </div>

    <output v-if="message" class="mb-3 block text-sm" :class="isError ? 'text-red-400' : 'text-gold'">{{ message }}</output>
    <p v-if="pending" class="text-sm text-muted">Cargando adeudos...</p>
    <p v-else-if="!fees.length" class="ui-card p-4 text-sm text-muted">No hay adeudos pendientes.</p>

    <ul v-else class="space-y-3">
      <li v-for="fee in fees" :key="fee.id" class="ui-card p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="font-bold text-ink">{{ fee.cita?.cliente ?? 'Cliente' }}</p>
            <p class="text-xs text-muted">
              {{ fee.cita?.servicio ?? 'Servicio' }} · {{ fee.cita?.fecha ?? '' }} · {{ fee.porcentaje }}% del servicio
              <span v-if="fee.credito_anticipo > 0"> · {{ money(fee.credito_anticipo) }} ya cubiertos por pago anticipado</span>
            </p>
          </div>
          <p class="text-xl font-black text-gold">{{ money(fee.monto) }}</p>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" :disabled="busy === fee.id" class="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-50" @click="pay(fee, 'efectivo')">
            Cobrar en efectivo
          </button>
          <button type="button" :disabled="busy === fee.id" class="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50" @click="pay(fee, 'transferencia')">
            Cobrar por transferencia
          </button>
          <button v-if="hasRole('administrador') && waiving !== fee.id" type="button" class="rounded-lg border border-line px-3 py-2 text-xs text-muted hover:text-ink" @click="waiving = fee.id">
            Condonar
          </button>
        </div>

        <div v-if="waiving === fee.id" class="mt-3 space-y-2 rounded-xl border border-line p-3">
          <label :for="`motivo-${fee.id}`" class="sr-only">Motivo para condonar el cargo</label>
          <textarea :id="`motivo-${fee.id}`" v-model="motivo" rows="2" maxlength="300" placeholder="Motivo para condonar (queda registrado)…" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-xs text-ink" />
          <div class="flex gap-2">
            <button type="button" :disabled="motivo.trim().length < 3 || busy === fee.id" class="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" @click="waive(fee)">
              Confirmar condonación
            </button>
            <button type="button" class="rounded-lg border border-line px-3 py-2 text-xs text-muted" @click="waiving = null">Cancelar</button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
