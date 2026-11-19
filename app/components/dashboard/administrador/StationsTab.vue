<script setup lang="ts">
import type { BarberStatus } from "~/types/dashboard";
import { useBarberStations } from "~/composables/useBarberStations";

const props = defineProps<{ statuses: BarberStatus[] | undefined }>();

const { busyStatuses, freeStatuses } = useBarberStations(() => props.statuses);
const showFree = ref(false);
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <p
        class="text-sm text-muted"
      >
        Ocupación en tiempo real
      </p>
      <span
        class="flex items-center gap-1 text-xs font-black uppercase text-success"
      >
        <span
          class="h-1.5 w-1.5 animate-pulse rounded-full bg-success"
        />Live
      </span>
    </div>
    <template v-if="(statuses ?? []).length">
      <div class="mb-4 flex gap-3">
        <div
          class="flex-1 rounded-xl border border-danger/20 bg-danger/[0.04] p-3 text-center"
        >
          <p class="text-lg font-black text-danger">
            {{ busyStatuses.length }}
          </p>
          <p class="text-xs font-black uppercase text-danger/80">
            Ocupados
          </p>
        </div>
        <div
          class="flex-1 rounded-xl border border-success/15 bg-success/[0.04] p-3 text-center"
        >
          <p class="text-lg font-black text-success">
            {{ freeStatuses.length }}
          </p>
          <p
            class="text-xs font-black uppercase text-success/80"
          >
            Libres
          </p>
        </div>
      </div>

      <div v-if="busyStatuses.length" class="grid grid-cols-2 gap-3">
        <div
          v-for="st in busyStatuses"
          :key="st.name"
          class="rounded-xl border border-danger/20 bg-danger/[0.04] p-3 text-center"
        >
          <div class="relative mb-2 inline-flex">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-lg border border-ink/[0.08] bg-ink/[0.05] text-xs font-black text-gold"
            >
              {{ st.name.slice(0, 2).toUpperCase() }}
            </div>
            <span
              class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111] bg-danger"
            />
          </div>
          <p class="truncate text-xs font-black text-ink">
            {{ st.name.split(" ")[0] }}
          </p>
          <p class="text-xs font-black uppercase text-danger">
            Ocupado
          </p>
          <div
            class="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-ink/5"
          >
            <div
              class="h-full rounded-full bg-gold"
              :style="{ width: `${st.progress}%` }"
            />
          </div>
        </div>
      </div>
      <p v-else class="py-4 text-center text-xs italic text-ink/45">
        Nadie está atendiendo ahora mismo.
      </p>

      <template v-if="freeStatuses.length">
        <button
          type="button"
          class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ink/[0.06] bg-ink/[0.02] py-2.5 text-xs font-black uppercase tracking-widest text-ink/50 transition hover:text-ink/70"
          @click="showFree = !showFree"
        >
          <span>{{
            showFree
              ? "Ocultar libres"
              : `Ver ${freeStatuses.length} libres`
          }}</span>
          <svg
            class="h-3 w-3 transition-transform"
            :class="showFree ? 'rotate-180' : ''"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        <div v-if="showFree" class="mt-3 grid grid-cols-2 gap-3">
          <div
            v-for="st in freeStatuses"
            :key="st.name"
            class="rounded-xl border border-success/15 bg-success/[0.04] p-3 text-center"
          >
            <div class="relative mb-2 inline-flex">
              <div
                class="flex h-9 w-9 items-center justify-center rounded-lg border border-ink/[0.08] bg-ink/[0.05] text-xs font-black text-gold"
              >
                {{ st.name.slice(0, 2).toUpperCase() }}
              </div>
              <span
                class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111] bg-success"
              />
            </div>
            <p class="truncate text-xs font-black text-ink">
              {{ st.name.split(" ")[0] }}
            </p>
            <p
              class="text-xs font-black uppercase text-success"
            >
              Libre
            </p>
          </div>
        </div>
      </template>
    </template>
    <p v-else class="py-8 text-center text-xs italic text-ink/45">
      Sin barberos activos
    </p>
  </div>
</template>
