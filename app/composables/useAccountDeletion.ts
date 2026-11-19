import type { Ref } from "vue";

export interface AccountDeletion {
  showDeleteModal: Ref<boolean>;
  deletePassword: Ref<string>;
  deleting: Ref<boolean>;
  deleteError: Ref<string>;
  viaGoogle: Ref<boolean>;
  openDeleteModal: () => Promise<void>;
  submitDeleteAccount: () => Promise<void>;
}

/** Eliminación de la cuenta desde la zona de peligro (contraseña, o «ELIMINAR» si entró con Google). */
export function useAccountDeletion(): AccountDeletion {
  const { apiFetch } = useApi();
  const { logout } = useAuth();

  const showDeleteModal = ref(false);
  const deletePassword = ref("");
  const deleting = ref(false);
  const deleteError = ref("");

  // Quien entró con Google no conoce su contraseña (se genera al azar): en una sesión abierta con
  // Google se confirma escribiendo ELIMINAR. /auth/me dice cómo se abrió la sesión.
  const viaGoogle = ref(false);
  async function openDeleteModal() {
    deletePassword.value = "";
    deleteError.value = "";
    showDeleteModal.value = true;
    try {
      viaGoogle.value =
        (await apiFetch<{ sesion_con_google?: boolean }>("/auth/me"))
          .sesion_con_google === true;
    } catch {
      viaGoogle.value = false;
    }
  }

  async function submitDeleteAccount() {
    if (!deletePassword.value) {
      deleteError.value = viaGoogle.value
        ? "Escribe ELIMINAR para confirmar."
        : "Ingresa tu contraseña para confirmar la eliminación.";
      return;
    }

    deleting.value = true;
    deleteError.value = "";

    try {
      await apiFetch("/profile", {
        method: "DELETE",
        body: viaGoogle.value
          ? { confirmacion: deletePassword.value.trim() }
          : { password: deletePassword.value },
      });
      await logout();
      await navigateTo("/login", { replace: true });
    } catch (error: unknown) {
      const data = (error as { data?: { message?: string } })?.data;
      deleteError.value =
        data?.message ??
        (viaGoogle.value
          ? "No se pudo eliminar tu cuenta."
          : "No se pudo eliminar tu cuenta. Verifica tu contraseña.");
    } finally {
      deleting.value = false;
    }
  }

  return {
    showDeleteModal,
    deletePassword,
    deleting,
    deleteError,
    viaGoogle,
    openDeleteModal,
    submitDeleteAccount,
  };
}
