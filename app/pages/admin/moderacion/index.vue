<script setup lang="ts">
/*
 * Moderación de comentarios del muro (política de contenido generado por
 * usuarios de Google Play). Lista los comentarios con reportes pendientes
 * (GET /admin/comment-reports) y permite eliminar, eliminar y vetar al autor
 * para comentar, o descartar los reportes (POST .../resolve).
 */
definePageMeta({ middleware: ["auth", "admin"], layout: "dashboard" });
useSeoMeta({ title: 'Moderación del muro — UrbanBlade', robots: 'noindex' })


interface ReportedComment {
  comment_id: string;
  comment: string | null;
  author: { id: string | null; name: string | null; comments_banned: boolean } | null;
  work: { id: string | null; title: string | null } | null;
  reports_count: number;
  reasons: string[];
  first_reported_at: string | null;
}
type Action = "remove" | "remove_and_ban" | "dismiss";

const { apiFetch } = useApi();
const { confirm } = useConfirm();

const { data: response, pending, error, refresh } = await useAsyncData(
  "admin-comment-reports",
  () => apiFetch<{ data: ReportedComment[] }>("/admin/comment-reports"),
);
const items = computed(() => response.value?.data ?? []);

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  ofensivo: "Ofensivo",
  sexual_violento: "Sexual o violento",
  otro: "Otro",
};
const reasonLabel = (r: string) => REASON_LABELS[r] ?? r;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—";

const working = ref<string | null>(null);
const actionError = ref("");

const COPY: Record<Action, { title: string; message: string; confirmText: string; isDanger: boolean }> = {
  remove: {
    title: "Eliminar comentario",
    message: "El comentario se elimina del muro y los reportes se marcan como atendidos.",
    confirmText: "Sí, eliminar",
    isDanger: true,
  },
  remove_and_ban: {
    title: "Eliminar y vetar al autor",
    message: "Se elimina el comentario y el autor ya no podrá comentar en el muro.",
    confirmText: "Sí, eliminar y vetar",
    isDanger: true,
  },
  dismiss: {
    title: "Descartar reportes",
    message: "El comentario se queda en el muro y los reportes se cierran.",
    confirmText: "Descartar",
    isDanger: false,
  },
};

async function resolve(item: ReportedComment, action: Action) {
  const accepted = await confirm(COPY[action]);
  if (!accepted) return;
  working.value = item.comment_id;
  actionError.value = "";
  try {
    await apiFetch(`/admin/comment-reports/${item.comment_id}/resolve`, { method: "POST", body: { action } });
    await refresh();
  } catch (err: unknown) {
    actionError.value =
      (err as { data?: { message?: string } })?.data?.message ?? "No se pudo completar la acción.";
  } finally {
    working.value = null;
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6">
      <h1 class="mt-1 text-2xl font-semibold text-ink">
        Moderación del <span class="text-gold">muro</span>
      </h1>
      <p class="mt-1 text-sm text-muted">Comentarios reportados por los usuarios, pendientes de revisión.</p>
    </header>

    <p v-if="actionError" role="alert" class="mb-4 text-sm text-danger">{{ actionError }}</p>
    <p v-if="pending" class="text-sm text-muted">Cargando…</p>
    <BrandStatePanel
      v-else-if="error"
      mascot="bruno"
      state="error"
      tone="danger"
      title="No se pudieron cargar los reportes"
      action-label="Reintentar"
      @action="refresh"
    />
    <p v-else-if="!items.length" class="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
      No hay comentarios reportados pendientes.
    </p>

    <div v-else class="space-y-4">
      <article v-for="item in items" :key="item.comment_id" class="ui-card p-5">
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-for="r in item.reasons"
            :key="r"
            class="rounded-full border border-warning/25 bg-warning/10 px-2 py-0.5 text-xs font-black uppercase text-warning"
          >{{ reasonLabel(r) }}</span>
          <span class="text-xs text-muted">
            {{ item.reports_count }} {{ item.reports_count === 1 ? "reporte" : "reportes" }} · primero: {{ fmtDate(item.first_reported_at) }}
          </span>
        </div>
        <p class="mt-3 whitespace-pre-line break-words text-sm text-ink">{{ item.comment ?? "(sin texto)" }}</p>
        <p class="mt-2 text-xs text-muted">
          Autor: <strong class="text-ink">{{ item.author?.name ?? "Desconocido" }}</strong>
          <span v-if="item.author?.comments_banned" class="ml-1 text-danger">(ya vetado)</span>
          · Publicación: {{ item.work?.title ?? "—" }}
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="ui-btn text-xs" :disabled="working === item.comment_id" @click="resolve(item, 'remove')">Eliminar</button>
          <button
            v-if="item.author && !item.author.comments_banned"
            type="button"
            class="ui-btn text-xs"
            :disabled="working === item.comment_id"
            @click="resolve(item, 'remove_and_ban')"
          >Eliminar y vetar autor</button>
          <button type="button" class="ui-btn-secondary text-xs" :disabled="working === item.comment_id" @click="resolve(item, 'dismiss')">Descartar</button>
        </div>
      </article>
    </div>
  </div>
</template>
