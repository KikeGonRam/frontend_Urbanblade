import type { Ref } from "vue";
import type { ApiErrorData, BarberProfileResponse, FieldErrors } from "~/types/profile";

export interface BarberPublicProfile {
  barberProfile: Ref<BarberProfileResponse | null>;
  barberSpecialties: Ref<string>;
  barberDescription: Ref<string>;
  barberPhoto: Ref<File | null>;
  barberPhotoPreview: Ref<string | null>;
  barberSaving: Ref<boolean>;
  barberMessage: Ref<string>;
  barberError: Ref<string>;
  barberFieldErrors: Ref<FieldErrors>;
  /** Trae GET /barber/me; lanza si la API falla. */
  loadBarberProfile: () => Promise<void>;
  selectBarberPhoto: (event: Event) => void;
  submitBarberProfile: () => Promise<void>;
}

/** Ficha pública del barbero (especialidades, presentación y foto). */
export function useBarberPublicProfile(): BarberPublicProfile {
  const { apiFetch } = useApi();

  const barberProfile = ref<BarberProfileResponse | null>(null);
  const barberSpecialties = ref("");
  const barberDescription = ref("");
  const barberPhoto = ref<File | null>(null);
  const barberPhotoPreview = ref<string | null>(null);
  const barberSaving = ref(false);
  const barberMessage = ref("");
  const barberError = ref("");
  const barberFieldErrors = ref<FieldErrors>({});

  async function loadBarberProfile() {
    const barber = await apiFetch<BarberProfileResponse>("/barber/me");
    barberProfile.value = barber;
    barberSpecialties.value = barber.especialidades;
    barberDescription.value = barber.descripcion;
  }

  function selectBarberPhoto(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (file && file.size <= 4 * 1024 * 1024) {
      barberPhoto.value = file;
      barberPhotoPreview.value = URL.createObjectURL(file);
    }
  }

  async function submitBarberProfile() {
    if (barberSaving.value) return;
    barberSaving.value = true;
    barberMessage.value = "";
    barberError.value = "";
    barberFieldErrors.value = {};
    try {
      const body = new FormData();
      body.append("especialidades", barberSpecialties.value);
      body.append("descripcion", barberDescription.value);
      if (barberPhoto.value) body.append("foto", barberPhoto.value);
      const response = await apiFetch<
        Pick<
          BarberProfileResponse,
          "especialidades" | "descripcion" | "foto_url"
        > & { message: string }
      >("/barber/profile", {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      barberSpecialties.value = response.especialidades;
      barberDescription.value = response.descripcion;
      if (barberProfile.value) barberProfile.value.foto_url = response.foto_url;
      barberPhoto.value = null;
      barberPhotoPreview.value = null;
      barberMessage.value = response.message;
    } catch (error: unknown) {
      const data = (error as { data?: ApiErrorData })?.data;
      barberFieldErrors.value = data?.errors ?? {};
      barberError.value =
        data?.message ?? "No se pudo guardar tu perfil público.";
    } finally {
      barberSaving.value = false;
    }
  }

  return {
    barberProfile,
    barberSpecialties,
    barberDescription,
    barberPhoto,
    barberPhotoPreview,
    barberSaving,
    barberMessage,
    barberError,
    barberFieldErrors,
    loadBarberProfile,
    selectBarberPhoto,
    submitBarberProfile,
  };
}
