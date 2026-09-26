<script setup lang="ts">
/* Badge de estado del kit (skill urbanblade-ui-kit). Tonos por tema: legibles también en "libreta". */
import type { BadgeTone } from "~/utils/appointmentStatus";

withDefaults(defineProps<{ tone?: BadgeTone; dot?: boolean }>(), { tone: "neutral", dot: true });

const TONES: Record<BadgeTone, { box: string; dot: string }> = {
  neutral: { box: "border-line bg-ink/5 text-muted", dot: "bg-muted" },
  gold: { box: "border-gold/30 bg-gold/10 text-gold", dot: "bg-gold" },
  success: { box: "border-success/30 bg-success/10 text-success", dot: "bg-success" },
  warning: { box: "border-warning/30 bg-warning/10 text-warning", dot: "bg-warning" },
  danger: { box: "border-danger/30 bg-danger/10 text-danger", dot: "bg-danger" },
  info: { box: "border-info/30 bg-info/10 text-info", dot: "bg-info" },
};
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold"
    :class="TONES[tone].box"
  >
    <span v-if="dot" class="h-1.5 w-1.5 rounded-full" :class="TONES[tone].dot" aria-hidden="true" />
    <slot />
  </span>
</template>
