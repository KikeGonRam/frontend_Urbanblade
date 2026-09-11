<script setup lang="ts">
definePageMeta({ middleware: "auth", layout: false });

interface ProfileResponse {
  user: {
    name: string;
    email: string;
    client: {
      telefono: string | null;
      fecha_nacimiento: string | null;
      sexo: string | null;
    } | null;
  };
}

const { apiFetch } = useApi();
const route = useRoute();
const authReturn = useAuthReturn();
const { user, fetchMe } = useAuth();
const telefono = ref("");
const fechaNacimiento = ref("");
const sexo = ref("");
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref("");
const fieldErrors = ref<Record<string, string[]>>({});

onMounted(async () => {
  try {
    const profile = await apiFetch<ProfileResponse>("/profile");
    telefono.value = profile.user.client?.telefono ?? "";
    fechaNacimiento.value = profile.user.client?.fecha_nacimiento ?? "";
    sexo.value = profile.user.client?.sexo ?? "";
  } catch {
    errorMessage.value = "No se pudo cargar tu perfil.";
  } finally {
    loading.value = false;
  }
});

async function submit() {
  saving.value = true;
  errorMessage.value = "";
  fieldErrors.value = {};

  try {
    await apiFetch("/profile", {
      method: "PUT",
      body: {
        telefono: telefono.value,
        fecha_nacimiento: fechaNacimiento.value,
        sexo: sexo.value || null,
      },
    });
    const updated = await fetchMe();
    if (!updated?.profile_complete) {
      errorMessage.value = "Tu perfil aún no está completo. Revisa los campos antes de continuar.";
      return;
    }
    await navigateTo(authReturn.afterLogin(true, route.query.redirect), { replace: true });
  } catch (error: unknown) {
    const data = (
      error as {
        data?: { message?: string; errors?: Record<string, string[]> };
      }
    )?.data;
    fieldErrors.value = data?.errors ?? {};
    errorMessage.value = data?.errors
      ? (Object.values(data.errors).flat()[0] ?? data.message ?? "")
      : (data?.message ?? "No se pudo guardar tu perfil.");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main
    class="flex min-h-screen items-center justify-center bg-main p-6 text-ink"
  >
    <section
      class="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl"
    >
      <div class="mb-6 flex items-center gap-3">
        <img
          v-if="user?.avatar_url"
          :src="user.avatar_url"
          :alt="`Foto de ${user.name}`"
          class="h-12 w-12 rounded-full object-cover"
        >
        <div>
          <p
            class="text-[10px] font-black uppercase tracking-[0.18em] text-gold"
          >
            Un último paso
          </p>
          <h1 class="mt-1 text-xl font-semibold">Completa tu perfil</h1>
        </div>
      </div>

      <p class="mb-6 text-sm leading-6 text-muted">
        Necesitamos estos datos para que puedas reservar citas y mantener tu
        cuenta actualizada.
      </p>

      <p v-if="loading" class="text-sm text-muted">Cargando perfil…</p>
      <form v-else class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="telefono" class="mb-1 block text-sm text-muted"
            >Teléfono</label
          >
          <input
            id="telefono"
            v-model="telefono"
            type="tel"
            required
            autocomplete="tel"
            placeholder="Tu número de teléfono"
            :aria-invalid="!!fieldErrors.telefono"
            :aria-describedby="fieldErrors.telefono ? 'telefono-error' : undefined"
            :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink transition-all duration-200 focus:outline-none', fieldErrors.telefono ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]' : 'border-line focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]']"
          >
          <p v-if="fieldErrors.telefono" id="telefono-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.telefono[0] }}</p>
        </div>
        <div>
          <label for="fecha-nacimiento" class="mb-1 block text-sm text-muted"
            >Fecha de nacimiento</label
          >
          <input
            id="fecha-nacimiento"
            v-model="fechaNacimiento"
            type="date"
            required
            autocomplete="bday"
            :aria-invalid="!!fieldErrors.fecha_nacimiento"
            :aria-describedby="fieldErrors.fecha_nacimiento ? 'fecha-nacimiento-error' : undefined"
            :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink transition-all duration-200 focus:outline-none', fieldErrors.fecha_nacimiento ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]' : 'border-line focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]']"
          >
          <p v-if="fieldErrors.fecha_nacimiento" id="fecha-nacimiento-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.fecha_nacimiento[0] }}</p>
        </div>
        <div>
          <label for="sexo" class="mb-1 block text-sm text-muted">Sexo (opcional)</label>
          <select
            id="sexo"
            v-model="sexo"
            :aria-invalid="!!fieldErrors.sexo"
            :aria-describedby="fieldErrors.sexo ? 'sexo-error' : 'sexo-help'"
            :class="['w-full rounded-lg border bg-main px-3 py-2 text-ink transition-all duration-200 focus:outline-none', fieldErrors.sexo ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]' : 'border-line focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]']"
          >
            <option value="">Sin especificar</option>
            <option value="masculino">Masculino</option>
            <option value="femenino">Femenino</option>
            <option value="prefiero_no_decir">Prefiero no decirlo</option>
          </select>
          <p v-if="fieldErrors.sexo" id="sexo-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.sexo[0] }}</p>
          <p v-else id="sexo-help" class="mt-1 text-xs text-muted">Google no comparte este dato con el acceso estándar; puedes elegirlo manualmente.</p>
        </div>
        <p v-if="errorMessage" role="alert" class="text-sm text-red-400">
          {{ errorMessage }}
        </p>
        <button
          type="submit"
          :disabled="saving"
          class="w-full rounded-lg bg-gold px-4 py-2 font-semibold text-black hover:bg-gold-dim disabled:opacity-50"
        >
          {{ saving ? "Guardando…" : "Guardar y continuar" }}
        </button>
      </form>
    </section>
  </main>
</template>
