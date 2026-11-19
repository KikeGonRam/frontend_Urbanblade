<script setup lang="ts">
defineProps<{ isAdministrator: boolean }>();
const emit = defineEmits<{ "open-delete": [] }>();
</script>

<template>
  <section
    class="profile-panel rounded-2xl border border-danger/25 bg-danger/5 p-5 sm:p-7"
  >
    <p class="ub-form-kicker text-danger">Cuenta</p>
    <h2 class="mt-2 text-xl font-black text-danger">Zona de peligro</h2>
    <p class="mt-1 ub-form-help max-w-prose">
      Al eliminar tu cuenta se revocarán todos tus accesos y tu perfil
      quedará deshabilitado permanentemente.
    </p>

    <div
      v-if="isAdministrator"
      class="mt-4 rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs text-warning"
    >
      Como administrador, no puedes eliminar tu propia cuenta desde el
      perfil. Debe realizarse desde la gestión global de usuarios.
    </div>
    <div v-else class="mt-4">
      <button
        type="button"
        class="rounded-lg border border-danger/30 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
        @click="emit('open-delete')"
      >
        Eliminar mi cuenta
      </button>
    </div>
  </section>
</template>
