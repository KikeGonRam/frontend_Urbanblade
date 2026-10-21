<script setup lang="ts">
/*
 * Mini reserva del hero: servicio + barbero y salta a /reservar con los
 * query params que ya entiende booking/Wizard.vue (?servicio=&barbero=).
 * No consulta disponibilidad: eso lo sigue haciendo el wizard.
 * Los menús son propios (no <select>) para que el desplegable respete el tema.
 */
interface QuickService { id: string, nombre: string, precio: number, duracion_min: number }
interface QuickBarber { id: string, user: { name: string } | null }
interface Option { value: string, label: string, hint?: string }

const props = defineProps<{ services: QuickService[], barbers: QuickBarber[] }>()

const serviceId = ref('')
const barberId = ref('')
const open = ref<'service' | 'barber' | null>(null)
const root = ref<HTMLElement | null>(null)

const serviceOptions = computed<Option[]>(() => [
  { value: '', label: 'Cualquiera' },
  ...props.services.map(s => ({ value: s.id, label: s.nombre, hint: `$${Math.round(s.precio)}` })),
])
const barberOptions = computed<Option[]>(() => [
  { value: '', label: 'El primero disponible' },
  ...props.barbers.map(b => ({ value: b.id, label: b.user?.name ?? 'Maestro' })),
])
const labelOf = (opts: Option[], v: string) => opts.find(o => o.value === v)?.label ?? ''

function pick(kind: 'service' | 'barber', value: string) {
  if (kind === 'service') serviceId.value = value
  else barberId.value = value
  open.value = null
}

const target = computed(() => {
  const q = new URLSearchParams()
  if (serviceId.value) q.set('servicio', serviceId.value)
  if (barberId.value) q.set('barbero', barberId.value)
  const qs = q.toString()
  return qs ? `/reservar?${qs}` : '/reservar'
})
const summary = computed(() => props.services.find(s => s.id === serviceId.value))

function onDocPointer(e: Event) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = null
}
onMounted(() => document.addEventListener('pointerdown', onDocPointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer))
</script>

<template>
  <form
    ref="root"
    class="relative z-20 mx-auto mt-10 grid w-full max-w-3xl gap-3 rounded-3xl border border-gold/25 bg-main/70 p-3 text-left backdrop-blur-xl sm:grid-cols-[1fr_1fr_auto]"
    @submit.prevent="navigateTo(target)"
    @keydown.esc="open = null"
  >
    <div
v-for="field in [
      { kind: 'service' as const, title: 'Servicio', opts: serviceOptions, value: serviceId },
      { kind: 'barber' as const, title: 'Maestro', opts: barberOptions, value: barberId },
    ]" :key="field.kind" class="relative">
      <span class="mb-1 block px-3 text-[9px] font-black uppercase tracking-[0.25em] text-gold">{{ field.title }}</span>
      <button
        type="button"
        class="qb-trigger"
        :aria-expanded="open === field.kind"
        aria-haspopup="listbox"
        @click="open = open === field.kind ? null : field.kind"
      >
        <span class="truncate">{{ labelOf(field.opts, field.value) }}</span>
        <svg class="h-4 w-4 shrink-0 text-gold transition-transform" :class="{ 'rotate-180': open === field.kind }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
      </button>
      <Transition name="qb-pop">
        <ul v-if="open === field.kind" role="listbox" class="qb-panel no-scrollbar">
          <li v-for="o in field.opts" :key="o.value" role="option" :aria-selected="o.value === field.value">
            <button type="button" class="qb-option" :class="{ 'is-active': o.value === field.value }" @click="pick(field.kind, o.value)">
              <span class="truncate">{{ o.label }}</span>
              <span v-if="o.hint" class="text-gold">{{ o.hint }}</span>
            </button>
          </li>
        </ul>
      </Transition>
    </div>

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
.qb-trigger {
  display: flex;
  width: 100%;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: var(--bg-card);
  padding: 0 1rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--ink);
  transition: border-color .2s;
}
.qb-trigger:hover, .qb-trigger[aria-expanded='true'] { border-color: rgb(var(--gold-rgb) / 0.6); }
.qb-trigger:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

.qb-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 0.5rem);
  z-index: 30;
  max-height: 16rem;
  overflow-y: auto;
  border-radius: 1rem;
  border: 1px solid rgb(var(--gold-rgb) / 0.3);
  background: color-mix(in srgb, var(--bg-card) 96%, black);
  padding: 0.375rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(16px);
}
.qb-option {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 0.75rem;
  padding: 0 0.875rem;
  text-align: left;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--ink);
  transition: background-color .15s;
}
.qb-option:hover { background: rgb(var(--gold-rgb) / 0.1); }
.qb-option.is-active { background: rgb(var(--gold-rgb) / 0.16); color: var(--gold); }

.no-scrollbar { scrollbar-width: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }

.qb-pop-enter-active, .qb-pop-leave-active { transition: opacity .15s ease, transform .15s ease; }
.qb-pop-enter-from, .qb-pop-leave-to { opacity: 0; transform: translateY(-6px); }
@media (prefers-reduced-motion: reduce) {
  .qb-pop-enter-active, .qb-pop-leave-active { transition: none; }
}
</style>
