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
useSeoMeta({ title: 'Barberos — UrbanBlade', robots: 'noindex' })


interface BarberRow {
  id: string;
  // El endpoint de edición resuelve por slug (Barber::getRouteKeyName()),
  // no por id -- ver App\Http\Controllers\Api\Barber\BarberManagementController.
  slug: string;
  especialidades: string | null;
  descripcion: string | null;
  foto: string | null;
  foto_url: string | null;
  activo: boolean;
  comision_pct: number;
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
const page = ref(1);

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
        page: page.value,
        per_page: 15,
      },
    }),
  { watch: [debouncedSearch, activo, page], lazy: true },
);
const barbers = computed(() => response.value?.data ?? []);
const pagination = computed(() => response.value?.meta);

watch([debouncedSearch, activo], () => {
  page.value = 1;
});

function clearFilters() {
  search.value = "";
  activo.value = "";
  page.value = 1;
}

// ── Editar ────────────────────────────────────────────────────────────────
const showForm = ref(false);
const editing = ref<BarberRow | null>(null);
const form = reactive({
  name: "",
  email: "",
  especialidades: "",
  descripcion: "",
  fotoFile: null as File | null,
  activo: true,
  comisionPct: 0,
});
const formError = ref("");
const bErr = (field: string) => fieldErrors.value[field]?.[0] ?? null;
const bInput = (field: string) => [
  "ui-input w-full",
  fieldErrors.value[field] ? "border-danger/60" : "border-line",
];
const fieldErrors = ref<Record<string, string[]>>({});
const saving = ref(false);

function openEdit(barber: BarberRow) {
  editing.value = barber;
  form.name = barber.user.name;
  form.email = barber.user.email;
  form.especialidades = barber.especialidades ?? "";
  form.descripcion = barber.descripcion ?? "";
  form.fotoFile = null;
  form.activo = barber.activo;
  form.comisionPct = barber.comision_pct;
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
    // Multipart con la foto elegida, como POST con _method=PUT porque PHP no lee
    // archivos de un PUT. Sin foto nueva no se manda el campo y se conserva la actual.
    const body = new FormData();
    body.append("_method", "PUT");
    body.append("name", form.name);
    body.append("email", form.email);
    body.append("especialidades", form.especialidades);
    body.append("descripcion", form.descripcion);
    body.append("activo", form.activo ? "1" : "0");
    body.append("comision_pct", String(form.comisionPct));
    if (form.fotoFile) body.append("foto", form.fotoFile);

    await apiFetch(`/barbers/manage/${editing.value.slug}`, {
      method: "POST",
      body,
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

    <UiPagination
      v-if="pagination"
      v-model:current-page="page"
      :last-page="pagination.last_page"
      :total="pagination.total"
      :per-page="15"
      :busy="pending"
    />

    <div
      v-if="pending"
      class="flex items-center gap-3 py-12 text-sm text-muted"
    >
      <div
        class="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent"
      />
      <span>Cargando barberos…</span>
    </div>

    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar la lista de barberos"
      action-label="Reintentar"
      @action="refresh"
    />

    <section v-else class="ui-card overflow-x-auto">
      <table aria-label="Barberos" class="w-full min-w-[52rem] text-left text-sm">
        <thead>
          <tr
            class="border-b border-line text-xs uppercase tracking-wider text-muted"
          >
            <th scope="col" class="px-4 py-3">Barbero</th>
            <th scope="col" class="px-4 py-3">Especialidades</th>
            <th scope="col" class="px-4 py-3 text-center">Comisión</th>
            <th scope="col" class="px-4 py-3 text-center">Estado</th>
            <th scope="col" class="px-4 py-3 text-right">Acciones</th>
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
                  v-if="barber.foto_url"
                  :src="barber.foto_url"
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
            <td class="px-4 py-3 text-center text-ink">
              {{ barber.comision_pct }}%
            </td>
            <td class="px-4 py-3 text-center">
              <span
                class="rounded-full border px-2 py-0.5 text-xs font-black uppercase"
                :class="
                  barber.activo
                    ? 'border-success/25 bg-success/10 text-success'
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
            <td colspan="5" class="px-4 py-12 text-center text-sm text-muted">
              Sin barberos registrados.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <UiFormSheet
      v-if="showForm"
      :title="'Editar barbero'"
      kicker="Equipo"
      icon="scissors"
      subtitle="Perfil público, foto, comisión y disponibilidad en el catálogo."
      hint="El perfil se actualiza al guardar"
      :badge="'Edición'"
      form-id="barber-form"
      submit-label="Guardar cambios"
      :busy="saving"
      @close="showForm = false"
    >
      <form id="barber-form" class="space-y-6" @submit.prevent="submitForm">
        <section class="space-y-4" aria-labelledby="bb-id">
          <p id="bb-id" class="ub-form-section__title">Identidad</p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UiFormField field-id="barber-name" label="Nombre" icon="user" :error="bErr('name')">
              <input
                id="barber-name"
                v-model="form.name"
                aria-label="Nombre"
                type="text"
                required
                maxlength="255"
                :class="bInput('name')"
              >
            </UiFormField>
            <UiFormField field-id="barber-email" label="Correo" icon="mail" :error="bErr('email')">
              <input
                id="barber-email"
                v-model="form.email"
                aria-label="Correo"
                type="email"
                required
                maxlength="255"
                :class="bInput('email')"
              >
            </UiFormField>
          </div>
        </section>

        <section class="space-y-4" aria-labelledby="bb-prof">
          <p id="bb-prof" class="ub-form-section__title">Perfil público</p>
          <UiFormField field-id="barber-especialidades" label="Especialidades" icon="scissors" :error="bErr('especialidades')">
            <input
              id="barber-especialidades"
              v-model="form.especialidades"
              aria-label="Especialidades"
              type="text"
              maxlength="1000"
              placeholder="Ej. Fades, barba, color…"
              :class="bInput('especialidades')"
            >
          </UiFormField>
          <UiFormField field-id="barber-descripcion" label="Descripción (perfil público)" icon="text" top>
            <textarea
              id="barber-descripcion"
              v-model="form.descripcion"
              aria-label="Descripción (perfil público)"
              rows="3"
              maxlength="1000"
              class="ui-input w-full"
            />
          </UiFormField>
          <UiImageUpload
            id="barber-foto"
            v-model="form.fotoFile"
            label="Foto (opcional)"
            :current-url="editing?.foto_url"
            :error="fieldErrors.foto?.[0]"
            round
          />
        </section>

        <section class="space-y-4" aria-labelledby="bb-work">
          <p id="bb-work" class="ub-form-section__title">Trabajo</p>
          <UiFormField field-id="barber-comision" label="Comisión (% sobre el precio de lista del servicio)" icon="percent">
            <input
              id="barber-comision"
              v-model.number="form.comisionPct"
              aria-label="Comisión (% sobre el precio de lista del servicio)"
              type="number"
              min="0"
              max="100"
              step="1"
              class="ui-input w-full"
            >
          </UiFormField>
          <UiSwitch
            v-model="form.activo"
            label="Activo"
            description="Visible en el catálogo público"
          />
        </section>

        <p v-if="formError" role="alert" class="text-sm text-danger">{{ formError }}</p>
      </form>
    </UiFormSheet>
  </div>
</template>
