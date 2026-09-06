<script setup lang="ts">
/*
 * Fase 9.6 del plan (ver .claude/skills/nuxt-migration-plan/SKILL.md) —
 * catálogo de servicios, admin-only. Construida contra
 * Api/Service/ServiceManagementController, enriquecido en esta misma fase
 * con el filtro `q` e `imagen_url`/`slug`.
 */
definePageMeta({ middleware: ['auth', 'admin'], layout: 'dashboard' })

interface ServiceRow {
  id: string
  slug: string | null
  nombre: string
  categoria: string | null
  descripcion: string | null
  precio: number
  duracion_min: number
  imagen: string | null
  imagen_url: string | null
  activo: boolean
}

interface ServicesResponse {
  data: ServiceRow[]
  meta: { current_page: number, last_page: number, total: number }
  categories: string[]
}

const { apiFetch } = useApi()

const search = ref('')
const categoria = ref('')
const activo = ref('')

const { data: response, pending, error, refresh } = await useAsyncData<ServicesResponse>(
  'services-list',
  () => apiFetch<ServicesResponse>('/services/manage', {
    query: { q: search.value || undefined, categoria: categoria.value || undefined, activo: activo.value || undefined },
  }),
  { watch: [search, categoria, activo] },
)
const services = computed(() => response.value?.data ?? [])
const categories = computed(() => response.value?.categories ?? [])

function clearFilters() {
  search.value = ''
  categoria.value = ''
  activo.value = ''
}

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(0)}`
}

// ── Crear / editar ───────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<ServiceRow | null>(null)
const form = reactive({ nombre: '', categoria: '', precio: 0, duracion_min: 30, descripcion: '', activo: true })
const formError = ref('')
const saving = ref(false)

function openCreate() {
  editing.value = null
  form.nombre = ''
  form.categoria = ''
  form.precio = 0
  form.duracion_min = 30
  form.descripcion = ''
  form.activo = true
  formError.value = ''
  showForm.value = true
}

function openEdit(service: ServiceRow) {
  editing.value = service
  form.nombre = service.nombre
  form.categoria = service.categoria ?? ''
  form.precio = service.precio
  form.duracion_min = service.duracion_min
  form.descripcion = service.descripcion ?? ''
  form.activo = service.activo
  formError.value = ''
  showForm.value = true
}

async function submitForm() {
  saving.value = true
  formError.value = ''
  try {
    if (editing.value) {
      // Service usa HasSlug -> getRouteKeyName() = 'slug', no 'id' (ver
      // guardrail #20 de barber — mismo gotcha que Client/Barber en 9.1).
      await apiFetch(`/services/manage/${editing.value.slug}`, { method: 'PUT', body: form })
    } else {
      await apiFetch('/services/manage', { method: 'POST', body: form })
    }
    showForm.value = false
    await refresh()
  } catch (err: unknown) {
    formError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo guardar. Verifica los datos.'
  } finally {
    saving.value = false
  }
}

async function removeService(service: ServiceRow) {
  if (!confirm(`¿Eliminar ${service.nombre}?`)) return

  try {
    await apiFetch(`/services/manage/${service.slug}`, { method: 'DELETE' })
    await refresh()
  } catch (err: unknown) {
    alert((err as { data?: { message?: string } })?.data?.message ?? 'No se pudo eliminar el servicio.')
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Catálogo de <span class="text-gold">Servicios</span></h1>
        <p class="mt-1 text-sm text-muted">Servicios ofrecidos por la barbería.</p>
      </div>
      <button type="button" class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim" @click="openCreate">
        + Nuevo Servicio
      </button>
    </header>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <input v-model="search" type="text" placeholder="Nombre del servicio…" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink sm:max-w-xs">
      <select v-model="categoria" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todas las categorías</option>
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="activo" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todos los estados</option>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button v-if="search || categoria || activo" type="button" class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink" @click="clearFilters">
        Limpiar filtros
      </button>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando servicios…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar el catálogo.</p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th class="px-4 py-3">Servicio</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3">Duración</th>
            <th class="px-4 py-3 text-right">Precio</th>
            <th class="px-4 py-3 text-center">Estado</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="service in services" :key="service.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5">
                  <img v-if="service.imagen_url" :src="service.imagen_url" :alt="service.nombre" class="h-full w-full object-cover">
                  <span v-else class="text-lg text-ink/15">✂</span>
                </div>
                <p class="font-bold text-ink">{{ service.nombre }}</p>
              </div>
            </td>
            <td class="px-4 py-3">
              <span class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-[9px] font-black uppercase text-muted">{{ service.categoria }}</span>
            </td>
            <td class="px-4 py-3 text-muted">{{ service.duracion_min }} min</td>
            <td class="px-4 py-3 text-right font-black text-emerald-400">{{ fmtMoney(service.precio) }}</td>
            <td class="px-4 py-3 text-center">
              <span class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase" :class="service.activo ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-line bg-ink/5 text-muted'">
                {{ service.activo ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div v-if="service.slug" class="flex justify-end gap-2">
                <button type="button" class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink" @click="openEdit(service)">Editar</button>
                <button type="button" class="rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10" @click="removeService(service)">Eliminar</button>
              </div>
            </td>
          </tr>
          <tr v-if="!services.length">
            <td colspan="6" class="px-4 py-12 text-center text-sm text-muted">Sin servicios.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="showForm = false">
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6">
        <h2 class="mb-4 text-lg font-semibold text-ink">{{ editing ? 'Editar servicio' : 'Nuevo servicio' }}</h2>
        <form class="space-y-3" @submit.prevent="submitForm">
          <div>
            <label class="mb-1 block text-xs text-muted">Nombre</label>
            <input v-model="form.nombre" type="text" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Categoría</label>
              <input v-model="form.categoria" type="text" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Duración (min)</label>
              <input v-model.number="form.duracion_min" type="number" min="5" max="600" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Precio</label>
            <input v-model.number="form.precio" type="number" step="0.01" min="0" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Descripción</label>
            <textarea v-model="form.descripcion" rows="2" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink" />
          </div>
          <label class="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input v-model="form.activo" type="checkbox" class="h-4 w-4 rounded border-line">
            Activo (visible para reservar)
          </label>
          <p v-if="formError" class="text-sm text-red-400">{{ formError }}</p>
          <div class="mt-5 flex gap-3">
            <button type="submit" :disabled="saving" class="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50">
              {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
            <button type="button" class="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink" @click="showForm = false">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
