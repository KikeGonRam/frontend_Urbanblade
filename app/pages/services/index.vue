<script setup lang="ts">
/*
 * Fase 9.5 — catálogo de servicios, gestión admin. Api/Service/
 * ServiceManagementController maneja el CRUD completo bajo /services/manage.
 */
definePageMeta({ middleware: ["auth", "admin"], layout: "dashboard" });

interface ServiceRow {
  id: string;
  slug: string;
  nombre: string;
  categoria: string;
  precio: number;
  duracion_min: number;
  descripcion: string | null;
  imagen: string | null;
  activo: boolean;
}

interface ServicesResponse {
  data: ServiceRow[];
  meta: { current_page: number; last_page: number; total: number };
  categories: string[];
}

const { apiFetch } = useApi();
const { confirm } = useConfirm();

const search = ref("");
const debouncedSearch = useDebounce(search, 350);
const categoria = ref("");
const activo = ref("");

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData<ServicesResponse>(
  "services-list",
  () =>
    apiFetch<ServicesResponse>("/services/manage", {
      query: {
        q: search.value || undefined,
        categoria: categoria.value || undefined,
        activo: activo.value || undefined,
      },
    }),
  { watch: [debouncedSearch, categoria, activo], lazy: true },
);
const services = computed(() => response.value?.data ?? []);
const categories = computed(() => response.value?.categories ?? []);

