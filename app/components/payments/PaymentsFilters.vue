<script setup lang="ts">
import { METODO_LABEL, type PaymentBarber } from "~/types/payments";

defineProps<{ barbers: PaymentBarber[]; hasActiveFilters: boolean }>();
defineEmits<{ clear: [] }>();

const search = defineModel<string>("search", { required: true });
const metodoFilter = defineModel<string>("metodo", { required: true });
const barberoFilter = defineModel<string>("barbero", { required: true });
const fechaDesde = defineModel<string>("desde", { required: true });
const fechaHasta = defineModel<string>("hasta", { required: true });

const METODO_OPCIONES = computed(() => [
  { value: "", label: "Todos", icon: "cash" },
  ...Object.entries(METODO_LABEL).map(([value, label]) => ({ value, label })),
]);
</script>

<template>
  <section class="mb-5 flex flex-wrap items-center gap-3">
    <UiSearchInput v-model="search" label="Cliente o servicio" placeholder="Buscar por cliente o servicio…" />
    <UiFilterChips v-model="metodoFilter" label="Filtrar por método de pago" :options="METODO_OPCIONES" />
    <select
      v-model="barberoFilter"
      aria-label="Filtrar por barbero"
      class="rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink"
    >
      <option value="">Todos los barberos</option>
      <option v-for="b in barbers" :key="b.id" :value="b.id">
        {{ b.name }}
      </option>
    </select>
    <UiDateRange v-model:from="fechaDesde" v-model:to="fechaHasta" />
    <button
      v-if="hasActiveFilters"
      type="button"
      class="text-xs font-bold uppercase tracking-widest text-muted hover:text-ink"
      @click="$emit('clear')"
    >
      Limpiar filtros
    </button>
  </section>
</template>
