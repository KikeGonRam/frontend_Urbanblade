<script setup lang="ts">
import type { ProfileSection } from "~/types/profile";

defineProps<{ isBarber: boolean }>();
const activeSection = defineModel<ProfileSection>("section", { required: true });
</script>

<template>
  <nav class="profile-tabs" aria-label="Secciones del perfil">
    <button
      v-if="isBarber"
      type="button"
      :class="['profile-tab', activeSection === 'public' ? 'is-active' : '']"
      :aria-selected="activeSection === 'public'"
      @click="activeSection = 'public'"
    >
      <span class="profile-tab__icon">✦</span>
      <span
        ><strong>Perfil público</strong
        ><small>Tu ficha de barbero</small></span
      >
    </button>
    <button
      type="button"
      :class="[
        'profile-tab',
        activeSection === 'personal' ? 'is-active' : '',
      ]"
      :aria-selected="activeSection === 'personal'"
      @click="activeSection = 'personal'"
    >
      <span class="profile-tab__icon">◎</span>
      <span
        ><strong>Información</strong><small>Datos de tu cuenta</small></span
      >
    </button>
    <button
      type="button"
      :class="[
        'profile-tab',
        activeSection === 'security' ? 'is-active' : '',
      ]"
      :aria-selected="activeSection === 'security'"
      @click="activeSection = 'security'"
    >
      <span class="profile-tab__icon">⌁</span>
      <span
        ><strong>Seguridad</strong><small>Contraseña y acceso</small></span
      >
    </button>
    <button
      type="button"
      :class="[
        'profile-tab profile-tab--danger',
        activeSection === 'danger' ? 'is-active' : '',
      ]"
      :aria-selected="activeSection === 'danger'"
      @click="activeSection = 'danger'"
    >
      <span class="profile-tab__icon">!</span>
      <span><strong>Cuenta</strong><small>Zona de peligro</small></span>
    </button>
  </nav>
</template>
