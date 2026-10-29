<script setup lang="ts">
/*
 * Matriz de cohortes de retención (auditoría UI/UX A-45): cada fila son los clientes que se registraron en un mes
 * y cada columna, qué porcentaje volvió a tener una cita ese mes después. Las celdas se tiñen de oro según el
 * porcentaje; una celda vacía (—) significa que ese mes todavía no ocurre.
 */
import { intensidadRetencion, nombreCohorte, type Cohorte } from '~/utils/analitica'

const props = defineProps<{ cohortes: Cohorte[] }>()

const columnas = computed(() => Math.max(0, ...props.cohortes.map(c => c.retencion.length)))
const etiquetaColumna = (i: number) => (i === 0 ? 'Mes 0' : `+${i}`)
const valorDe = (c: Cohorte, i: number) => c.retencion[i] ?? null

const estiloCelda = (valor: number | null) => ({
  backgroundColor: `rgb(var(--gold-rgb) / ${(0.08 + intensidadRetencion(valor) * 0.62).toFixed(2)})`,
})
</script>

<template>
  <section class="rounded-2xl border border-line bg-card p-5 sm:p-6" aria-labelledby="cohortes">
    <h3 id="cohortes" class="text-base font-semibold text-ink">¿Cuántos clientes vuelven con el tiempo?</h3>
    <p class="mb-4 mt-0.5 text-sm text-muted">
      Clientes nuevos de cada mes y el porcentaje que volvió a reservar en los meses siguientes.
    </p>

    <p v-if="!cohortes.length" class="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">
      Aún no hay clientes nuevos suficientes para medir cohortes.
    </p>

    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[32rem] border-separate border-spacing-1 text-center text-xs">
        <caption class="sr-only">Retención de clientes por mes de registro</caption>
        <thead>
          <tr class="text-muted">
            <th scope="col" class="px-2 py-1 text-left font-semibold">Registro</th>
            <th scope="col" class="px-2 py-1 font-semibold">Clientes</th>
            <th v-for="i in columnas" :key="i" scope="col" class="px-2 py-1 font-semibold">{{ etiquetaColumna(i - 1) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in cohortes" :key="c.cohorte">
            <th scope="row" class="whitespace-nowrap px-2 py-1 text-left font-semibold text-ink">{{ nombreCohorte(c.cohorte) }}</th>
            <td class="px-2 py-1 tabular-nums text-ink">{{ c.clientes }}</td>
            <td
              v-for="i in columnas"
              :key="i"
              class="rounded-md px-2 py-2 font-bold tabular-nums text-ink"
              :style="valorDe(c, i - 1) === null ? undefined : estiloCelda(valorDe(c, i - 1))"
            >
              <span v-if="valorDe(c, i - 1) === null" class="font-normal text-muted">—</span>
              <template v-else>{{ Math.round(valorDe(c, i - 1) ?? 0) }} %</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
