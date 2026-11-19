<script setup lang="ts">
defineProps<{
  /** La sesión se abrió con Google: se confirma escribiendo ELIMINAR en vez de la contraseña. */
  viaGoogle: boolean;
  deleting: boolean;
  error: string;
}>();
const emit = defineEmits<{
  close: [];
  submit: [];
}>();
const password = defineModel<string>("password", { required: true });
</script>

<template>
  <UiModal
    title="Confirmar eliminación de cuenta"
    :busy="deleting"
    @close="emit('close')"
  >
    <h3 class="text-lg font-bold text-danger">
      ¿Estás seguro de eliminar tu cuenta?
    </h3>
    <p class="mt-2 text-sm text-muted">
      <template v-if="viaGoogle">
        Esta acción es irreversible. Entraste con Google, así que para
        confirmar escribe <strong class="text-ink">ELIMINAR</strong>.
      </template>
      <template v-else>
        Esta acción es irreversible. Para confirmar tu identidad, escribe tu
        contraseña actual.
      </template>
    </p>
    <p class="mt-2 text-xs text-muted">
      Se borran tu acceso y tus sesiones. El historial de citas y pagos
      puede conservarse como registro del negocio; si quieres que también se
      borre, pídelo por correo (ver Aviso de Privacidad).
    </p>

    <form class="mt-4 space-y-4" @submit.prevent="emit('submit')">
      <div>
        <label for="delete-account-password" class="ub-form-label">{{
          viaGoogle ? "Escribe ELIMINAR" : "Tu contraseña"
        }}</label>
        <input
          id="delete-account-password"
          v-model="password"
          :type="viaGoogle ? 'text' : 'password'"
          required
          autocomplete="off"
          :placeholder="viaGoogle ? 'ELIMINAR' : 'Ingresa tu contraseña'"
          class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink focus:border-danger focus:outline-none focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
        >
      </div>

      <p v-if="error" class="text-xs text-danger">
        {{ error }}
      </p>

      <div class="flex justify-end gap-3 pt-2">
        <button
          type="button"
          class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="deleting"
          class="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
        >
          {{ deleting ? "Eliminando…" : "Sí, eliminar cuenta" }}
        </button>
      </div>
    </form>
  </UiModal>
</template>
