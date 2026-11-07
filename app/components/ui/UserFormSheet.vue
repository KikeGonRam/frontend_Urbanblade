<script setup lang="ts">
/*
 * Formulario único de personas: administrador, recepción, barbero y cliente.
 * Muestra solo los campos del rol elegido y los guarda con los endpoints que ya
 * existen, sin tocar el contrato del backend:
 *   - cuenta (todos): POST/PUT /users
 *   - cliente nuevo: POST /admin/clients (cuenta + teléfono en una sola llamada)
 *   - perfil de cliente: PUT /admin/clients/{slug}
 *   - perfil de barbero: POST /barbers/manage/{slug} con _method=PUT (multipart)
 * El backend crea el perfil vacío al asignar el rol; el de barbero se completa
 * con una segunda llamada. Si esa segunda falla, la cuenta ya existe y se avisa.
 */
interface UserRow {
  id: string;
  name: string;
  email: string;
  roles: string[];
}
interface ClientProfile {
  slug: string | null;
  email: string | null;
  telefono: string | null;
}
interface BarberProfile {
  slug: string;
  especialidades: string | null;
  descripcion: string | null;
  foto_url: string | null;
  activo: boolean;
  comision_pct: number;
  user: { email: string };
}

const props = defineProps<{
  editing: UserRow | null;
  roles: string[];
  roleLabel: Record<string, string>;
}>();
const emit = defineEmits<{ close: []; saved: [warning: string] }>();

const { apiFetch } = useApi();

const form = reactive({
  name: props.editing?.name ?? "",
  email: props.editing?.email ?? "",
  role: props.editing?.roles[0] ?? "cliente",
  password: "",
  password_confirmation: "",
  telefono: "",
  especialidades: "",
  descripcion: "",
  activo: true,
  comisionPct: 0,
  fotoFile: null as File | null,
});
const clientProfile = ref<ClientProfile | null>(null);
const barberProfile = ref<BarberProfile | null>(null);
const loadingProfile = ref(false);
const saving = ref(false);
const formError = ref("");
const fieldErrors = ref<Record<string, string[]>>({});

const isClient = computed(() => form.role === "cliente");
const isBarber = computed(() => form.role === "barbero");
const err = (field: string) => fieldErrors.value[field]?.[0] ?? null;
const inputClass = (field: string) => [
  "ui-input w-full",
  fieldErrors.value[field] ? "border-danger/60" : "border-line",
];

function sameEmail(a?: string | null, b?: string | null) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** Perfil de cliente/barbero de una cuenta: se ubica por correo exacto. */
async function findClient(email: string) {
  const res = await apiFetch<{ data: ClientProfile[] }>("/admin/clients", {
    query: { search: email, per_page: 5 },
  });
  return res.data.find((c) => sameEmail(c.email, email)) ?? null;
}
async function findBarber(email: string) {
  const res = await apiFetch<{ data: BarberProfile[] }>("/barbers/manage", {
    query: { q: email, per_page: 5 },
  });
  return res.data.find((b) => sameEmail(b.user.email, email)) ?? null;
}

// Al editar se precargan los datos del perfil que ya tiene la cuenta.
onMounted(async () => {
  if (!props.editing) return;
  loadingProfile.value = true;
  try {
    if (props.editing.roles.includes("cliente")) {
      clientProfile.value = await findClient(props.editing.email);
      form.telefono = clientProfile.value?.telefono ?? "";
    }
    if (props.editing.roles.includes("barbero")) {
      barberProfile.value = await findBarber(props.editing.email);
      if (barberProfile.value) {
        form.especialidades = barberProfile.value.especialidades ?? "";
        form.descripcion = barberProfile.value.descripcion ?? "";
        form.activo = barberProfile.value.activo;
        form.comisionPct = barberProfile.value.comision_pct;
      }
    }
  } catch {
    // Sin perfil cargado se puede editar la cuenta; los campos de perfil quedan vacíos.
  } finally {
    loadingProfile.value = false;
  }
});

async function saveClientProfile(email: string) {
  const client = clientProfile.value ?? (await findClient(email));
  if (!client?.slug) throw new Error("perfil-no-encontrado");
  await apiFetch(`/admin/clients/${client.slug}`, {
    method: "PUT",
    body: { name: form.name, email, telefono: form.telefono },
  });
}

