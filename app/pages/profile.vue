<script setup lang="ts">
import type { ProfileSection } from "~/types/profile";

definePageMeta({ middleware: "auth", layout: "dashboard" });

useSeoMeta({ title: 'Mi perfil — UrbanBlade', robots: 'noindex' })

const { user } = useAuth();

// Cada sección vive en su composable (datos personales, foto, ficha pública del barbero,
// contraseña, eliminación de cuenta); esta página solo los carga y cablea la plantilla.
const {
  name, email, telefono, fechaNacimiento, sexo,
  loading, saving, message, errorMessage, fieldErrors, profileComplete, profileMissing,
  loadProfile, submitProfile,
} = useProfileForm();
const { selectedAvatar, avatarPreview, uploading, selectAvatar, uploadAvatar } =
  useAvatarUpload(message, errorMessage);
const {
  barberProfile, barberSpecialties, barberDescription, barberPhotoPreview,
  barberSaving, barberMessage, barberError, barberFieldErrors,
  loadBarberProfile, selectBarberPhoto, submitBarberProfile,
} = useBarberPublicProfile();
const {
  currentPassword, newPassword, newPasswordConfirmation, savingPassword,
  passwordMessage, passwordErrorMessage, passwordFieldErrors, passwordMismatch,
  submitChangePassword,
} = useProfilePassword();
const {
  showDeleteModal, deletePassword, deleting, deleteError, viaGoogle,
  openDeleteModal, submitDeleteAccount,
} = useAccountDeletion();

const activeSection = ref<ProfileSection>("personal");

const isAdministrator = computed(
  () => user.value?.roles?.includes("administrador") ?? false,
);
const isClient = computed(
  () => user.value?.roles?.includes("cliente") ?? false,
);
const isBarber = computed(
  () => user.value?.roles?.includes("barbero") ?? false,
);

onMounted(async () => {
  try {
    await loadProfile();
    if (user.value?.roles?.includes("barbero")) {
      await loadBarberProfile();
      activeSection.value = "public";
    }
  } catch {
    errorMessage.value = "No se pudo cargar tu perfil.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
    <ProfileHeader
      :name="name"
      :email="email"
      :avatar-url="user?.avatar_url"
      :avatar-preview="avatarPreview"
      :roles="user?.roles ?? []"
      :profile-complete="profileComplete"
      :profile-missing="profileMissing"
      :has-avatar-selection="!!selectedAvatar"
      :uploading="uploading"
      @select-avatar="selectAvatar"
      @upload-avatar="uploadAvatar"
    />

    <ProfileTabs v-model:section="activeSection" :is-barber="isBarber" />

    <div
      v-if="loading"
      class="flex items-center gap-3 py-12 text-sm text-muted"
    >
      <div
        class="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent"
      />
      <span>Cargando perfil…</span>
    </div>

    <template v-else>
      <ProfilePublicSection
        v-if="activeSection === 'public' && isBarber && barberProfile"
        v-model:specialties="barberSpecialties"
        v-model:description="barberDescription"
        :profile="barberProfile"
        :name="name"
        :photo-preview="barberPhotoPreview"
        :saving="barberSaving"
        :message="barberMessage"
        :error="barberError"
        :field-errors="barberFieldErrors"
        @select-photo="selectBarberPhoto"
        @submit="submitBarberProfile"
      />

      <ProfilePersonalSection
        v-if="activeSection === 'personal'"
        v-model:name="name"
        v-model:email="email"
        v-model:telefono="telefono"
        v-model:fecha-nacimiento="fechaNacimiento"
        v-model:sexo="sexo"
        :is-client="isClient"
        :field-errors="fieldErrors"
        :message="message"
        :error-message="errorMessage"
        :saving="saving"
        @submit="submitProfile"
      />

      <ProfileSecuritySection
        v-if="activeSection === 'security'"
        v-model:current-password="currentPassword"
        v-model:new-password="newPassword"
        v-model:new-password-confirmation="newPasswordConfirmation"
        :field-errors="passwordFieldErrors"
        :mismatch="passwordMismatch"
        :message="passwordMessage"
        :error-message="passwordErrorMessage"
        :saving="savingPassword"
        @submit="submitChangePassword"
      />

      <ProfileDangerSection
        v-if="activeSection === 'danger'"
        :is-administrator="isAdministrator"
        @open-delete="openDeleteModal"
      />

      <ProfileDeleteModal
        v-if="showDeleteModal"
        v-model:password="deletePassword"
        :via-google="viaGoogle"
        :deleting="deleting"
        :error="deleteError"
        @close="showDeleteModal = false"
        @submit="submitDeleteAccount"
      />
    </template>
  </div>
</template>
