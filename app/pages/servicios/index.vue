<script setup lang="ts">
/*
 * Catálogo público de servicios -- puerto de barber's /servicios
 * (Client\ServiceController::publicIndex(), Blade). Consume el mismo
 * endpoint público que ya usa la landing (CatalogController::services()),
 * sin necesidad de cambios de backend. Sin middleware: cualquier visitante,
 * con o sin sesión, puede verlo.
 */
definePageMeta({ layout: 'public' })

useSeoMeta({
  title: 'Servicios — UrbanBlade',
  description: 'Catálogo de cortes, barba y grooming de estudio en UrbanBlade.',
})

interface ServiceRow {
  id: string
  nombre: string
  categoria: string | null
  precio: number
  duracion_min: number
  descripcion: string | null
  imagen: string | null
}

const { isAuthenticated } = useAuth()
const { apiFetch } = useApi()

const { data: response, pending, error } = await useAsyncData(
  'public-services-catalog',
  () => apiFetch<{ data: ServiceRow[] }>('/services'),
)
const services = computed(() => response.value?.data ?? [])

const categoria = ref('')
const categories = computed(() => Array.from(new Set(services.value.map(s => s.categoria).filter(Boolean))) as string[])
const filtered = computed(() => categoria.value ? services.value.filter(s => s.categoria === categoria.value) : services.value)

function currency(n: number) {
  return `$${Math.round(n).toLocaleString('es-MX')}`
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
    <header class="mb-12 text-center">
      <p class="mb-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-gold">
        <span class="inline-block h-px w-8 bg-gold" />
        Catálogo
        <span class="inline-block h-px w-8 bg-gold" />
      </p>
      <h1 class="text-4xl font-black uppercase tracking-tight text-ink">Nuestros <span class="text-gold">Servicios</span></h1>
      <p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">Maestría artesanal aplicada a cada uno de nuestros tratamientos exclusivos.</p>
    </header>

    <div v-if="categories.length > 1" class="mb-8 flex flex-wrap justify-center gap-2">
      <button
        type="button"
        class="rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition"
        :class="!categoria ? 'border-gold bg-gold text-black' : 'border-line text-muted hover:border-gold/40 hover:text-ink'"
        @click="categoria = ''"
      >
        Todos
      </button>
      <button
        v-for="c in categories" :key="c" type="button"
        class="rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition"
        :class="categoria === c ? 'border-gold bg-gold text-black' : 'border-line text-muted hover:border-gold/40 hover:text-ink'"
        @click="categoria = c"
      >
        {{ c }}
      </button>
    </div>

    <BrandStatePanel v-if="pending" mascot="bladebot" state="waiting" title="Cargando catálogo…" />
    <BrandStatePanel v-else-if="error" mascot="bruno" state="error" tone="danger" title="No se pudo cargar el catálogo" description="Inténtalo nuevamente en unos minutos." />
    <BrandStatePanel v-else-if="!filtered.length" mascot="nava" state="empty" title="No hay servicios disponibles" description="Vuelve pronto para conocer nuestros próximos servicios." />

    <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <article v-for="service in filtered" :key="service.id" class="ui-card-premium group p-8 hover:border-gold/40">
        <img
          v-if="service.imagen" :src="service.imagen" :alt="service.nombre"
          class="mb-6 h-40 w-full rounded-xl object-cover"
        >
        <div v-else class="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/10 bg-gold/5 text-gold">
          <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.196 1.024M9.384 9.137l2.077 1.199M13.5 15.75l1.83 1.83a3 3 0 006.086-1.803L21 15.75m-6.5-4.5l-3.83-2.212M7.848 15.75l1.536-.887M7.848 15.75a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.839 4.166 4.166 0 01.196-1.024M9.384 14.863l7.632-4.406M18.75 4.5l-2.928 1.69" />
          </svg>
        </div>
        <p v-if="service.categoria" class="mb-1 text-[10px] font-black uppercase tracking-widest text-gold">{{ service.categoria }}</p>
        <h3 class="text-xl font-black uppercase text-ink">{{ service.nombre }}</h3>
        <p class="mt-3 text-sm leading-relaxed text-muted">{{ service.descripcion || 'Una experiencia diseñada para resaltar tu mejor versión con técnica clásica.' }}</p>
        <div class="mt-6 flex items-center justify-between">
          <span class="text-2xl font-black text-ink">{{ currency(service.precio) }}</span>
          <span class="rounded-full border border-gold/10 bg-gold/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gold">{{ service.duracion_min }} min</span>
        </div>
        <!-- Enlace profundo a /reservar con este servicio ya elegido: el
             catálogo público es una de las entradas típicas desde redes/QR. -->
        <NuxtLink
          :to="`/reservar?servicio=${service.id}`"
          class="ui-btn mt-6 flex w-full justify-center py-3 text-[11px] tracking-[0.15em]"
          :aria-label="`Reservar ${service.nombre}`"
        >
          Reservar
        </NuxtLink>
      </article>
    </div>

    <div class="mt-16 text-center">
      <NuxtLink :to="isAuthenticated ? '/my/appointments' : '/register'" class="ui-btn px-10 py-4 text-[11px] tracking-[0.2em]">
        {{ isAuthenticated ? 'Reservar cita' : 'Regístrate para reservar' }} &rarr;
      </NuxtLink>
    </div>
  </div>
</template>
