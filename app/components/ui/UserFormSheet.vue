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

// ── Presentación: tarjetas de rol, avance, fuerza de contraseña y vista previa ──
const ROLE_META: Record<string, { icon: string; detail: string }> = {
  administrador: { icon: "shield", detail: "Acceso total al sistema" },
  recepcionista: { icon: "headset", detail: "Citas, cobros y clientes" },
  barbero: { icon: "scissors", detail: "Agenda, perfil público y comisión" },
  cliente: { icon: "user", detail: "Reserva y compra desde su cuenta" },
};
const roleOptions = computed(() =>
  props.roles.map((r) => ({
    value: r,
    title: props.roleLabel[r] ?? r,
    detail: ROLE_META[r]?.detail,
    icon: ROLE_META[r]?.icon ?? "user",
  })),
);

const showPassword = ref(false);
/** Correo con forma válida: una sola @, dominio con punto y sin espacios (sin regex con retroceso). */
function isEmail(value: string) {
  const parts = value.split("@");
  if (parts.length !== 2 || /\s/.test(value)) return false;
  const [local, domain] = parts;
  return (
    !!local &&
    domain.includes(".") &&
    !domain.startsWith(".") &&
    !domain.endsWith(".")
  );
}
const emailValid = computed(() => isEmail(form.email));
const emailBad = computed(() => !!form.email && !emailValid.value);
const strength = computed(() => {
  const pass = form.password;
  if (!pass) return 0;
  let n = 0;
  if (pass.length >= 8) n++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) n++;
  if (/\d/.test(pass)) n++;
  if (/[^A-Za-z0-9]/.test(pass) && pass.length >= 10) n++;
  return Math.max(1, n);
});
const STRENGTH_TEXT = [
  "",
  "Débil: agrega mayúsculas y números.",
  "Media: suma un número o símbolo.",
  "Buena contraseña.",
  "Excelente.",
];
const strengthText = computed(
  () =>
    STRENGTH_TEXT[strength.value] ||
    (props.editing
      ? "Déjala vacía para conservar la actual."
      : "Usa al menos 8 caracteres."),
);
const roleFieldFilled = computed(() => {
  if (isBarber.value) return !!form.especialidades.trim();
  if (isClient.value) return !!form.telefono.trim();
  return true;
});
const progress = computed(() => {
  const need = [
    !!form.name.trim(),
    emailValid.value,
    props.editing ? true : form.password.length >= 8,
    roleFieldFilled.value,
  ];
  return Math.round((need.filter(Boolean).length / need.length) * 100);
});
const initials = computed(
  () =>
    form.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "—",
);

