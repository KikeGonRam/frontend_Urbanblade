import type { ComputedRef, Ref } from "vue";
import type { ApiErrorData, FieldErrors } from "~/types/profile";

export interface ProfilePassword {
  currentPassword: Ref<string>;
  newPassword: Ref<string>;
  newPasswordConfirmation: Ref<string>;
  savingPassword: Ref<boolean>;
  passwordMessage: Ref<string>;
  passwordErrorMessage: Ref<string>;
  passwordFieldErrors: Ref<FieldErrors>;
  passwordMismatch: ComputedRef<boolean>;
  submitChangePassword: () => Promise<void>;
}

/** Cambio de contraseña desde la sección de seguridad. */
export function useProfilePassword(): ProfilePassword {
  const { apiFetch } = useApi();

  const currentPassword = ref("");
  const newPassword = ref("");
  const newPasswordConfirmation = ref("");
  const savingPassword = ref(false);
  const passwordMessage = ref("");
  const passwordErrorMessage = ref("");
  const passwordFieldErrors = ref<FieldErrors>({});

  const passwordMismatch = computed(
    () =>
      !!(
        newPassword.value &&
        newPasswordConfirmation.value &&
        newPassword.value !== newPasswordConfirmation.value
      ),
  );

  async function submitChangePassword() {
    if (savingPassword.value) return;
    passwordMessage.value = "";
    passwordErrorMessage.value = "";
    passwordFieldErrors.value = {};

    const clientErrors: FieldErrors = {};
    if (!currentPassword.value)
      clientErrors.current_password = ["Ingresa tu contraseña actual."];
    if (!newPassword.value)
      clientErrors.password = ["Ingresa una nueva contraseña."];
    else if (newPassword.value.length < 8)
      clientErrors.password = ["La contraseña debe tener al menos 8 caracteres."];
    if (!newPasswordConfirmation.value)
      clientErrors.password_confirmation = ["Confirma la nueva contraseña."];
    else if (passwordMismatch.value)
      clientErrors.password_confirmation = ["Las contraseñas no coinciden."];

    if (Object.keys(clientErrors).length) {
      passwordFieldErrors.value = clientErrors;
      return;
    }

    savingPassword.value = true;

    try {
      const response = await apiFetch<{ message: string }>("/profile/password", {
        method: "PUT",
        body: {
          current_password: currentPassword.value,
          password: newPassword.value,
          password_confirmation: newPasswordConfirmation.value,
        },
      });
      passwordMessage.value = response.message;
      currentPassword.value = "";
      newPassword.value = "";
      newPasswordConfirmation.value = "";
    } catch (error: unknown) {
      const data = (error as { data?: ApiErrorData })?.data;
      if (data?.errors) {
        passwordFieldErrors.value = data.errors;
      }
      passwordErrorMessage.value =
        data?.message ?? "No se pudo actualizar la contraseña.";
    } finally {
      savingPassword.value = false;
    }
  }

  return {
    currentPassword,
    newPassword,
    newPasswordConfirmation,
    savingPassword,
    passwordMessage,
    passwordErrorMessage,
    passwordFieldErrors,
    passwordMismatch,
    submitChangePassword,
  };
}
