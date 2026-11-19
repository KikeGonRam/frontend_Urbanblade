import type { Ref } from "vue";
import type { ApiErrorData, FieldErrors, ProfileResponse, UpdateResponse } from "~/types/profile";

export interface ProfileForm {
  name: Ref<string>;
  email: Ref<string>;
  telefono: Ref<string>;
  fechaNacimiento: Ref<string>;
  sexo: Ref<string>;
  loading: Ref<boolean>;
  saving: Ref<boolean>;
  message: Ref<string>;
  errorMessage: Ref<string>;
  fieldErrors: Ref<FieldErrors>;
  profileComplete: Ref<boolean>;
  profileMissing: Ref<string[]>;
  /** Trae GET /profile y rellena los campos; lanza si la API falla (la página decide el mensaje). */
  loadProfile: () => Promise<void>;
  submitProfile: () => Promise<void>;
}

/** Datos personales de la cuenta (nombre, correo y, para clientes, teléfono/nacimiento/sexo). */
export function useProfileForm(): ProfileForm {
  const { apiFetch } = useApi();
  const { user } = useAuth();

  const name = ref("");
  const email = ref("");
  const telefono = ref("");
  const fechaNacimiento = ref("");
  const sexo = ref("");
  const loading = ref(true);
  const saving = ref(false);
  const message = ref("");
  const errorMessage = ref("");
  const fieldErrors = ref<FieldErrors>({});
  const profileComplete = ref(false);
  const profileMissing = ref<string[]>([]);

  async function loadProfile() {
    const response = await apiFetch<ProfileResponse>("/profile");
    name.value = response.user.name;
    email.value = response.user.email;
    telefono.value = response.user.client?.telefono ?? "";
    fechaNacimiento.value = response.user.client?.fecha_nacimiento ?? "";
    sexo.value = response.user.client?.sexo ?? "";
    profileComplete.value = response.user.profile_complete ?? false;
    profileMissing.value = response.user.profile_missing ?? [];
  }

  async function submitProfile() {
    if (saving.value) return;
    message.value = "";
    errorMessage.value = "";
    fieldErrors.value = {};

    const clientErrors: FieldErrors = {};
    if (!name.value.trim()) clientErrors.name = ["El nombre es obligatorio."];
    if (!email.value.trim()) clientErrors.email = ["El correo es obligatorio."];
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
      clientErrors.email = ["Ingresa un correo válido."];

    if (Object.keys(clientErrors).length) {
      fieldErrors.value = clientErrors;
      return;
    }

    saving.value = true;

    try {
      const response = await apiFetch<UpdateResponse>("/profile", {
        method: "PUT",
        body: {
          name: name.value,
          email: email.value,
          telefono: telefono.value || null,
          fecha_nacimiento: fechaNacimiento.value || null,
          sexo: sexo.value || null,
        },
      });
      user.value = response.user;
      telefono.value = response.user?.client?.telefono ?? telefono.value;
      fechaNacimiento.value =
        response.user?.client?.fecha_nacimiento ?? fechaNacimiento.value;
      sexo.value = response.user?.client?.sexo ?? sexo.value;
      message.value = response.message;
    } catch (error: unknown) {
      const data = (error as { data?: ApiErrorData })?.data;
      if (data?.errors) {
        fieldErrors.value = data.errors;
      }
      errorMessage.value =
        data?.message ??
        "No se pudo guardar tu perfil. Revisa los campos marcados.";
    } finally {
      saving.value = false;
    }
  }

  return {
    name,
    email,
    telefono,
    fechaNacimiento,
    sexo,
    loading,
    saving,
    message,
    errorMessage,
    fieldErrors,
    profileComplete,
    profileMissing,
    loadProfile,
    submitProfile,
  };
}
