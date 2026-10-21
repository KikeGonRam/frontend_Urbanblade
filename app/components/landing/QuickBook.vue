<script setup lang="ts">
/*
 * Mini reserva del hero: servicio + barbero y salta a /reservar con los
 * query params que ya entiende booking/Wizard.vue (?servicio=&barbero=).
 * No consulta disponibilidad: eso lo sigue haciendo el wizard.
 */
interface QuickService { id: string, nombre: string, precio: number, duracion_min: number }
interface QuickBarber { id: string, user: { name: string } | null }

const props = defineProps<{ services: QuickService[], barbers: QuickBarber[] }>()

const serviceId = ref('')
const barberId = ref('')

const target = computed(() => {
  const q = new URLSearchParams()
  if (serviceId.value) q.set('servicio', serviceId.value)
  if (barberId.value) q.set('barbero', barberId.value)
  const qs = q.toString()
  return qs ? `/reservar?${qs}` : '/reservar'
})
const summary = computed(() => props.services.find(s => s.id === serviceId.value))
</script>

<template>
  <form class="mx-auto mt-10 grid w-full max-w-3xl gap-3 rounded-3xl border border-gold/25 bg-main/70 p-3 text-left backdrop-blur-xl sm:grid-cols-[1fr_1fr_auto]" @submit.prevent="navigateTo(target)">
    <label class="block">
      <span class="mb-1 block px-3 text-[9px] font-black uppercase tracking-[0.25em] text-gold">Servicio</span>
      <select v-model="serviceId" class="qb-field">
        <option value="">Cualquiera</option>
        <option v-for="s in services" :key="s.id" :value="s.id">{{ s.nombre }} · ${{ Math.round(s.precio) }}</option>
      </select>
    </label>
    <label class="block">
      <span class="mb-1 block px-3 text-[9px] font-black uppercase tracking-[0.25em] text-gold">Maestro</span>
      <select v-model="barberId" class="qb-field">
        <option value="">El primero disponible</option>
        <option v-for="b in barbers" :key="b.id" :value="b.id">{{ b.user?.name }}</option>
      </select>
    </label>
    <button type="submit" class="ui-btn min-h-[52px] self-end px-8 text-[12px] tracking-[0.15em]">
      Ver horarios
      <svg class="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
    </button>
    <p v-if="summary" class="px-3 text-[11px] text-muted sm:col-span-3">
      {{ summary.nombre }}: {{ summary.duracion_min }} min · ${{ Math.round(summary.precio) }} MXN
    </p>
  </form>
</template>

<style scoped>
.qb-field {
  width: 100%;
  min-height: 48px;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: var(--bg-card);
  padding: 0 1rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--ink);
}
.qb-field:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
</style>