async function saveBarberProfile(email: string) {
  const barber = barberProfile.value ?? (await findBarber(email));
  if (!barber) throw new Error("perfil-no-encontrado");
  // Multipart como POST + _method=PUT: PHP no lee archivos de un PUT.
  const body = new FormData();
  body.append("_method", "PUT");
  body.append("name", form.name);
  body.append("email", email);
  body.append("especialidades", form.especialidades);
  body.append("descripcion", form.descripcion);
  body.append("activo", form.activo ? "1" : "0");
  body.append("comision_pct", String(form.comisionPct));
  if (form.fotoFile) body.append("foto", form.fotoFile);
  await apiFetch(`/barbers/manage/${barber.slug}`, { method: "POST", body });
}

async function saveAccount() {
  const body: Record<string, string> = {
    name: form.name,
    email: form.email,
    role: form.role,
  };
  if (form.password) {
    body.password = form.password;
    body.password_confirmation = form.password_confirmation;
  }
  if (props.editing) {
    await apiFetch(`/users/${props.editing.id}`, { method: "PUT", body });
  } else {
    await apiFetch("/users", { method: "POST", body });
  }
}

async function submit() {
  saving.value = true;
  formError.value = "";
  fieldErrors.value = {};
  let warning = "";
  try {
    if (!props.editing && isClient.value) {
      // Alta de cliente: cuenta y teléfono en una sola llamada atómica.
      await apiFetch("/admin/clients", {
        method: "POST",
        body: {
          name: form.name,
          email: form.email,
          telefono: form.telefono,
          password: form.password,
        },
      });
    } else {
      await saveAccount();
      try {
        if (isClient.value) await saveClientProfile(form.email);
        if (isBarber.value) await saveBarberProfile(form.email);
      } catch {
        warning = isBarber.value
          ? "La cuenta se guardó, pero no se pudo completar el perfil del barbero. Ábrela de nuevo para reintentar."
          : "La cuenta se guardó, pero no se pudo guardar el teléfono. Ábrela de nuevo para reintentar.";
      }
    }
    emit("saved", warning);
  } catch (e: unknown) {
    const data = (
      e as { data?: { message?: string; errors?: Record<string, string[]> } }
    )?.data;
    fieldErrors.value = data?.errors ?? {};
    formError.value = data?.message ?? "No se pudo guardar. Verifica los datos.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UiFormSheet
    :title="editing ? 'Editar persona' : 'Nueva persona'"
    kicker="Cuentas y perfiles"
    :badge="editing ? 'Edición' : 'Alta'"
    :busy="saving"
    @close="emit('close')"
  >
    <template #subtitle>
      <p class="mt-2 ub-form-help">
        Un solo formulario para administrador, recepción, barbero y cliente: según el
        rol aparecen los campos que le corresponden.
      </p>
    </template>

    <form id="user-form" class="space-y-5" @submit.prevent="submit">
      <section class="space-y-4" aria-labelledby="sec-id">
        <p id="sec-id" class="ub-form-section__title">Identidad</p>
        <UiFormField field-id="user-name" label="Nombre" :error="err('name')">
          <input
            id="user-name"
            v-model="form.name"
            aria-label="Nombre"
            type="text"
            required
            :aria-invalid="!!err('name')"
            :aria-describedby="err('name') ? 'user-name-error' : undefined"
            :class="inputClass('name')"
          >
        </UiFormField>
        <UiFormField field-id="user-email" label="Email" :error="err('email')">
          <input
            id="user-email"
            v-model="form.email"
            aria-label="Email"
            type="email"
            required
            :aria-invalid="!!err('email')"
            :aria-describedby="err('email') ? 'user-email-error' : undefined"
            :class="inputClass('email')"
          >
        </UiFormField>
        <UiFormField field-id="user-role" label="Rol" :error="err('role')">
          <select
            id="user-role"
            v-model="form.role"
            aria-label="Rol"
            required
            :aria-invalid="!!err('role')"
            :aria-describedby="err('role') ? 'user-role-error' : undefined"
            :class="inputClass('role')"
          >
            <option v-for="r in roles" :key="r" :value="r">
              {{ roleLabel[r] ?? r }}
            </option>
          </select>
        </UiFormField>
      </section>

      <section
        v-if="isClient"
        class="ub-form-section space-y-4"
        aria-labelledby="sec-client"
      >
        <p id="sec-client" class="ub-form-section__title">Datos del cliente</p>
        <p v-if="loadingProfile" class="ub-form-help">Cargando perfil…</p>
        <UiFormField field-id="user-telefono" label="Teléfono" :error="err('telefono')">
          <input
            id="user-telefono"
            v-model="form.telefono"
            aria-label="Teléfono"
            type="tel"
            autocomplete="tel"
            :aria-invalid="!!err('telefono')"
            :aria-describedby="err('telefono') ? 'user-telefono-error' : undefined"
            :class="inputClass('telefono')"
          >
        </UiFormField>
      </section>

      <section
        v-if="isBarber"
        class="ub-form-section space-y-4"
        aria-labelledby="sec-barber"
      >
        <p id="sec-barber" class="ub-form-section__title">Perfil del barbero</p>
        <p v-if="loadingProfile" class="ub-form-help">Cargando perfil…</p>
        <UiFormField
          field-id="user-especialidades"
          label="Especialidades"
          :error="err('especialidades')"
        >
          <input
            id="user-especialidades"
            v-model="form.especialidades"
            aria-label="Especialidades"
            type="text"
            maxlength="1000"
            placeholder="Ej. Fades, barba, color…"
            :class="inputClass('especialidades')"
          >
        </UiFormField>
        <UiFormField
          field-id="user-descripcion"
          label="Descripción (perfil público)"
          :error="err('descripcion')"
        >
          <textarea
            id="user-descripcion"
            v-model="form.descripcion"
            aria-label="Descripción (perfil público)"
            rows="3"
            maxlength="1000"
            :class="inputClass('descripcion')"
          />
        </UiFormField>
        <UiImageUpload
          id="user-foto"
          v-model="form.fotoFile"
          label="Foto (opcional)"
          :current-url="barberProfile?.foto_url"
          :error="err('foto')"
          round
        />
        <UiFormField
          field-id="user-comision"
          label="Comisión (% sobre el precio de lista)"
          :error="err('comision_pct')"
        >
          <input
            id="user-comision"
            v-model.number="form.comisionPct"
            aria-label="Comisión (% sobre el precio de lista)"
            type="number"
            min="0"
            max="100"
            step="1"
            :class="inputClass('comision_pct')"
          >
        </UiFormField>
        <UiSwitch
          v-model="form.activo"
          label="Activo"
          description="Visible en el catálogo público"
        />
      </section>

      <section class="ub-form-section space-y-4" aria-labelledby="sec-sec">
        <div>
          <p id="sec-sec" class="ub-form-section__title">Seguridad</p>
          <p class="mt-1 ub-form-help">
            {{
              editing
                ? "Déjala vacía para conservar la contraseña actual."
                : "Usa al menos 8 caracteres y confirma la contraseña."
            }}
          </p>
        </div>
        <UiFormField
          field-id="user-password"
          :label="editing ? 'Nueva contraseña (opcional)' : 'Contraseña'"
          :error="err('password')"
        >
          <input
            id="user-password"
            v-model="form.password"
            :aria-label="editing ? 'Nueva contraseña (opcional)' : 'Contraseña'"
            type="password"
            :required="!editing"
            minlength="8"
            autocomplete="new-password"
            :aria-invalid="!!err('password')"
            :aria-describedby="err('password') ? 'user-password-error' : undefined"
            :class="inputClass('password')"
          >
        </UiFormField>
        <UiFormField
          v-if="!editing || form.password"
          id="user-password-confirmation"
          label="Confirmar contraseña"
          :error="err('password_confirmation')"
        >
          <input
            id="user-password-confirmation"
            v-model="form.password_confirmation"
            aria-label="Confirmar contraseña"
            type="password"
            :required="!editing || !!form.password"
            minlength="8"
            autocomplete="new-password"
            :aria-invalid="!!err('password_confirmation')"
            :aria-describedby="
              err('password_confirmation')
                ? 'user-password-confirmation-error'
                : undefined
            "
            :class="inputClass('password_confirmation')"
          >
        </UiFormField>
      </section>

      <p v-if="formError" role="alert" class="text-sm text-danger">
        {{ formError }}
      </p>
    </form>

    <template #footer>
      <button
        type="submit"
        form="user-form"
        :disabled="saving"
        class="ui-btn min-h-11 flex-1 px-4"
      >
        {{ saving ? "Guardando…" : "Guardar" }}
      </button>
      <button
        type="button"
        :disabled="saving"
        class="ui-btn-secondary min-h-11 px-4"
        @click="emit('close')"
      >
        Cancelar
      </button>
    </template>
  </UiFormSheet>
</template>
