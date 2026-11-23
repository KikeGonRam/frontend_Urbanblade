import type { PaymentBarber, PaymentsResponse } from "~/types/payments";

/*
 * Historial de cobros + filtros (q/método/barbero/fechas) + paginación.
 * El contrato de GET /payments (meta.stats, meta.pending_count) vive en
 * Api/Payment/PaymentController; aquí solo se consume.
 */
export function usePaymentsFilters() {
  const search = ref("");
  const debouncedSearch = useDebounce(search, 350);
  const metodoFilter = ref("");
  const barberoFilter = ref("");
  const fechaDesde = ref("");
  const fechaHasta = ref("");
  const page = ref(1);

  const hasActiveFilters = computed(
    () =>
      Boolean(
        search.value ||
          metodoFilter.value ||
          barberoFilter.value ||
          fechaDesde.value ||
          fechaHasta.value,
      ),
  );

  function clearFilters() {
    search.value = "";
    metodoFilter.value = "";
    barberoFilter.value = "";
    fechaDesde.value = "";
    fechaHasta.value = "";
    page.value = 1;
  }

  return {
    search,
    debouncedSearch,
    metodoFilter,
    barberoFilter,
    fechaDesde,
    fechaHasta,
    page,
    hasActiveFilters,
    clearFilters,
  };
}

export type PaymentsFilters = ReturnType<typeof usePaymentsFilters>;

export async function usePaymentsList(filters: PaymentsFilters) {
  const { apiFetch } = useApi();

  const query = () => ({
    q: filters.search.value || undefined,
    metodo_pago: filters.metodoFilter.value || undefined,
    barbero_id: filters.barberoFilter.value || undefined,
    fecha_desde: filters.fechaDesde.value || undefined,
    fecha_hasta: filters.fechaHasta.value || undefined,
    page: filters.page.value,
    per_page: 10,
  });

  const {
    data: response,
    pending,
    error,
    refresh,
  } = await useAsyncData<PaymentsResponse>(
    buildDataKey("payments-list", query()),
    () => apiFetch<PaymentsResponse>("/payments", { query: query() }),
    {
      watch: [
        filters.debouncedSearch,
        filters.metodoFilter,
        filters.barberoFilter,
        filters.fechaDesde,
        filters.fechaHasta,
        filters.page,
      ],
      lazy: true,
    },
  );

  // Se registra después del useAsyncData (mismo orden que antes) para que el
  // cambio de filtro no dispare una petición extra con la página vieja.
  watch(
    [
      filters.debouncedSearch,
      filters.metodoFilter,
      filters.barberoFilter,
      filters.fechaDesde,
      filters.fechaHasta,
    ],
    () => {
      filters.page.value = 1;
    },
  );

  const payments = computed(() => response.value?.data ?? []);
  // `meta` lo manda siempre la API real, pero una respuesta incompleta (o una carga a medias) no
  // debe dejar la pantalla de cobros en blanco: sin `meta` simplemente no hay tarjetas ni paginación.
  const stats = computed(() => response.value?.meta?.stats);
  const pendingCount = computed(() => response.value?.meta?.pending_count ?? 0);
  const anuladosCount = computed(() => response.value?.meta?.anulados_count ?? 0);
  const pagination = computed(() => response.value?.meta);

  const { data: barbersRes } = await useAsyncData(
    "payments-barbers",
    () =>
      apiFetch<{ data: Array<{ id: string; user: { name: string } | null }> }>(
        "/barbers",
      ),
    { lazy: true },
  );
  const barbers = computed<PaymentBarber[]>(() =>
    (barbersRes.value?.data ?? []).map((b) => ({
      id: b.id,
      name: b.user?.name ?? "Barbero",
    })),
  );

  return { pending, error, refresh, payments, stats, pendingCount,
    anuladosCount, pagination, barbers };
}
