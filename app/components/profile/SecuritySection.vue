<script setup lang="ts">
import type { FieldErrors } from "~/types/profile";

defineProps<{
  fieldErrors: FieldErrors;
  mismatch: boolean;
  message: string;
  errorMessage: string;
  saving: boolean;
}>();
const emit = defineEmits<{ submit: [] }>();
const currentPassword = defineModel<string>("currentPassword", { required: true });
const newPassword = defineModel<string>("newPassword", { required: true });
const newPasswordConfirmation = defineModel<string>("newPasswordConfirmation", { required: true });
</script>

<template>
  <form
    class="profile-panel ui-card space-y-6 p-5 sm:p-7"
    @submit.prevent="emit('submit')"
  >
    <header>
      <p class="ub-form-kicker">Seguridad</p>
      <h2 class="mt-2 text-xl font-black text-ink">
        Contraseña y acceso
      </h2>
      <p class="mt-1 ub-form-help max-w-prose">
        Usa al menos 8 caracteres. La nueva contraseña y su confirmación
        deben coincidir antes de enviarse.
      </p>
    </header>

    <div class="ub-form-section">
      <label for="current-password" class="ub-form-label"
        >Contraseña actual</label
      >
      <AuthPasswordField
        id="current-password"
        v-model="currentPassword"
        autocomplete="current-password"
        required
        :invalid="!!fieldErrors.current_password"
        :described-by="
          fieldErrors.current_password
            ? 'current-password-error'
            : undefined
        "
      />
      <p
        v-if="fieldErrors.current_password"
        id="current-password-error"
        class="mt-1 text-xs text-danger"
      >
        {{ fieldErrors.current_password[0] }}
      </p>
    </div>

    <div class="ub-form-section grid gap-4 sm:grid-cols-2">
      <div>
        <label for="new-password" class="ub-form-label"
          >Nueva contraseña</label
        >
        <AuthPasswordField
          id="new-password"
          v-model="newPassword"
          autocomplete="new-password"
          :minlength="8"
          required
          :invalid="!!fieldErrors.password"
          :described-by="
            fieldErrors.password ? 'new-password-error' : undefined
          "
        />
        <AuthPasswordStrength :password="newPassword" />
        <p class="ub-form-help">Mínimo 8 caracteres.</p>
        <p
          v-if="fieldErrors.password"
          id="new-password-error"
          class="mt-1 text-xs text-danger"
        >
          {{ fieldErrors.password[0] }}
        </p>
      </div>
      <div>
        <label for="new-password-confirmation" class="ub-form-label"
          >Confirmar nueva contraseña</label
        >
        <AuthPasswordField
          id="new-password-confirmation"
          v-model="newPasswordConfirmation"
          autocomplete="new-password"
          :minlength="8"
          required
          :invalid="
            !!fieldErrors.password_confirmation || mismatch
          "
          :described-by="
            fieldErrors.password_confirmation || mismatch
              ? 'new-password-confirmation-error'
              : undefined
          "
        />
        <p
          v-if="mismatch || fieldErrors.password_confirmation"
          id="new-password-confirmation-error"
          class="mt-1 text-xs text-danger"
        >
          {{
            fieldErrors.password_confirmation?.[0] ??
            "Las contraseñas no coinciden."
          }}
        </p>
      </div>
    </div>

    <p
      v-if="message"
      role="status"
      class="text-sm font-medium text-success"
    >
      {{ message }}
    </p>
    <p
      v-if="errorMessage"
      role="alert"
      class="text-sm font-medium text-danger"
    >
      {{ errorMessage }}
    </p>

    <footer
      class="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end"
    >
      <button
        type="submit"
        :disabled="saving || mismatch"
        class="ui-btn px-5 py-2.5 text-sm disabled:opacity-50"
      >
        {{ saving ? "Actualizando…" : "Actualizar contraseña" }}
      </button>
    </footer>
  </form>
</template>
