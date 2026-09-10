<script setup lang="ts">
/*
 * Gestión admin de barberos -- Api\Barber\BarberManagementController, bajo
 * /barbers/manage (paginado, búsqueda, filtro por activo). Antes de esto el
 * ítem "Barberos" de la nav admin apuntaba a /barbers, la misma página de
 * solo lectura que ve un cliente -- el admin no tenía forma de editar el
 * perfil de un barbero desde la app (encontrado en la auditoría de
 * completitud del 2026-09-09). Crear un barbero nuevo sigue haciéndose
 * desde /users (elegir rol "Barbero" ahí ya crea el perfil asociado,
 * confirmado en UserApiTest) -- este controlador no expone POST.
 */
definePageMeta({ middleware: ["auth", "admin"], layout: "dashboard" });

interface BarberRow {
  id: string;
  // El endpoint de edición resuelve por slug (Barber::getRouteKeyName()),
  // no por id -- ver App\Http\Controllers\Api\Barber\BarberManagementController.
  slug: string;
  especialidades: string | null;
  descripcion: string | null;
  foto: string | null;
  activo: boolean;
  user: { id: string; name: string; email: string };
}

interface BarbersResponse {
  data: BarberRow[];
  meta: { current_page: number; last_page: number; total: number };
}

const { apiFetch } = useApi();

const search = ref("");
const debouncedSearch = useDebounce(search, 350);
const activo = ref("");

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData<BarbersResponse>(
  "barbers-manage-list",
  () =>
    apiFetch<BarbersResponse>("/barbers/manage", {
      query: {
        q: search.value || undefined,
        activo: activo.value || undefined,
      },
    }),
  { watch: [debouncedSearch, activo], lazy: true },
);
const barbers = computed(() => response.value?.data ?? []);

function clearFilters() {
  search.value = "";
  activo.value = "";
}

// ── Editar ────────────────────────────────────────────────────────────────
const showForm = ref(false);
const editing = ref<BarberRow | null>(null);
const form = reactive({
  name: "",
  email: "",
  especialidades: "",
  descripcion: "",
  foto: "",
  activo: true,
});
const formError = ref("");
const fieldErrors = ref<Record<string, string[]>>({});
const saving = ref(false);

function openEdit(barber: BarberRow) {
  editing.value = barber;
  form.name = barber.user.name;
  form.email = barber.user.email;
  form.especialidades = barber.especialidades ?? "";
  form.descripcion = barber.descripcion ?? "";
  form.foto = barber.foto ?? "";
  form.activo = barber.activo;
  formError.value = "";
  fieldErrors.value = {};
  showForm.value = true;
}

