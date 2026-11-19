<script setup lang="ts">
import type { BarberProfileResponse, FieldErrors } from "~/types/profile";

defineProps<{
  profile: BarberProfileResponse;
  /** Nombre de la cuenta (alt de la foto pública). */
  name: string;
  photoPreview: string | null;
  saving: boolean;
  message: string;
  error: string;
  fieldErrors: FieldErrors;
}>();
const emit = defineEmits<{
  submit: [];
  "select-photo": [event: Event];
}>();
const specialties = defineModel<string>("specialties", { required: true });
const description = defineModel<string>("description", { required: true });
</script>

<template>
  <form
    class="profile-panel ui-card space-y-6 p-5 sm:p-7"
    @submit.prevent="emit('submit')"
  >
    <header
      class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <p class="ub-form-kicker">Perfil público</p>
        <h2 class="mt-2 text-lg font-black text-ink">
          Así te conocen tus clientes
        </h2>
        <p class="mt-1 ub-form-help max-w-prose">
          Esta información aparece en tu ficha pública y ayuda a elegirte
          para una reserva.
        </p>
      </div>
      <div class="flex gap-4 text-right text-xs text-muted">
        <span
          ><strong class="block text-lg text-ink">{{
            profile.portfolio_total
          }}</strong
          >trabajo{{ profile.portfolio_total === 1 ? "" : "s" }}</span
        >
        <span
          ><strong class="block text-lg text-ink">{{
            profile.total_resenas
          }}</strong
          >reseña{{ profile.total_resenas === 1 ? "" : "s" }}</span
        >
      </div>
    </header>

    <div class="ub-form-section">
      <label class="ub-form-label">Foto pública del barbero</label>
      <div class="flex flex-wrap items-center gap-3">
        <img
          v-if="photoPreview || profile.foto_url"
          :src="photoPreview || profile.foto_url || ''"
          :alt="`Foto pública de ${name}`"
          class="h-16 w-16 rounded-xl border border-line object-cover"
        >
        <label class="ui-btn-secondary cursor-pointer px-3 py-2 text-xs">
          Elegir imagen
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="sr-only"
            @change="emit('select-photo', $event)"
          >
        </label>
        <span class="ub-form-help">JPG, PNG o WebP · máximo 4 MB</span>
      </div>
      <p
        v-if="fieldErrors.foto"
        id="barber-foto-error"
        class="mt-1 text-xs text-danger"
      >
        {{ fieldErrors.foto[0] }}
      </p>
    </div>

    <div class="ub-form-section">
      <label for="barber-specialties" class="ub-form-label"
        >Especialidades</label
      >
      <input
        id="barber-specialties"
        v-model="specialties"
        maxlength="1000"
        placeholder="Ej. Degradados, diseños y barba clásica"
        :aria-invalid="!!fieldErrors.especialidades"
        :aria-describedby="
          fieldErrors.especialidades
            ? 'barber-especialidades-error'
            : undefined
        "
        :class="[
          'ui-input w-full',
          fieldErrors.especialidades
            ? 'border-danger/60 focus:border-danger'
            : '',
        ]"
      >
      <p class="ub-form-help">
        Sepáralas por comas para que se muestren como etiquetas en tu perfil
        público.
      </p>
      <p
        v-if="fieldErrors.especialidades"
        id="barber-especialidades-error"
        class="mt-1 text-xs text-danger"
      >
        {{ fieldErrors.especialidades[0] }}
      </p>
    </div>

    <div class="ub-form-section">
      <label for="barber-description" class="ub-form-label"
        >Presentación</label
      >
      <textarea
        id="barber-description"
        v-model="description"
        rows="4"
        maxlength="1000"
        placeholder="Cuéntales brevemente tu experiencia y el estilo de trabajo que te distingue."
        :aria-invalid="!!fieldErrors.descripcion"
        :aria-describedby="
          fieldErrors.descripcion
            ? 'barber-descripcion-error'
            : undefined
        "
        :class="[
          'ui-input w-full resize-y',
          fieldErrors.descripcion
            ? 'border-danger/60 focus:border-danger'
            : '',
        ]"
      />
      <div class="mt-1 flex justify-between gap-3 ub-form-help">
        <span
          v-if="fieldErrors.descripcion"
          id="barber-descripcion-error"
          class="text-danger"
          >{{ fieldErrors.descripcion[0] }}</span
        >
        <span class="ml-auto tabular-nums"
          >{{ description.length }}/1000</span
        >
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
      v-if="error"
      role="alert"
      class="text-sm font-medium text-danger"
    >
      {{ error }}
    </p>

    <footer
      class="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end"
    >
      <NuxtLink
        to="/equipo"
        class="ui-btn-secondary justify-center px-4 py-2.5 text-sm"
        >Ver perfil público</NuxtLink
      >
      <button
        type="submit"
        :disabled="saving"
        class="ui-btn justify-center px-5 py-2.5 text-sm disabled:opacity-50"
      >
        {{ saving ? "Publicando…" : "Guardar presentación" }}
      </button>
    </footer>
  </form>
</template>
