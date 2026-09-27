<script setup lang="ts">
/*
 * Buscador del encabezado (antes era decorativo: guardaba el texto y no hacía nada).
 * Busca en tres fuentes reales, según el rol:
 *   - "Ir a": pantallas del menú de tu rol (useNavigation), al instante.
 *   - "Clientes": solo personal (GET /clients?q=, el mismo filtro por nombre/correo).
 *   - "Servicios": catálogo público (GET /services), filtrado aquí.
 * Flechas para moverse, Enter abre el resultado, Esc cierra.
 */
const { sections } = useNavigation();
const { user } = useAuth();
const { apiFetch } = useApi();
const router = useRouter();

interface Result { key: string; group: string; label: string; detail?: string; to: string }

const query = ref("");
const debounced = useDebounce(query, 250);
const open = ref(false);
const active = ref(0);
const loading = ref(false);
const clients = ref<Result[]>([]);
const services = ref<Result[]>([]);
const inputRef = ref<HTMLInputElement | null>(null);
const listId = useId();

const isStaff = computed(() =>
  (user.value?.roles ?? []).some((r) => ["administrador", "recepcionista"].includes(r)),
);

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const pages = computed<Result[]>(() => {
  const q = normalize(query.value.trim());
  if (!q) return [];

  return sections.value
    .flatMap((s) => s.items)
    .filter((i) => i.implemented && normalize(i.label).includes(q))
    .slice(0, 5)
    .map((i) => ({ key: `p-${i.to}`, group: "Ir a", label: i.label, to: i.to }));
});

let servicesCache: Array<{ id: string; nombre: string; precio: number; duracion_min: number }> | null = null;

watch(debounced, async (value) => {
  const q = value.trim();
  clients.value = [];
  services.value = [];
  if (q.length < 2) return;
  loading.value = true;
  try {
    const [clientRes, serviceRes] = await Promise.all([
      isStaff.value
        ? apiFetch<{ data: Array<{ slug: string | null; telefono: string | null; user: { name: string | null; email: string | null } }> }>(
            "/clients",
            { query: { q } },
          ).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
      servicesCache
        ? Promise.resolve({ data: servicesCache })
        : apiFetch<{ data: typeof servicesCache }>("/services").catch(() => ({ data: [] })),
    ]);
    if (q !== debounced.value.trim()) return;
    clients.value = clientRes.data
      .filter((c) => c.slug)
      .slice(0, 5)
      .map((c) => ({
        key: `c-${c.slug}`,
        group: "Clientes",
        label: c.user.name ?? "Cliente",
        detail: c.user.email ?? c.telefono ?? undefined,
        to: `/clients/${c.slug}`,
      }));
    servicesCache = serviceRes.data ?? [];
    const nq = normalize(q);
    services.value = servicesCache
      .filter((s) => normalize(s.nombre).includes(nq))
      .slice(0, 5)
      .map((s) => ({
        key: `s-${s.id}`,
        group: "Servicios",
        label: s.nombre,
        detail: `$${Number(s.precio).toLocaleString("es-MX")} · ${s.duracion_min} min`,
        to: isStaff.value ? "/services" : `/reservar?servicio=${s.id}`,
      }));
  } finally {
    loading.value = false;
  }
});

const results = computed(() => [...pages.value, ...clients.value, ...services.value]);
watch(results, () => (active.value = 0));

function go(result: Result | undefined) {
  if (!result) return;
  open.value = false;
  query.value = "";
  inputRef.value?.blur();
  router.push(result.to);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    open.value = true;
    active.value = Math.min(active.value + 1, Math.max(results.value.length - 1, 0));
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    active.value = Math.max(active.value - 1, 0);
  } else if (event.key === "Enter") {
    event.preventDefault();
    go(results.value[active.value]);
  } else if (event.key === "Escape") {
    open.value = false;
    inputRef.value?.blur();
  }
}

// Ctrl/⌘ + K enfoca el buscador desde cualquier pantalla.
function onGlobalKey(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    inputRef.value?.focus();
  }
}
onMounted(() => window.addEventListener("keydown", onGlobalKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onGlobalKey));
</script>

<template>
  <div class="relative" @focusout="(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) open = false }">
    <label class="ub-topbar-search">
      <ShellNavIcon paths="<circle cx='11' cy='11' r='7' /><path d='m20 20-4-4' />" />
      <span class="sr-only">Buscar</span>
      <input
        ref="inputRef"
        v-model="query"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open && query.trim().length > 0"
        :aria-controls="listId"
        :aria-activedescendant="results[active] ? `${listId}-${active}` : undefined"
        :placeholder="isStaff ? 'Buscar clientes, servicios o pantallas…' : 'Buscar servicios o pantallas…'"
        @focus="open = true"
        @input="open = true"
        @keydown="onKeydown"
      >
      <kbd class="hidden rounded border border-line px-1.5 text-[10px] text-muted lg:inline">Ctrl K</kbd>
    </label>

    <div
      v-if="open && query.trim().length > 0"
      :id="listId"
      role="listbox"
      class="ub-rise absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-line bg-card p-2 shadow-2xl"
    >
      <p v-if="loading && !results.length" class="px-3 py-3 text-sm text-muted">Buscando…</p>
      <p v-else-if="!results.length" class="px-3 py-3 text-sm text-muted">
        Sin resultados para “{{ query.trim() }}”.
      </p>
      <template v-for="(r, i) in results" :key="r.key">
        <p v-if="i === 0 || results[i - 1]?.group !== r.group" class="px-3 pb-1 pt-2 text-xs font-medium text-muted">
          {{ r.group }}
        </p>
        <button
          :id="`${listId}-${i}`"
          type="button"
          role="option"
          :aria-selected="i === active"
          class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors"
          :class="i === active ? 'bg-gold/10 text-ink' : 'text-ink hover:bg-accent'"
          @mouseenter="active = i"
          @click="go(r)"
        >
          <span class="truncate font-medium">{{ r.label }}</span>
          <span v-if="r.detail" class="shrink-0 truncate text-xs text-muted">{{ r.detail }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
