<script setup lang="ts">
definePageMeta({ middleware: "auth", layout: false });

interface ProfileResponse {
  user: {
    name: string;
    email: string;
    client: { telefono: string | null; fecha_nacimiento: string | null } | null;
  };
}

const { apiFetch } = useApi();
const { user, fetchMe } = useAuth();
const telefono = ref("");
const fechaNacimiento = ref("");
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref("");

onMounted(async () => {
  try {
    const profile = await apiFetch<ProfileResponse>("/profile");
    telefono.value = profile.user.client?.telefono ?? "";
    fechaNacimiento.value = profile.user.client?.fecha_nacimiento ?? "";
  } catch {
    errorMessage.value = "No se pudo cargar tu perfil.";
  } finally {
    loading.value = false;
  }
});

async function submit() {
  saving.value = true;
  errorMessage.value = "";

  try {
    await apiFetch("/profile", {
      method: "PUT",
      body: {
        telefono: telefono.value,
        fecha_nacimiento: fechaNacimiento.value,
      },
    });
    await fetchMe();
    await navigateTo("/dashboard", { replace: true });
  } catch (error: unknown) {
    const data = (
      error as {
        data?: { message?: string; errors?: Record<string, string[]> };
      }
    )?.data;
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
            class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
          >
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
            class="w-full rounded-lg border border-line bg-main px-3 py-2 text-ink focus:border-gold focus:outline-none"
          >
        </div>
        <p v-if="errorMessage" class="text-sm text-red-400">
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