// ── Perfiles y guardado ─────────────────────────────────────────────────────
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
    icon="users"
    subtitle="Un solo formulario para el equipo y los clientes: según el rol aparecen sus campos."
    :badge="editing ? 'Edición' : 'Alta'"
    :progress="progress"
    form-id="user-form"
    :submit-label="editing ? 'Guardar cambios' : 'Crear persona'"
    hint="Se guarda con un solo clic"
    :busy="saving"
    @close="emit('close')"
  >
    <form id="user-form" class="space-y-6" @submit.prevent="submit">
      <section class="space-y-3" aria-labelledby="sec-role">
        <p id="sec-role" class="ub-form-section__title">Rol</p>
        <UiChoiceCards
          v-model="form.role"
          label="Rol"
          hide-label
          :options="roleOptions"
          :columns="2"
        />
      </section>

      <section class="space-y-4" aria-labelledby="sec-id">
        <p id="sec-id" class="ub-form-section__title">Identidad</p>
        <UiFormField field-id="user-name" label="Nombre completo" icon="user" :error="err('name')">
          <input
            id="user-name"
            v-model="form.name"
            aria-label="Nombre"
            type="text"
            required
            autocomplete="off"
            placeholder="Ej. Luis Hernández"
            :aria-invalid="!!err('name')"
            :aria-describedby="err('name') ? 'user-name-error' : undefined"
            :class="inputClass('name')"
          >
        </UiFormField>
        <UiFormField
          field-id="user-email"
          label="Correo"
          icon="mail"
          :error="err('email') || (emailBad ? 'Escribe un correo válido, por ejemplo nombre@correo.com.' : null)"
        >
          <input
            id="user-email"
            v-model="form.email"
            aria-label="Email"
            type="email"
            required
            autocomplete="off"
            placeholder="nombre@correo.com"
            :aria-invalid="!!err('email') || emailBad"
            :aria-describedby="err('email') || emailBad ? 'user-email-error' : undefined"
            :class="inputClass('email')"
          >
        </UiFormField>
        <div class="ub-uprev" aria-label="Vista previa en la lista">
          <span class="ub-uprev__avatar">{{ initials }}</span>
          <span class="min-w-0 flex-1">
            <b class="block truncate text-sm text-ink">{{ form.name || "Nombre de la persona" }}</b>
            <small class="block truncate text-xs text-muted">{{ form.email || "correo@ejemplo.com" }}</small>
          </span>
          <span class="ub-uprev__pill">{{ roleLabel[form.role] ?? form.role }}</span>
        </div>
      </section>

      <section v-if="isClient" class="space-y-4" aria-labelledby="sec-client">
        <p id="sec-client" class="ub-form-section__title">Datos del cliente</p>
        <p v-if="loadingProfile" class="ub-form-help">Cargando perfil…</p>
        <UiFormField field-id="user-telefono" label="Teléfono" icon="phone" :error="err('telefono')">
          <input
            id="user-telefono"
            v-model="form.telefono"
            aria-label="Teléfono"
            type="tel"
            autocomplete="tel"
            placeholder="55 1234 5678"
            :aria-invalid="!!err('telefono')"
            :aria-describedby="err('telefono') ? 'user-telefono-error' : undefined"
            :class="inputClass('telefono')"
          >
        </UiFormField>
      </section>

      <section v-if="isBarber" class="space-y-4" aria-labelledby="sec-barber">
        <p id="sec-barber" class="ub-form-section__title">Perfil del barbero</p>
        <p v-if="loadingProfile" class="ub-form-help">Cargando perfil…</p>
        <UiFormField field-id="user-especialidades" label="Especialidades" icon="scissors" :error="err('especialidades')">
          <input
            id="user-especialidades"
            v-model="form.especialidades"
            aria-label="Especialidades"
            type="text"
            maxlength="1000"
            placeholder="Fades, barba, color…"
            :class="inputClass('especialidades')"
          >
        </UiFormField>
        <UiFormField field-id="user-descripcion" label="Descripción (perfil público)" icon="text" top :error="err('descripcion')">
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
        <UiFormField field-id="user-comision" label="Comisión (% sobre el precio de lista)" icon="percent" :error="err('comision_pct')">
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
        <UiSwitch v-model="form.activo" label="Activo" description="Visible en el catálogo público" />
      </section>

      <section class="space-y-4" aria-labelledby="sec-sec">
        <p id="sec-sec" class="ub-form-section__title">Seguridad</p>
        <UiFormField
          field-id="user-password"
          :label="editing ? 'Nueva contraseña (opcional)' : 'Contraseña'"
          icon="lock"
          :error="err('password')"
          :hint="strengthText"
        >
          <input
            id="user-password"
            v-model="form.password"
            :aria-label="editing ? 'Nueva contraseña (opcional)' : 'Contraseña'"
            :type="showPassword ? 'text' : 'password'"
            :required="!editing"
            minlength="8"
            autocomplete="new-password"
            placeholder="Mínimo 8 caracteres"
            :aria-invalid="!!err('password')"
            :aria-describedby="err('password') ? 'user-password-error' : undefined"
            :class="inputClass('password')"
          >
          <button
            type="button"
            class="ub-eye"
            :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <UiIcon name="eye" />
          </button>
        </UiFormField>
        <div class="ub-meter" :data-s="strength" aria-hidden="true"><i /><i /><i /><i /></div>
        <UiFormField
          v-if="!editing || form.password"
          field-id="user-password-confirmation"
          label="Confirmar contraseña"
          icon="lock"
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
            :aria-describedby="err('password_confirmation') ? 'user-password-confirmation-error' : undefined"
            :class="inputClass('password_confirmation')"
          >
        </UiFormField>
      </section>

      <p v-if="formError" role="alert" class="text-sm text-danger">{{ formError }}</p>
    </form>
  </UiFormSheet>
</template>

<style scoped>
.ub-uprev {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem;
  border: 1px dashed var(--line);
  border-radius: 0.875rem;
  background: linear-gradient(135deg, rgb(var(--gold-rgb) / 0.1), transparent 60%);
}
.ub-uprev__avatar {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: var(--gold);
  color: #1a1405;
  font-weight: 800;
  flex: none;
}
.ub-uprev__pill {
  border-radius: 9999px;
  background: rgb(var(--gold-rgb) / 0.14);
  color: var(--gold-text);
  padding: 0.25rem 0.6rem;
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.ub-eye {
  position: absolute;
  right: 0.35rem;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  color: var(--muted);
}
.ub-eye:hover,
.ub-eye[aria-pressed="true"] {
  color: var(--gold-text);
}
.ub-meter {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.3rem;
  margin-top: -0.5rem;
}
.ub-meter i {
  height: 0.25rem;
  border-radius: 0.2rem;
  background: var(--line);
  transition: background-color 0.2s ease;
}
.ub-meter[data-s="1"] i:nth-child(-n + 1) {
  background: #ea6d56;
}
.ub-meter[data-s="2"] i:nth-child(-n + 2) {
  background: var(--gold);
}
.ub-meter[data-s="3"] i:nth-child(-n + 3),
.ub-meter[data-s="4"] i {
  background: #74c493;
}
</style>
