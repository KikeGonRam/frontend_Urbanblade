import type { Ref } from "vue";
import type { UpdateResponse } from "~/types/profile";

export interface AvatarUpload {
  selectedAvatar: Ref<File | null>;
  avatarPreview: Ref<string | null>;
  uploading: Ref<boolean>;
  selectAvatar: (event: Event) => void;
  uploadAvatar: () => Promise<void>;
}

/**
 * Foto de perfil de la cuenta. Comparte con el formulario de datos personales los mensajes de
 * éxito y error (se muestran juntos en esa sección).
 */
export function useAvatarUpload(
  message: Ref<string>,
  errorMessage: Ref<string>,
): AvatarUpload {
  const { apiFetch } = useApi();
  const { user } = useAuth();

  const selectedAvatar = ref<File | null>(null);
  const avatarPreview = ref<string | null>(null);
  const uploading = ref(false);

  function selectAvatar(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (file && file.size > 4 * 1024 * 1024) {
      errorMessage.value = "La imagen excede el límite máximo de 4 MB.";
      return;
    }
    selectedAvatar.value = file;
    avatarPreview.value = file ? URL.createObjectURL(file) : null;
  }

  async function uploadAvatar() {
    if (!selectedAvatar.value) return;

    uploading.value = true;
    errorMessage.value = "";
    try {
      const body = new FormData();
      body.append("avatar", selectedAvatar.value);
      const response = await apiFetch<UpdateResponse>("/profile/avatar", {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      user.value = response.user;
      selectedAvatar.value = null;
      avatarPreview.value = null;
      message.value = "Foto de perfil actualizada correctamente.";
    } catch (error: unknown) {
      const data = (error as { data?: { message?: string } })?.data;
      errorMessage.value = data?.message ?? "No se pudo actualizar la foto.";
    } finally {
      uploading.value = false;
    }
  }

  return { selectedAvatar, avatarPreview, uploading, selectAvatar, uploadAvatar };
}
