<script setup lang="ts">
const props = defineProps<{ password: string }>()
const passwordRef = toRef(props, 'password')
const { score, label, barColor, textColor } = usePasswordStrength(passwordRef)
</script>

<template>
  <div v-if="password" class="mt-1.5">
    <div class="flex gap-1">
      <span
        v-for="bar in 4" :key="bar"
        class="h-1 flex-1 rounded-full transition-colors duration-300"
        :class="bar <= score ? barColor : 'bg-line'"
      />
    </div>
    <p class="mt-1 text-[11px] font-semibold" :class="textColor">{{ label }}</p>
  </div>
</template>
