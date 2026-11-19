<script setup lang="ts">
import type { FieldErrors } from "~/types/profile";

defineProps<{
  isClient: boolean;
  fieldErrors: FieldErrors;
  message: string;
  errorMessage: string;
  saving: boolean;
}>();
const emit = defineEmits<{ submit: [] }>();
const name = defineModel<string>("name", { required: true });
const email = defineModel<string>("email", { required: true });
const telefono = defineModel<string>("telefono", { required: true });
const fechaNacimiento = defineModel<string>("fechaNacimiento", { required: true });
const sexo = defineModel<string>("sexo", { required: true });
</script>

<template>
  <form
    class="profile-panel ui-card space-y-6 p-5 sm:p-7"
    @submit.prevent="emit('submit')"
  >
    <header>
      <p class="ub-form-kicker">Información de cuenta</p>
      <h2 class="mt-2 text-xl font-black text-ink">
        Tu identidad en UrbanBlade
      </h2>
      <p class="mt-1 ub-form-help max-w-prose">
        Mantén tus datos actualizados para que tus reservas y comunicaciones
        sean correctas.
      </p>
    </header>

    <div class="ub-form-section">
      <label for="profile-name" class="ub-form-label"
        >Nombre completo</label
      >
      <input
        id="profile-name"
        v-model="name"
        required
        maxlength="255"
        :aria-invalid="!!fieldErrors.name"
        :aria-describedby="
          fieldErrors.name ? 'profile-name-error' : 'profile-name-help'
        "
        :class="[
          'ui-input w-full',
          fieldErrors.name ? 'border-danger/60 focus:border-danger' : '',
        ]"
      >
      <p id="profile-name-help" class="ub-form-help">
        Cómo aparecerá en recibos, citas y tu perfil público.
      </p>
      <p
        v-if="fieldErrors.name"
        id="profile-name-error"
        class="mt-1 text-xs text-danger"
      >
        {{ fieldErrors.name[0] }}
      </p>
    </div>

    <div class="ub-form-section">
      <label for="profile-email" class="ub-form-label"
        >Correo electrónico</label
      >
      <input
        id="profile-email"
        v-model="email"
        type="email"
        required
        maxlength="255"
        :aria-invalid="!!fieldErrors.email"
        :aria-describedby="
          fieldErrors.email ? 'profile-email-error' : 'profile-email-help'
        "
        :class="[
          'ui-input w-full',
          fieldErrors.email ? 'border-danger/60 focus:border-danger' : '',
        ]"
      >
      <p id="profile-email-help" class="ub-form-help">
        Lo usamos para iniciar sesión y enviarte confirmaciones de cita.
      </p>
      <p
        v-if="fieldErrors.email"
        id="profile-email-error"
        class="mt-1 text-xs text-danger"
      >
        {{ fieldErrors.email[0] }}
      </p>
    </div>

    <template v-if="isClient">
      <div class="ub-form-section">
        <p class="ub-form-section__title">Datos de cliente</p>
        <div class="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label for="profile-phone" class="ub-form-label"
              >Teléfono</label
            >
            <input
              id="profile-phone"
              v-model="telefono"
              type="tel"
              maxlength="30"
              placeholder="Ej. +52 55 1234 5678"
              autocomplete="tel"
              :aria-invalid="!!fieldErrors.telefono"
              :aria-describedby="
                fieldErrors.telefono
                  ? 'profile-phone-error'
                  : 'profile-phone-help'
              "
              :class="[
                'ui-input w-full',
                fieldErrors.telefono
                  ? 'border-danger/60 focus:border-danger'
                  : '',
              ]"
            >
            <p id="profile-phone-help" class="ub-form-help">
              Opcional. Si dejas tu número, el local puede llamarte ante un
              cambio.
            </p>
            <p
              v-if="fieldErrors.telefono"
              id="profile-phone-error"
              class="mt-1 text-xs text-danger"
            >
              {{ fieldErrors.telefono[0] }}
            </p>
          </div>
          <div>
            <label for="profile-birthday" class="ub-form-label"
              >Fecha de nacimiento</label
            >
            <input
              id="profile-birthday"
              v-model="fechaNacimiento"
              type="date"
              autocomplete="bday"
              :aria-invalid="!!fieldErrors.fecha_nacimiento"
              :aria-describedby="
                fieldErrors.fecha_nacimiento
                  ? 'profile-birthday-error'
                  : undefined
              "
              :class="[
                'ui-input w-full',
                fieldErrors.fecha_nacimiento
                  ? 'border-danger/60 focus:border-danger'
                  : '',
              ]"
            >
            <p
              v-if="fieldErrors.fecha_nacimiento"
              id="profile-birthday-error"
              class="mt-1 text-xs text-danger"
            >
              {{ fieldErrors.fecha_nacimiento[0] }}
            </p>
          </div>
          <div>
            <label for="profile-sex" class="ub-form-label"
              >Sexo
              <span class="font-normal normal-case tracking-normal"
                >(opcional)</span
              ></label
            >
            <select
              id="profile-sex"
              v-model="sexo"
              :aria-invalid="!!fieldErrors.sexo"
              :aria-describedby="
                fieldErrors.sexo ? 'profile-sex-error' : undefined
              "
              :class="[
                'ui-input w-full',
                fieldErrors.sexo
                  ? 'border-danger/60 focus:border-danger'
                  : '',
              ]"
            >
              <option value="">Sin especificar</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="prefiero_no_decir">Prefiero no decirlo</option>
            </select>
            <p
              v-if="fieldErrors.sexo"
              id="profile-sex-error"
              class="mt-1 text-xs text-danger"
            >
              {{ fieldErrors.sexo[0] }}
            </p>
          </div>
        </div>
      </div>
    </template>

    <div
      v-else
      class="rounded-xl border border-line bg-main/40 p-3.5 text-xs text-muted"
    >
      Teléfono, fecha de nacimiento y sexo pertenecen al perfil de cliente.
      Tu rol actual conserva aquí únicamente nombre y correo.
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
        :disabled="saving"
        class="ui-btn px-5 py-2.5 text-sm disabled:opacity-50"
      >
        {{ saving ? "Guardando cambios…" : "Guardar cambios" }}
      </button>
    </footer>
  </form>
</template>
