<script setup lang="ts">
/*
 * "Probador de estilos": el cliente elige con la vista. Lista de servicios
 * (filtrable por categoría) a la izquierda y vista grande con la foto real
 * del servicio a la derecha; el botón lleva a /reservar?servicio=<id>.
 * Usa solo las fotos que el administrador ya subió al catálogo.
 */
import { publicImageUrl } from '~/utils/publicImage'

interface LookService {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  duracion_min: number
  descripcion: string | null
  imagen: string | null
}

const props = defineProps<{ services: LookService[] }>()

const ALL = 'Todos'
const category = ref(ALL)
const categories = computed(() => {
  const set = new Set(props.services.map(s => s.categoria).filter((c): c is string => Boolean(c)))
  return set.size > 1 ? [ALL, ...set] : []
})
const visible = computed(() =>
  category.value === ALL ? props.services : props.services.filter(s => s.categoria === category.value),
)

const selectedId = ref('')
const selected = computed(() => visible.value.find(s => s.id === selectedId.value) ?? visible.value[0] ?? null)
watch(visible, () => { selectedId.value = visible.value[0]?.id ?? '' }, { immediate: true })

const broken = reactive<Record<string, boolean>>({})
const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`
</script>

<template>
  <div v-if="services.length">
    <div v-if="categories.length" class="mb-8 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Categorías de servicio">
      <button
        v-for="c in categories" :key="c" type="button" role="tab" :aria-selected="category === c"
        class="min-h-[44px] rounded-full border px-5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors"
        :class="category === c ? 'border-gold bg-gold text-black' : 'border-line text-muted hover:border-gold/50 hover:text-gold'"
        @click="category = c"
      >{{ c }}</button>
    </div>

    <div v-if="selected" class="grid items-stretch gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <div class="relative min-h-[320px] overflow-hidden rounded-3xl border border-line bg-card lg:min-h-[460px]">
        <Transition name="look-fade" mode="out-in">
          <div :key="selected.id" class="absolute inset-0">
            <img
              v-if="selected.imagen && !broken[selected.id]"
              :src="publicImageUrl(selected.imagen, 1800) ?? undefined"
              :alt="selected.nombre" class="h-full w-full object-cover" loading="lazy" decoding="async"
              @error="broken[selected.id] = true"
            >
            <div v-else class="h-full w-full bg-gradient-to-br from-gold/15 via-card to-main" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <div class="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p class="text-[10px] font-black uppercase tracking-[0.3em] text-gold">{{ selected.categoria || 'Signature' }} · {{ selected.duracion_min }} min</p>
              <h3 class="mt-2 text-3xl font-black uppercase leading-tight text-white sm:text-4xl">{{ selected.nombre }}</h3>
              <p v-if="selected.descripcion" class="mt-3 max-w-md text-sm leading-relaxed text-white/75">{{ selected.descripcion }}</p>
              <div class="mt-6 flex flex-wrap items-center gap-5">
                <span class="text-3xl font-black text-white">{{ money(selected.precio) }}</span>
                <NuxtLink :to="`/reservar?servicio=${selected.id}`" class="ui-btn min-h-[44px] px-8 py-3 text-[11px] tracking-[0.15em]">Reservar este estilo</NuxtLink>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <ul class="look-list grid max-h-[460px] content-start gap-3 overflow-y-auto" role="tablist" aria-label="Estilos">
        <li v-for="s in visible" :key="s.id">
          <button
            type="button" role="tab" :aria-selected="selected.id === s.id"
            class="group flex min-h-[64px] w-full items-center gap-4 rounded-2xl border p-3 text-left transition-all"
            :class="selected.id === s.id ? 'border-gold/60 bg-gold/10' : 'border-line bg-card hover:border-gold/30'"
            @click="selectedId = s.id"
            @mouseenter="selectedId = s.id"
          >
            <span class="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-main">
              <img v-if="s.imagen && !broken[s.id]" :src="publicImageUrl(s.imagen, 300) ?? undefined" alt="" class="h-full w-full object-cover" loading="lazy" @error="broken[s.id] = true">
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-black uppercase text-ink">{{ s.nombre }}</span>
              <span class="text-[11px] text-muted">{{ s.duracion_min }} min</span>
            </span>
            <span class="text-sm font-black text-gold">{{ money(s.precio) }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* Lista con scroll sin barra visible; el degradado inferior indica que hay más. */
.look-list {
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 3rem), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 3rem), transparent);
  padding-bottom: 2rem;
}
.look-list::-webkit-scrollbar { display: none; }
.look-fade-enter-active, .look-fade-leave-active { transition: opacity .3s ease, transform .3s ease; }
.look-fade-enter-from { opacity: 0; transform: scale(1.03); }
.look-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .look-fade-enter-active, .look-fade-leave-active { transition: none; }
}
</style>
