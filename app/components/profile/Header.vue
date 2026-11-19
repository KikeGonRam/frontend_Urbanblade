<script setup lang="ts">
defineProps<{
  name: string;
  email: string;
  avatarUrl: string | null | undefined;
  avatarPreview: string | null;
  roles: string[];
  profileComplete: boolean;
  profileMissing: string[];
  hasAvatarSelection: boolean;
  uploading: boolean;
}>();
const emit = defineEmits<{
  "select-avatar": [event: Event];
  "upload-avatar": [];
}>();
</script>

<template>
  <header
    class="relative overflow-hidden rounded-3xl border border-line bg-card p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] sm:p-7"
  >
    <div
      class="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gold/10 blur-3xl"
    />
    <div class="relative flex flex-col gap-5 sm:flex-row sm:items-center">
      <ProfileAvatar :name="name" :preview="avatarPreview" :url="avatarUrl" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-black uppercase tracking-[0.2em] text-gold">
          Cuenta
        </p>
        <h1 class="mt-2 text-3xl font-black tracking-tight text-ink">
          {{ name || "Mi perfil" }}
        </h1>
        <p class="mt-1 truncate text-sm text-muted">{{ email }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="role in roles"
            :key="role"
            class="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-gold"
            >{{ role }}</span
          >
          <span
            class="rounded-full border border-line bg-main/60 px-2.5 py-1 text-xs font-bold text-muted"
            >{{
              profileComplete ? "Perfil completo" : "Perfil por completar"
            }}            </span
          >
        </div>
        <ProfileAvatarControls
          :has-selection="hasAvatarSelection"
          :uploading="uploading"
          @select="emit('select-avatar', $event)"
          @upload="emit('upload-avatar')"
        />
      </div>
    </div>
    <ProfileCompleteness :complete="profileComplete" :missing="profileMissing" />
  </header>
</template>
