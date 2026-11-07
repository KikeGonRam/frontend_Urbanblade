<script setup lang="ts">
import type { CsvColumn } from "~/composables/useCsvExport";
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
        per_page: 15,
      },
    }),
  { watch: [debouncedSearch, roleFilter, page], lazy: true },
);
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
    <div class="mb-3">
      <UiExportCsvButton
        endpoint="/users"
        :query="{ q: search || undefined, role: roleFilter || undefined }"
        :columns="exportColumns"
        filename="usuarios"
      />
    </div>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="text"
        placeholder="Nombre o email…"
        class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink sm:max-w-xs"
      >
      <select
        v-model="roleFilter"
        class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
      >
        <option value="">Todos los roles</option>
        <option v-for="r in roles" :key="r" :value="r">
          {{ ROLE_LABEL[r] ?? r }}
        </option>
      </select>
      <button
        v-if="search || roleFilter"
        type="button"
        class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
        @click="clearFilters"
      >
        Limpiar filtros
      </button>
    </section>

    <BrandStatePanel v-if="pending" mascot="bladebot" state="waiting" title="Cargando usuarios…" />
    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudo cargar la lista de usuarios"
      description="Inténtalo nuevamente en unos minutos."
      action-label="Reintentar"
      @action="refresh"
    />
    <p v-if="actionError" role="alert" class="mb-4 text-sm text-danger">
      {{ actionError }}
    </p>

    <section v-if="!pending && !error" class="ui-card overflow-x-auto">
      <table aria-label="Usuarios" class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-line text-xs uppercase tracking-wider text-muted"
          >
            <th scope="col" class="px-4 py-3">Usuario</th>
            <th scope="col" class="px-4 py-3">Email</th>
            <th scope="col" class="px-4 py-3 text-center">Rol</th>
            <th scope="col" class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users"
            :key="user.id"
            class="border-b border-line/60 last:border-0"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <UiAvatar :src="user.avatar_url" :name="user.name" />
                <span class="font-bold text-ink">{{ user.name }}</span>
                <span
                  v-if="currentUser && user.id === currentUser.id"
                  class="rounded-full border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-xs font-black uppercase text-gold"
                  >Tú</span
                >
              </div>
            </td>
            <td class="px-4 py-3 text-muted">{{ user.email }}</td>
            <td class="px-4 py-3 text-center">
              <span
                class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-xs font-black uppercase text-muted"
                >{{ ROLE_LABEL[user.roles[0]] ?? user.roles[0] ?? "—" }}</span
              >
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink"
                  @click="openEdit(user)"
                >
                  Editar
                </button>
                <button
                  v-if="!currentUser || user.id !== currentUser.id"
                  type="button"
                  class="rounded-lg border border-danger/20 px-3 py-1 text-xs text-danger hover:bg-danger/10"
                  @click="removeUser(user)"
                >
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!users.length">
            <td colspan="4" class="px-4 py-12 text-center text-sm text-muted">
              Sin usuarios.
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <UiPagination
      v-if="pagination"
      v-model:current-page="page"
      :last-page="pagination.last_page"
      :total="pagination.total"
      :per-page="15"
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
