import type { BarberStatus } from "~/types/dashboard";

/** Barberos ocupados y libres a partir de `kpis.barbers_status`. */
export function useBarberStations(getStatuses: () => BarberStatus[] | undefined) {
  const busyStatuses = computed(() => (getStatuses() ?? []).filter((s) => s.is_busy));
  const freeStatuses = computed(() => (getStatuses() ?? []).filter((s) => !s.is_busy));

  return { busyStatuses, freeStatuses };
}
