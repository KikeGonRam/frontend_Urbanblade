<script setup lang="ts">
/*
 * Fase 9.6 — gestión de usuarios del sistema (cuentas de acceso, no
 * clientes), admin-only. Api/User/UserController ya estaba completo desde
 * antes de esta fase (list+filtros, CRUD, sync de perfil Barber/Client
 * según el rol, guard de auto-eliminación) — no necesitó cambios de
 * backend, solo esta página.
 */
definePageMeta({ middleware: ['auth', 'admin'], layout: 'dashboard' })

interface UserRow {
  id: string
  name: string
  email: string
  roles: string[]
}

interface UsersResponse {
  data: UserRow[]
  meta: { current_page: number, last_page: number, total: number }
  roles: string[]
}

const ROLE_LABEL: Record<string, string> = { administrador: 'Administrador', recepcionista: 'Recepción', barbero: 'Barbero', cliente: 'Cliente' }

const { apiFetch } = useApi()
const { user: currentUser } = useAuth()

const search = ref('')
const roleFilter = ref('')

const { data: response, pending, error, refresh } = await useAsyncData<UsersResponse>(
  'users-list',
  () => apiFetch<UsersResponse>('/users', { query: { q: search.value || undefined, role: roleFilter.value || undefined } }),
  { watch: [search, roleFilter] },
)
const users = computed(() => response.value?.data ?? [])
const roles = computed(() => response.value?.roles ?? [])

function clearFilters() {
  search.value = ''
  roleFilter.value = ''
}

// ── Crear / editar ───────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<UserRow | null>(null)
const form = reactive({ name: '', email: '', password: '', password_confirmation: '', role: 'cliente' })
const formError = ref('')
const saving = ref(false)

function openCreate() {
  editing.value = null
  form.name = ''
  form.email = ''
  form.password = ''
  form.password_confirmation = ''
  form.role = 'cliente'
  formError.value = ''
  showForm.value = true
}

function openEdit(user: UserRow) {
  editing.value = user
  form.name = user.name
  form.email = user.email
  form.password = ''
  form.password_confirmation = ''
  form.role = user.roles[0] ?? 'cliente'
  formError.value = ''
  showForm.value = true
}

async function submitForm() {
  saving.value = true
  formError.value = ''
  try {
    const body: Record<string, string> = { name: form.name, email: form.email, role: form.role }
    if (form.password) {
      body.password = form.password
      body.password_confirmation = form.password_confirmation
    }
    if (editing.value) {
      await apiFetch(`/users/${editing.value.id}`, { method: 'PUT', body })
    } else {
      await apiFetch('/users', { method: 'POST', body })
    }
    showForm.value = false
    await refresh()
  } catch (err: unknown) {
    formError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo guardar. Verifica los datos.'
  } finally {
    saving.value = false
  }
}

async function removeUser(user: UserRow) {
  if (!confirm(`¿Eliminar a ${user.name}?`)) return

  try {
    await apiFetch(`/users/${user.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: unknown) {
    alert((err as { data?: { message?: string } })?.data?.message ?? 'No se pudo eliminar el usuario.')
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Gestión de <span class="text-gold">Usuarios</span></h1>
        <p class="mt-1 text-sm text-muted">Cuentas de acceso al sistema, por rol.</p>
      </div>
      <button type="button" class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold-dim" @click="openCreate">
        + Nuevo Usuario
      </button>
    </header>

    <section class="mb-5 flex flex-wrap items-center gap-3">
      <input v-model="search" type="text" placeholder="Nombre o email…" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink sm:max-w-xs">
      <select v-model="roleFilter" class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
        <option value="">Todos los roles</option>
        <option v-for="r in roles" :key="r" :value="r">{{ ROLE_LABEL[r] ?? r }}</option>
      </select>
      <button v-if="search || roleFilter" type="button" class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink" @click="clearFilters">
        Limpiar filtros
      </button>
    </section>

    <p v-if="pending" class="text-sm text-muted">Cargando usuarios…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar la lista de usuarios.</p>

    <section v-else class="ui-card overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <th class="px-4 py-3">Usuario</th>
            <th class="px-4 py-3">Email</th>
            <th class="px-4 py-3 text-center">Rol</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="border-b border-line/60 last:border-0">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-ink/5 text-[10px] font-black text-ink">
                  {{ user.name.slice(0, 2).toUpperCase() }}
                </div>
                <span class="font-bold text-ink">{{ user.name }}</span>
                <span v-if="currentUser && user.id === currentUser.id" class="rounded-full border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-gold">Tú</span>
              </div>
            </td>
            <td class="px-4 py-3 text-muted">{{ user.email }}</td>
            <td class="px-4 py-3 text-center">
              <span class="rounded-full border border-line bg-ink/5 px-2 py-0.5 text-[9px] font-black uppercase text-muted">{{ ROLE_LABEL[user.roles[0]] ?? user.roles[0] ?? '—' }}</span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button type="button" class="rounded-lg border border-line px-3 py-1 text-xs text-muted hover:text-ink" @click="openEdit(user)">Editar</button>
                <button
                  v-if="!currentUser || user.id !== currentUser.id" type="button"
                  class="rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  @click="removeUser(user)"
                >
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!users.length">
            <td colspan="4" class="px-4 py-12 text-center text-sm text-muted">Sin usuarios.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="showForm = false">
      <div class="w-full max-w-md rounded-2xl border border-line bg-card p-6">
        <h2 class="mb-4 text-lg font-semibold text-ink">{{ editing ? 'Editar usuario' : 'Nuevo usuario' }}</h2>
        <form class="space-y-3" @submit.prevent="submitForm">
          <div>
            <label class="mb-1 block text-xs text-muted">Nombre</label>
            <input v-model="form.name" type="text" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Email</label>
            <input v-model="form.email" type="email" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Rol</label>
            <select v-model="form.role" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
              <option v-for="r in roles" :key="r" :value="r">{{ ROLE_LABEL[r] ?? r }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">{{ editing ? 'Nueva contraseña (opcional)' : 'Contraseña' }}</label>
            <input v-model="form.password" type="password" :required="!editing" minlength="8" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div v-if="form.password">
            <label class="mb-1 block text-xs text-muted">Confirmar contraseña</label>
            <input v-model="form.password_confirmation" type="password" :required="!!form.password" minlength="8" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
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
