<script setup lang="ts">
/** «Cómo funciona»: franja compacta de tres pasos. */
import { vReveal } from '~/composables/useLandingReveal'

const steps = [
  { num: '1', title: 'Elige tu Servicio', desc: 'Corte, barba o el tratamiento que necesites, con precio y duración a la vista.' },
  { num: '2', title: 'Elige tu Cita', desc: 'Selecciona tu barbero favorito y un horario realmente disponible.' },
  { num: '3', title: '¡Luce Increíble!', desc: 'Llega, relájate y déjate transformar. Sin esperas, sin sorpresas.' },
]
</script>

<template>
  <section id="como-funciona" class="relative border-y border-line bg-panel py-8">
    <div class="mx-auto max-w-5xl px-4">
      <ol class="grid gap-6 sm:grid-cols-3">
        <li v-for="(step, k) in steps" :key="step.num" v-reveal class="reveal flex items-center gap-4" :style="{ transitionDelay: `${k * 100}ms` }">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-gold/40 bg-card text-lg font-black text-gold">{{ step.num }}</span>
          <span>
            <span class="block text-sm font-black uppercase tracking-tight text-ink">{{ step.title }}</span>
            <span class="mt-0.5 block text-xs leading-snug text-muted">{{ step.desc }}</span>
          </span>
        </li>
      </ol>
    </div>
  </section>
</template>
