<script setup lang="ts">
/*
 * Campo para elegir una imagen del dispositivo (no una URL), con vista previa.
 * Devuelve el File elegido por v-model; quien lo usa lo manda en un FormData.
 * Al editar, `currentUrl` muestra la imagen guardada mientras no se elija otra.
 */
const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    currentUrl?: string | null;
    maxMb?: number;
    error?: string | null;
    round?: boolean;
  }>(),
  { currentUrl: null, maxMb: 2, error: null, round: false },
);

const file = defineModel<File | null>({ default: null });

const input = ref<HTMLInputElement | null>(null);
const localError = ref("");
const preview = ref<string | null>(null);

watch(file, (value) => {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = value ? URL.createObjectURL(value) : null;
  if (!value && input.value) input.value.value = "";
});
onBeforeUnmount(() => {
  if (preview.value) URL.revokeObjectURL(preview.value);
});

// Si la imagen guardada no carga (borrada o URL rota) se muestra "Sin imagen", no el alt roto.
const broken = ref(false);
watch(() => props.currentUrl, () => { broken.value = false; });
const shown = computed(() => preview.value ?? (broken.value ? null : props.currentUrl));
function onImageError() {
  if (!preview.value) broken.value = true;
}
const message = computed(() => localError.value || props.error || "");

function onChange(event: Event) {
  const picked = (event.target as HTMLInputElement).files?.[0] ?? null;
  localError.value = "";
  if (!picked) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(picked.type)) {
    localError.value = "Elige una imagen JPG, PNG o WebP.";
    (event.target as HTMLInputElement).value = "";
    return;
  }
  if (picked.size > props.maxMb * 1024 * 1024) {
    localError.value = `La imagen pesa más de ${props.maxMb} MB.`;
    (event.target as HTMLInputElement).value = "";
    return;
  }
  file.value = picked;
}
</script>

<template>
  <div>
    <p
      class="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted"
    >
      {{ label }}
    </p>
    <div class="flex items-center gap-4">
      <img
        v-if="shown"
        :src="shown"
        alt="Vista previa"
        class="h-20 w-20 shrink-0 border border-line object-cover"
        :class="round ? 'rounded-full' : 'rounded-lg'"
        @error="onImageError"
      >
      <div
        v-else
        class="flex h-20 w-20 shrink-0 items-center justify-center border border-dashed border-line text-xs text-muted"
        :class="round ? 'rounded-full' : 'rounded-lg'"
        aria-hidden="true"
      >
        Sin imagen
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label
          :for="id"
          class="cursor-pointer rounded-lg border border-gold/40 px-3 py-2 text-sm font-semibold text-gold hover:bg-gold/10 focus-within:shadow-[0_0_0_3px_rgba(212,175,55,0.25)]"
        >
          {{ shown ? "Cambiar imagen" : "Elegir imagen" }}
          <input
            :id="id"
            ref="input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="sr-only"
            @change="onChange"
          >
        </label>
        <button
          v-if="file"
          type="button"
          class="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink"
          @click="file = null"
        >
          Descartar
        </button>
        <p class="w-full text-xs text-muted">
          JPG, PNG o WebP · máximo {{ maxMb }} MB
        </p>
      </div>
    </div>
    <p v-if="message" class="mt-1 text-xs text-red-400" role="alert">
      {{ message }}
    </p>
  </div>
</template>
