<script setup lang="ts">
/*
 * Fase 9.9 — Configuración general de la barbería, puerto de
 * Setting\BarbershopSettingController (web). Api\Setting\SettingController
 * ya existía pero ignoraba datos_bancarios; se agregó en esta misma fase
 * (el cliente necesita ver la CLABE al pagar por transferencia).
 */
definePageMeta({ middleware: ['auth', 'admin'], layout: 'dashboard' })

interface SettingData {
  id: string
  nombre: string
  direccion: string | null
  telefono: string | null
  horario_apertura: string | null
  horario_cierre: string | null
  politica_cancelacion: number
  maintenance_mode: boolean
  redes_sociales: { instagram?: string | null, facebook?: string | null, tiktok?: string | null }
  datos_bancarios: { clabe?: string | null, banco?: string | null, beneficiario?: string | null, concepto?: string | null }
}

const { apiFetch } = useApi()

const { data: response, pending, error, refresh } = await useAsyncData(
  'barbershop-settings',
  () => apiFetch<{ data: SettingData }>('/settings'),
)

const form = reactive({
  nombre: '', direccion: '', telefono: '', horario_apertura: '', horario_cierre: '', politica_cancelacion: 24,
  instagram: '', facebook: '', tiktok: '', clabe: '', banco: '', beneficiario: '', concepto: '',
})

function fillForm(data: SettingData) {
  form.nombre = data.nombre ?? ''
  form.direccion = data.direccion ?? ''
  form.telefono = data.telefono ?? ''
  form.horario_apertura = data.horario_apertura ?? ''
  form.horario_cierre = data.horario_cierre ?? ''
  form.politica_cancelacion = data.politica_cancelacion ?? 24
  form.instagram = data.redes_sociales?.instagram ?? ''
  form.facebook = data.redes_sociales?.facebook ?? ''
  form.tiktok = data.redes_sociales?.tiktok ?? ''
  form.clabe = data.datos_bancarios?.clabe ?? ''
  form.banco = data.datos_bancarios?.banco ?? ''
  form.beneficiario = data.datos_bancarios?.beneficiario ?? ''
  form.concepto = data.datos_bancarios?.concepto ?? ''
}

watch(() => response.value?.data, (data) => { if (data) fillForm(data) }, { immediate: true })

const maintenanceMode = computed(() => response.value?.data?.maintenance_mode ?? false)

const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref('')

async function submitForm() {
  saving.value = true
  saveError.value = ''
  saveSuccess.value = ''
  try {
    const res = await apiFetch<{ message: string }>('/settings', {
      method: 'PUT',
      body: {
        nombre: form.nombre,
        direccion: form.direccion || undefined,
        telefono: form.telefono || undefined,
        horario_apertura: form.horario_apertura || undefined,
        horario_cierre: form.horario_cierre || undefined,
        politica_cancelacion: form.politica_cancelacion,
        instagram: form.instagram || undefined,
        facebook: form.facebook || undefined,
        tiktok: form.tiktok || undefined,
        clabe: form.clabe || undefined,
        banco: form.banco || undefined,
        beneficiario: form.beneficiario || undefined,
        concepto: form.concepto || undefined,
      },
    })
    saveSuccess.value = res.message
    await refresh()
  } catch (err: unknown) {
    saveError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo guardar la configuración.'
  } finally {
    saving.value = false
  }
}

const togglingMaintenance = ref(false)

async function toggleMaintenance() {
  togglingMaintenance.value = true
  try {
    await apiFetch('/settings/maintenance', { method: 'POST' })
    await refresh()
  } catch (err: unknown) {
    saveError.value = (err as { data?: { message?: string } })?.data?.message ?? 'No se pudo cambiar el modo mantenimiento.'
  } finally {
    togglingMaintenance.value = false
  }
}
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm uppercase tracking-widest text-muted">UrbanBlade</p>
        <h1 class="mt-1 text-2xl font-semibold text-ink">Configuración <span class="text-gold">General</span></h1>
        <p class="mt-1 text-sm text-muted">Datos del negocio, redes sociales, cuenta bancaria y modo mantenimiento.</p>
      </div>
      <button
        v-if="!pending" type="button" :disabled="togglingMaintenance"
        class="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        :class="maintenanceMode ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-line text-muted hover:text-ink'"
        @click="toggleMaintenance"
      >
        {{ maintenanceMode ? 'Desactivar mantenimiento' : 'Activar modo mantenimiento' }}
      </button>
    </header>

    <p v-if="pending" class="text-sm text-muted">Cargando configuración…</p>
    <p v-else-if="error" class="text-sm text-red-400">No se pudo cargar la configuración.</p>

    <form v-else class="grid max-w-3xl grid-cols-1 gap-6" @submit.prevent="submitForm">
      <section class="ui-card p-5">
        <h2 class="mb-4 text-sm font-black uppercase tracking-wide text-ink">Datos del negocio</h2>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs text-muted">Nombre</label>
            <input v-model="form.nombre" type="text" required maxlength="255" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Dirección</label>
            <input v-model="form.direccion" type="text" maxlength="255" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Teléfono</label>
              <input v-model="form.telefono" type="text" maxlength="30" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Política de cancelación (horas)</label>
              <input v-model.number="form.politica_cancelacion" type="number" min="1" max="168" required class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-muted">Horario apertura</label>
              <input v-model="form.horario_apertura" type="time" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted">Horario cierre</label>
              <input v-model="form.horario_cierre" type="time" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
            </div>
          </div>
        </div>
      </section>

      <section class="ui-card p-5">
        <h2 class="mb-4 text-sm font-black uppercase tracking-wide text-ink">Redes sociales</h2>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="mb-1 block text-xs text-muted">Instagram</label>
            <input v-model="form.instagram" type="text" maxlength="255" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Facebook</label>
            <input v-model="form.facebook" type="text" maxlength="255" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">TikTok</label>
            <input v-model="form.tiktok" type="text" maxlength="255" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
        </div>
      </section>

      <section class="ui-card p-5">
        <h2 class="mb-4 text-sm font-black uppercase tracking-wide text-ink">Datos bancarios (pagos por transferencia)</h2>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs text-muted">CLABE</label>
            <input v-model="form.clabe" type="text" maxlength="18" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Banco</label>
            <input v-model="form.banco" type="text" maxlength="100" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Beneficiario</label>
            <input v-model="form.beneficiario" type="text" maxlength="150" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted">Concepto</label>
            <input v-model="form.concepto" type="text" maxlength="100" class="w-full rounded-lg border border-line bg-main px-3 py-2 text-sm text-ink">
          </div>
        </div>
      </section>

      <p v-if="saveError" class="text-sm text-red-400">{{ saveError }}</p>
      <p v-if="saveSuccess" class="text-sm text-emerald-400">{{ saveSuccess }}</p>
      <button type="submit" :disabled="saving" class="w-fit rounded-lg bg-gold px-6 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50">
        {{ saving ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </form>
  </div>
</template>
