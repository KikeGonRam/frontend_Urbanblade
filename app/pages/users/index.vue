<script setup lang="ts">
import type { CsvColumn } from "~/composables/useCsvExport";
import type { DataTableColumn } from "~/components/ui/DataTable.vue";
/*
 * Fase 9.6 — gestión de usuarios del sistema (cuentas de acceso, no
 * clientes), admin-only. Api/User/UserController ya estaba completo desde
 * antes de esta fase (list+filtros, CRUD, sync de perfil Barber/Client
 * según el rol, guard de auto-eliminación) — no necesitó cambios de
 * backend, solo esta página.
 */
definePageMeta({ middleware: ["auth", "admin"], layout: "dashboard" });
useSeoMeta({ title: 'Usuarios — UrbanBlade', robots: 'noindex' })


interface UserRow {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  roles: string[];
}

interface UsersResponse {
  data: UserRow[];
  meta: { current_page: number; last_page: number; total: number };
  roles: string[];
}

const ROLE_LABEL: Record<string, string> = {
  administrador: "Administrador",
  recepcionista: "Recepción",
  barbero: "Barbero",
  cliente: "Cliente",
};

const exportColumns: CsvColumn<UserRow>[] = [
  { header: "Nombre", value: (u) => u.name },
  { header: "Correo", value: (u) => u.email },
  { header: "Rol", value: (u) => u.roles.map((r) => ROLE_LABEL[r] ?? r).join(" / ") },
];

const { apiFetch } = useApi();
const { confirm } = useConfirm();
const { user: currentUser } = useAuth();

const search = ref("");
const debouncedSearch = useDebounce(search, 350);
const roleFilter = ref("");
const page = ref(1);

const {
  data: response,
  pending,
  error,
  refresh,
} = await useAsyncData<UsersResponse>(
  "users-list",
  () =>
    apiFetch<UsersResponse>("/users", {
      query: {
        q: search.value || undefined,
        role: roleFilter.value || undefined,
        page: page.value,
        per_page: 10,
      },
    }),
  { watch: [debouncedSearch, roleFilter, page], lazy: true },
);
const COLUMNAS: DataTableColumn[] = [
  { key: "name", label: "Usuario" },
  { key: "email", label: "Email", hideBelow: "md" },
  { key: "rol", label: "Rol", align: "center" },
];
const ROLE_ICON: Record<string, string> = {
  administrador: "shield",
  recepcionista: "headset",
  barbero: "scissors",
  cliente: "user",
};
const roleOptions = computed(() => [
  { value: "", label: "Todos", icon: "users" },
  ...roles.value.map((r) => ({ value: r, label: ROLE_LABEL[r] ?? r, icon: ROLE_ICON[r] })),
]);
function onRowAction(action: string, user: UserRow) {
  if (action === "edit") openEdit(user);
  else if (action === "delete") removeUser(user);
}
const users = computed(() => response.value?.data ?? []);
const roles = computed(() => response.value?.roles ?? []);
const pagination = computed(() => response.value?.meta);

watch([debouncedSearch, roleFilter], () => {
  page.value = 1;
});

function clearFilters() {
  search.value = "";
  roleFilter.value = "";
  page.value = 1;
}

// ── Crear / editar (formulario único en UiUserFormSheet) ───────────────────
const showForm = ref(false);
const editing = ref<UserRow | null>(null);
const actionError = ref("");

function openCreate() {
  editing.value = null;
  showForm.value = true;
}

function openEdit(user: UserRow) {
  editing.value = user;
  showForm.value = true;
}

async function onSaved(warning: string) {
  showForm.value = false;
  actionError.value = warning;
  await refresh();
}

async function removeUser(user: UserRow) {
  const accepted = await confirm({
    title: "Eliminar usuario",
    message: `¿Eliminar a ${user.name}? Esta acción no se puede deshacer.`,
    confirmText: "Sí, eliminar",
    isDanger: true,
  });
  if (!accepted) return;

  actionError.value = "";
  try {
    await apiFetch(`/users/${user.id}`, { method: "DELETE" });
    await refresh();
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ??
      "No se pudo eliminar el usuario.";
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
          Gestión de <span class="text-gold">Usuarios</span>
        </h1>
        <p class="mt-1 text-sm text-muted">
          Cuentas de acceso al sistema, por rol.
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim"
        @click="openCreate"
      >
        + Nuevo Usuario
      </button>
    </header>
    <section class="mb-5 flex flex-wrap items-center gap-3" aria-label="Filtros">
      <UiSearchInput v-model="search" label="Buscar usuarios" placeholder="Buscar por nombre o correo…" />
      <UiFilterChips v-model="roleFilter" label="Filtrar por rol" :options="roleOptions" />
      <button
        v-if="search || roleFilter"
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="clearFilters"
      >
        Limpiar filtros
      </button>
      <span class="ml-auto">
        <UiExportCsvButton
          endpoint="/users"
          :query="{ q: search || undefined, role: roleFilter || undefined }"
          :columns="exportColumns"
          filename="usuarios"
        />
      </span>
    </section>

    <BrandStatePanel v-if="error" mascot="bruno" state="error" tone="danger" title="No se pudo cargar la lista de usuarios" description="Inténtalo nuevamente en unos minutos." action-label="Reintentar" @action="refresh" />
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-danger">
      {{ actionError }}
    </p>

    <UiDataTable
      v-if="!error"
      :columns="COLUMNAS"
      :rows="users"
      :loading="pending"
      aria-label="Usuarios"
      empty-title="Sin usuarios"
      empty-description="Cambia la búsqueda o el filtro de rol para ver otras cuentas."
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <UiAvatar :src="row.avatar_url" :name="row.name" />
          <span class="font-bold text-ink">{{ row.name }}</span>
          <span
            v-if="currentUser && row.id === currentUser.id"
            class="rounded-full border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-xs font-black uppercase text-gold"
            >Tú</span
          >
        </div>
      </template>
      <template #cell-email="{ row }">
        <span class="text-muted">{{ row.email }}</span>
      </template>
      <template #cell-rol="{ row }">
        <span class="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink/5 px-2.5 py-1 text-xs font-bold text-ink">
          <UiIcon :name="ROLE_ICON[row.roles[0]] ?? 'user'" />
          {{ ROLE_LABEL[row.roles[0]] ?? row.roles[0] ?? "—" }}
        </span>
      </template>
      <template #actions="{ row }">
        <UiRowActions
          :actions="[
            { key: 'edit', label: `Editar a ${row.name}`, icon: 'edit' },
            { key: 'delete', label: `Eliminar a ${row.name}`, icon: 'trash', danger: true, hidden: !!currentUser && row.id === currentUser.id },
          ]"
          @action="onRowAction($event, row)"
        />
      </template>
    </UiDataTable>

    <UiPagination
      v-if="pagination"
      v-model:current-page="page"
      :last-page="pagination.last_page"
      :total="pagination.total"
      :per-page="10"
      :busy="pending"
    />

    <UiUserFormSheet
      v-if="showForm"
      :editing="editing"
      :roles="roles"
      :role-label="ROLE_LABEL"
      @close="showForm = false"
      @saved="onSaved"
    />
  </div>
</template>