function clearFilters() {
  search.value = "";
  categoria.value = "";
  activo.value = "";
}

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(0)}`;
}

// ── Crear / editar ───────────────────────────────────────────────────────
const showForm = ref(false);
const editing = ref<ServiceRow | null>(null);
const form = reactive({
  nombre: "",
  categoria: "",
  precio: 0,
  duracion_min: 30,
  descripcion: "",
  imagen: "",
  activo: true,
});
const formError = ref("");
const fieldErrors = ref<Record<string, string[]>>({});
const saving = ref(false);

function openCreate() {
  editing.value = null;
  form.nombre = "";
  form.categoria = categories.value[0] ?? "Cortes";
  form.precio = 150;
  form.duracion_min = 30;
  form.descripcion = "";
  form.imagen = "";
  form.activo = true;
  formError.value = "";
  fieldErrors.value = {};
  showForm.value = true;
}

function openEdit(service: ServiceRow) {
  editing.value = service;
  form.nombre = service.nombre;
  form.categoria = service.categoria ?? "";
  form.precio = service.precio;
  form.duracion_min = service.duracion_min;
  form.descripcion = service.descripcion ?? "";
  form.imagen = service.imagen ?? "";
  form.activo = service.activo;
  formError.value = "";
  fieldErrors.value = {};
  showForm.value = true;
}

async function submitForm() {
  saving.value = true;
  formError.value = "";
  fieldErrors.value = {};

  try {
    const payload = {
      nombre: form.nombre,
      categoria: form.categoria,
      precio: form.precio,
      duracion_min: form.duracion_min,
      descripcion: form.descripcion || null,
      imagen: form.imagen || null,
      activo: form.activo,
    };

    if (editing.value) {
      await apiFetch(`/services/manage/${editing.value.slug}`, {
        method: "PUT",
        body: payload,
      });
    } else {
      await apiFetch("/services/manage", { method: "POST", body: payload });
    }
    showForm.value = false;
    await refresh();
  } catch (err: unknown) {
    const dataErr = (
      err as { data?: { message?: string; errors?: Record<string, string[]> } }
    )?.data;
    if (dataErr?.errors) {
      fieldErrors.value = dataErr.errors;
    }
    formError.value =
      dataErr?.message ??
      "No se pudo guardar el servicio. Revisa los campos marcados.";
  } finally {
    saving.value = false;
  }
}

async function removeService(service: ServiceRow) {
  const ok = await confirm({
    title: "Eliminar servicio",
    message: `¿Estás seguro de que deseas eliminar el servicio "${service.nombre}" del catálogo? Esta acción no se puede deshacer.`,
    confirmText: "Sí, eliminar",
    isDanger: true,
  });
  if (!ok) return;

  try {
    await apiFetch(`/services/manage/${service.slug}`, { method: "DELETE" });
    await refresh();
  } catch (err: unknown) {
    const dataErr = (err as { data?: { message?: string } })?.data;
    formError.value = dataErr?.message ?? "No se pudo eliminar el servicio.";
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header
      class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">
          Catálogo de <span class="text-gold">Servicios</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Administra los servicios, tiempos y precios ofrecidos en la barbería.
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim"
        @click="openCreate"
      >
        + Nuevo Servicio
      </button>
    </header>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="text"
        placeholder="Nombre del servicio…"
        class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] sm:max-w-xs"
      >
      <select
        v-model="categoria"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
      >
        <option value="">Todas las categorías</option>
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>
      <select
        v-model="activo"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
      >
        <option value="">Todos los estados</option>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button
        v-if="search || categoria || activo"
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <div
      v-if="pending"
      class="flex items-center gap-3 py-12 text-sm text-muted"
    >
      <div
        class="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent"
      />
      <span>Cargando servicios…</span>
    </div>

    <p v-else-if="error" class="text-sm text-red-400">
      No se pudo cargar el catálogo.
    </p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-line text-[10px] uppercase tracking-wider text-muted"
          >
            <th class="px-4 py-3">Servicio</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3">Duración</th>
            <th class="px-4 py-3 text-right">Precio</th>
            <th class="px-4 py-3 text-center">Estado</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="service in services"
            :key="service.id"
            class="border-b border-line/60 last:border-0"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <img
                  v-if="service.imagen"
                  :src="service.imagen"
                  :alt="service.nombre"
                  class="h-9 w-9 rounded-lg border border-line object-cover"
                >
                <div
                  v-else
                  class="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-ink/5 text-xs text-gold"
                >
                  ✂
                </div>
                <div>
                  <p class="font-bold text-ink">{{ service.nombre }}</p>
                  <p
                    v-if="service.descripcion"
                    class="line-clamp-1 text-xs text-muted"
                  >
                    {{ service.descripcion }}
                  </p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-[9px] font-black uppercase text-muted"
              >
                {{ service.categoria }}
              </span>
            </td>
            <td class="px-4 py-3 text-muted">{{ service.duracion_min }} min</td>
            <td class="px-4 py-3 text-right font-black text-emerald-400">
              {{ fmtMoney(service.precio) }}
            </td>
            <td class="px-4 py-3 text-center">
              <span
                class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase"
                :class="
                  service.activo
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    : 'border-line bg-ink/5 text-muted'
                "
              >
                {{ service.activo ? "Activo" : "Inactivo" }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div v-if="service.slug" class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink"
                  @click="openEdit(service)"
                >
                  Editar
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  @click="removeService(service)"
                >
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!services.length">
            <td colspan="6" class="px-4 py-12 text-center text-sm text-muted">
              Sin servicios registrados.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Modal para crear / editar servicio -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Formulario de servicio"
      @click.self="showForm = false"
    >
      <div
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-2xl"
      >
        <h2 class="mb-4 text-lg font-semibold text-ink">
          {{ editing ? "Editar servicio" : "Nuevo servicio" }}
        </h2>

        <form class="space-y-4" @submit.prevent="submitForm">
          <div>
            <label
              for="service-nombre"
              class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
              >Nombre del servicio</label
            >
            <input
              id="service-nombre"
              v-model="form.nombre"
              type="text"
              required
              maxlength="120"
              placeholder="Ej. Corte Clásico + Barba"
              :class="[
                'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-none',
                fieldErrors.nombre
                  ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                  : 'border-line focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]',
              ]"
            >
            <p v-if="fieldErrors.nombre" class="mt-1 text-xs text-red-400">
              {{ fieldErrors.nombre[0] }}
            </p>
          </div>

          <div>
            <label
              for="service-categoria"
              class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
              >Categoría</label
            >
            <input
              id="service-categoria"
              v-model="form.categoria"
              type="text"
              required
              maxlength="100"
              list="service-categories-list"
              placeholder="Ej. Cortes, Barba, Tratamientos…"
              :class="[
                'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-none',
                fieldErrors.categoria
                  ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                  : 'border-line focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]',
              ]"
            >
            <datalist id="service-categories-list">
              <option v-for="c in categories" :key="c" :value="c" />
            </datalist>
            <!-- Chips sugeridos -->
            <div v-if="categories.length" class="mt-2 flex flex-wrap gap-1.5">
              <button
                v-for="cat in categories"
                :key="cat"
                type="button"
                class="rounded-md border border-line/70 bg-ink/5 px-2 py-0.5 text-[10px] text-muted hover:border-gold hover:text-gold"
                @click="form.categoria = cat"
              >
                {{ cat }}
              </button>
            </div>
            <p v-if="fieldErrors.categoria" class="mt-1 text-xs text-red-400">
              {{ fieldErrors.categoria[0] }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label
                for="service-duracion"
                class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
                >Duración (min)</label
              >
              <input
                id="service-duracion"
                v-model.number="form.duracion_min"
                type="number"
                min="5"
                max="600"
                required
                :class="[
                  'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-none',
                  fieldErrors.duracion_min
                    ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                    : 'border-line focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]',
                ]"
              >
              <p
                v-if="fieldErrors.duracion_min"
                class="mt-1 text-xs text-red-400"
              >
                {{ fieldErrors.duracion_min[0] }}
              </p>
            </div>
            <div>
              <label
                for="service-precio"
                class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
                >Precio ($ MXN)</label
              >
              <input
                id="service-precio"
                v-model.number="form.precio"
                type="number"
                step="0.01"
                min="0"
                required
                :class="[
                  'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-none',
                  fieldErrors.precio
                    ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                    : 'border-line focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]',
                ]"
              >
              <p v-if="fieldErrors.precio" class="mt-1 text-xs text-red-400">
                {{ fieldErrors.precio[0] }}
              </p>
            </div>
          </div>

          <div>
            <label
              for="service-imagen"
              class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
              >URL de Imagen representativa (opcional)</label
            >
            <input
              id="service-imagen"
              v-model="form.imagen"
              type="text"
              maxlength="255"
              placeholder="https://... o ruta relativa de imagen"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
            >
          </div>

          <div>
            <label
              for="service-descripcion"
              class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
              >Descripción del servicio (opcional)</label
            >
            <textarea
              id="service-descripcion"
              v-model="form.descripcion"
              rows="3"
              maxlength="2000"
              placeholder="Detalla qué incluye el corte o servicio…"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
            />
          </div>

          <label
            class="flex cursor-pointer items-center gap-2 text-sm text-ink"
          >
            <input
              v-model="form.activo"
              type="checkbox"
              class="h-4 w-4 rounded border-line text-gold focus:ring-gold"
            >
            <span>Activo (disponible para reserva por clientes)</span>
          </label>

          <p v-if="formError" class="text-xs text-red-400">{{ formError }}</p>

          <div class="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink"
              @click="showForm = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="rounded-lg bg-gold px-5 py-2 text-sm font-bold text-black hover:bg-gold-dim disabled:opacity-50"
            >
              {{ saving ? "Guardando…" : "Guardar servicio" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
