<script setup lang="ts">
/*
 * Selector de rango de fechas con atajos (auditoría UI/UX A-07). Antes cada filtro ponía dos campos `dd/mm/aaaa`
 * del navegador, sin atajos ni estilo propio. Aquí van los dos campos con el aspecto del sistema y los atajos
 * más usados («Hoy», «7 días», «Este mes»). El campo sigue siendo nativo (teclado, móvil y lectores funcionan).
 */
import { ordenarRango, rangoPreset, type RangoPreset } from '~/utils/dateRange'

const desde = defineModel<string>('from', { default: '' })
const hasta = defineModel<string>('to', { default: '' })

withDefaults(defineProps<{ fromLabel?: string, toLabel?: string }>(), { fromLabel: 'Fecha desde', toLabel: 'Fecha hasta' })

const PRESETS: { id: RangoPreset, label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7dias', label: '7 días' },
  { id: 'mes', label: 'Este mes' },
]

const activo = computed(() => PRESETS.find((p) => {
  const r = rangoPreset(p.id)

  return r.desde === desde.value && r.hasta === hasta.value
})?.id ?? null)

function aplicar(id: RangoPreset) {
  const r = rangoPreset(id)
  desde.value = r.desde
  hasta.value = r.hasta
}

// Si el rango queda invertido se intercambian los extremos en lugar de dejar un filtro que no devuelve nada.
function normalizar() {
  const r = ordenarRango(desde.value, hasta.value)
  if (r.desde !== desde.value) desde.value = r.desde
  if (r.hasta !== hasta.value) hasta.value = r.hasta
}

const CAMPO = 'ub-date-input min-h-10 rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold'
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Rango de fechas">
    <div class="flex items-center gap-1" role="group" aria-label="Atajos de fecha">
      <button
        v-for="p in PRESETS"
        :key="p.id"
        type="button"
        class="min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        :class="activo === p.id ? 'border-gold bg-gold/15 text-gold' : 'border-line text-muted hover:text-ink'"
        :aria-pressed="activo === p.id"
        @click="aplicar(p.id)"
      >
        {{ p.label }}
      </button>
    </div>
    <input v-model="desde" type="date" :aria-label="fromLabel" :class="CAMPO" :max="hasta || undefined" @change="normalizar">
    <span class="text-xs text-muted" aria-hidden="true">a</span>
    <input v-model="hasta" type="date" :aria-label="toLabel" :class="CAMPO" :min="desde || undefined" @change="normalizar">
  </div>
</template>

<style>
/* Campos de fecha con el tema oscuro del sistema (icono del calendario y menú del navegador). */
.ub-date-input { color-scheme: dark; }
</style>