async function submitForm() {
  if (!editing.value) return;

  saving.value = true;
  formError.value = "";
  fieldErrors.value = {};

  try {
    await apiFetch(`/barbers/manage/${editing.value.slug}`, {
      method: "PUT",
      body: {
        name: form.name,
        email: form.email,
        especialidades: form.especialidades || null,
        descripcion: form.descripcion || null,
        foto: form.foto || null,
        activo: form.activo,
      },
    });
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
      "No se pudo guardar el barbero. Revisa los campos marcados.";
  } finally {
    saving.value = false;
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
          Gestión de <span class="text-gold">Barberos</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Edita especialidad, descripción, foto y estado de cada barbero.
        </p>
      </div>
      <NuxtLink
        to="/users"
        class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-gold/40 hover:text-ink"
      >
        + Nuevo barbero (vía Usuarios)
      </NuxtLink>
    </header>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="text"
        placeholder="Nombre o correo…"
        class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] sm:max-w-xs"
      >
      <select
        v-model="activo"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
      >
        <option value="">Todos los estados</option>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button
        v-if="search || activo"
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
      <span>Cargando barberos…</span>
    </div>

    <p v-else-if="error" class="text-sm text-red-400">
      No se pudo cargar la lista de barberos.
    </p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-line text-[10px] uppercase tracking-wider text-muted"
          >
            <th class="px-4 py-3">Barbero</th>
            <th class="px-4 py-3">Especialidades</th>
            <th class="px-4 py-3 text-center">Estado</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="barber in barbers"
            :key="barber.id"
            class="border-b border-line/60 last:border-0"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <img
                  v-if="barber.foto"
                  :src="barber.foto"
                  :alt="barber.user.name"
                  class="h-9 w-9 rounded-full border border-line object-cover"
                >
                <div
                  v-else
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-ink/5 text-xs font-black text-gold"
                >
                  {{ barber.user.name.charAt(0) }}
                </div>
                <div>
                  <p class="font-bold text-ink">{{ barber.user.name }}</p>
                  <p class="text-xs text-muted">{{ barber.user.email }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-muted">
              <span class="line-clamp-1">{{ barber.especialidades || "—" }}</span>
            </td>
            <td class="px-4 py-3 text-center">
              <span
                class="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase"
                :class="
                  barber.activo
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    : 'border-line bg-ink/5 text-muted'
                "
              >
                {{ barber.activo ? "Activo" : "Inactivo" }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <button
                type="button"
                class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink"
                @click="openEdit(barber)"
              >
                Editar
              </button>
            </td>
          </tr>
          <tr v-if="!barbers.length">
            <td colspan="4" class="px-4 py-12 text-center text-sm text-muted">
              Sin barberos registrados.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Modal de edición -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Editar barbero"
      @click.self="showForm = false"
    >
      <div
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-2xl"
      >
        <h2 class="mb-4 text-lg font-semibold text-ink">Editar barbero</h2>

        <form class="space-y-4" @submit.prevent="submitForm">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label
                for="barber-name"
                class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
                >Nombre</label
              >
              <input
                id="barber-name"
                v-model="form.name"
                type="text"
                required
                maxlength="255"
                :class="[
                  'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-none',
                  fieldErrors.name
                    ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                    : 'border-line focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]',
                ]"
              >
              <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-400">
                {{ fieldErrors.name[0] }}
              </p>
            </div>
            <div>
              <label
                for="barber-email"
                class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
                >Correo</label
              >
              <input
                id="barber-email"
                v-model="form.email"
                type="email"
                required
                maxlength="255"
                :class="[
                  'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-none',
                  fieldErrors.email
                    ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                    : 'border-line focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]',
                ]"
              >
              <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-400">
                {{ fieldErrors.email[0] }}
              </p>
            </div>
          </div>

          <div>
            <label
              for="barber-especialidades"
              class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
              >Especialidades</label
            >
            <input
              id="barber-especialidades"
              v-model="form.especialidades"
              type="text"
              maxlength="1000"
              placeholder="Ej. Fades, barba, color…"
              :class="[
                'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink focus:outline-none',
                fieldErrors.especialidades
                  ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                  : 'border-line focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]',
              ]"
            >
            <p v-if="fieldErrors.especialidades" class="mt-1 text-xs text-red-400">
              {{ fieldErrors.especialidades[0] }}
            </p>
          </div>

          <div>
            <label
              for="barber-descripcion"
              class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
              >Descripción (perfil público)</label
            >
            <textarea
              id="barber-descripcion"
              v-model="form.descripcion"
              rows="3"
              maxlength="1000"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
            />
          </div>

          <div>
            <label
              for="barber-foto"
              class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
              >URL de foto (opcional)</label
            >
            <input
              id="barber-foto"
              v-model="form.foto"
              type="text"
              maxlength="255"
              placeholder="https://…"
              class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
            >
          </div>

          <label class="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              v-model="form.activo"
              type="checkbox"
              class="h-4 w-4 rounded border-line text-gold focus:ring-gold"
            >
            <span>Activo (visible en el catálogo público)</span>
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
              {{ saving ? "Guardando…" : "Guardar cambios" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
