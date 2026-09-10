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

const { apiFetch, downloadFile } = useApi()

const { data: response, pending, error, refresh } = await useAsyncData(
  'barbershop-settings',
  () => apiFetch<{ data: SettingData }>('/settings'),
  { lazy: true },
)

// Respaldo de BD -- puerto de backups.database.download (Blade, sesión web).
// Ver Api\Admin\System\BackupController::download() en barber.
const downloadingBackup = ref(false)
const backupError = ref('')

async function downloadBackup() {
  downloadingBackup.value = true
  backupError.value = ''
  try {
    await downloadFile('/system/backup', `backup-urbanblade-${new Date().toISOString().slice(0, 10)}.zip`)
  } catch {
    backupError.value = 'No se pudo generar el respaldo. Intenta de nuevo.'
  } finally {
    downloadingBackup.value = false
  }
}

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
const fieldErrors = ref<Record<string, string[]>>({})

const inputClass = (field: string) => [
  'w-full rounded-lg border bg-main px-3 py-2 text-sm text-ink',
  fieldErrors.value[field] ? 'border-red-500/60' : 'border-line',
]

async function submitForm() {
  saving.value = true
  saveError.value = ''
  saveSuccess.value = ''
  fieldErrors.value = {}
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
    const data = (err as { data?: { message?: string, errors?: Record<string, string[]> } })?.data
    fieldErrors.value = data?.errors ?? {}
    saveError.value = data?.message ?? 'No se pudo guardar la configuración.'
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
            <label for="setting-name" class="mb-1 block text-xs text-muted">Nombre</label>
            <input id="setting-name" v-model="form.nombre" type="text" required maxlength="255" :aria-invalid="!!fieldErrors.nombre" :aria-describedby="fieldErrors.nombre ? 'setting-name-error' : undefined" :class="inputClass('nombre')">
            <p v-if="fieldErrors.nombre" id="setting-name-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.nombre[0] }}</p>
          </div>
          <div>
            <label for="setting-address" class="mb-1 block text-xs text-muted">Dirección</label>
            <input id="setting-address" v-model="form.direccion" type="text" maxlength="255" :aria-invalid="!!fieldErrors.direccion" :aria-describedby="fieldErrors.direccion ? 'setting-address-error' : undefined" :class="inputClass('direccion')">
            <p v-if="fieldErrors.direccion" id="setting-address-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.direccion[0] }}</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="setting-phone" class="mb-1 block text-xs text-muted">Teléfono</label>
              <input id="setting-phone" v-model="form.telefono" type="text" maxlength="30" :aria-invalid="!!fieldErrors.telefono" :aria-describedby="fieldErrors.telefono ? 'setting-phone-error' : undefined" :class="inputClass('telefono')">
              <p v-if="fieldErrors.telefono" id="setting-phone-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.telefono[0] }}</p>
            </div>
            <div>
              <label for="setting-cancellation" class="mb-1 block text-xs text-muted">Política de cancelación (horas)</label>
              <input id="setting-cancellation" v-model.number="form.politica_cancelacion" type="number" min="1" max="168" required :aria-invalid="!!fieldErrors.politica_cancelacion" :aria-describedby="fieldErrors.politica_cancelacion ? 'setting-cancellation-error' : undefined" :class="inputClass('politica_cancelacion')">
              <p v-if="fieldErrors.politica_cancelacion" id="setting-cancellation-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.politica_cancelacion[0] }}</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="setting-opening" class="mb-1 block text-xs text-muted">Horario apertura</label>
              <input id="setting-opening" v-model="form.horario_apertura" type="time" :aria-invalid="!!fieldErrors.horario_apertura" :aria-describedby="fieldErrors.horario_apertura ? 'setting-opening-error' : undefined" :class="inputClass('horario_apertura')">
              <p v-if="fieldErrors.horario_apertura" id="setting-opening-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.horario_apertura[0] }}</p>
            </div>
            <div>
              <label for="setting-closing" class="mb-1 block text-xs text-muted">Horario cierre</label>
              <input id="setting-closing" v-model="form.horario_cierre" type="time" :aria-invalid="!!fieldErrors.horario_cierre" :aria-describedby="fieldErrors.horario_cierre ? 'setting-closing-error' : undefined" :class="inputClass('horario_cierre')">
              <p v-if="fieldErrors.horario_cierre" id="setting-closing-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.horario_cierre[0] }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="ui-card p-5">
        <h2 class="mb-4 text-sm font-black uppercase tracking-wide text-ink">Redes sociales</h2>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label for="setting-instagram" class="mb-1 block text-xs text-muted">Instagram</label>
            <input id="setting-instagram" v-model="form.instagram" type="text" maxlength="255" :aria-invalid="!!fieldErrors.instagram" :aria-describedby="fieldErrors.instagram ? 'setting-instagram-error' : undefined" :class="inputClass('instagram')">
            <p v-if="fieldErrors.instagram" id="setting-instagram-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.instagram[0] }}</p>
          </div>
          <div>
            <label for="setting-facebook" class="mb-1 block text-xs text-muted">Facebook</label>
            <input id="setting-facebook" v-model="form.facebook" type="text" maxlength="255" :aria-invalid="!!fieldErrors.facebook" :aria-describedby="fieldErrors.facebook ? 'setting-facebook-error' : undefined" :class="inputClass('facebook')">
            <p v-if="fieldErrors.facebook" id="setting-facebook-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.facebook[0] }}</p>
          </div>
          <div>
            <label for="setting-tiktok" class="mb-1 block text-xs text-muted">TikTok</label>
            <input id="setting-tiktok" v-model="form.tiktok" type="text" maxlength="255" :aria-invalid="!!fieldErrors.tiktok" :aria-describedby="fieldErrors.tiktok ? 'setting-tiktok-error' : undefined" :class="inputClass('tiktok')">
            <p v-if="fieldErrors.tiktok" id="setting-tiktok-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.tiktok[0] }}</p>
          </div>
        </div>
      </section>

      <section class="ui-card p-5">
        <h2 class="mb-4 text-sm font-black uppercase tracking-wide text-ink">Datos bancarios (pagos por transferencia)</h2>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="setting-clabe" class="mb-1 block text-xs text-muted">CLABE</label>
            <input id="setting-clabe" v-model="form.clabe" type="text" maxlength="18" :aria-invalid="!!fieldErrors.clabe" :aria-describedby="fieldErrors.clabe ? 'setting-clabe-error' : undefined" :class="inputClass('clabe')">
            <p v-if="fieldErrors.clabe" id="setting-clabe-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.clabe[0] }}</p>
          </div>
          <div>
            <label for="setting-bank" class="mb-1 block text-xs text-muted">Banco</label>
            <input id="setting-bank" v-model="form.banco" type="text" maxlength="100" :aria-invalid="!!fieldErrors.banco" :aria-describedby="fieldErrors.banco ? 'setting-bank-error' : undefined" :class="inputClass('banco')">
            <p v-if="fieldErrors.banco" id="setting-bank-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.banco[0] }}</p>
          </div>
          <div>
            <label for="setting-beneficiary" class="mb-1 block text-xs text-muted">Beneficiario</label>
            <input id="setting-beneficiary" v-model="form.beneficiario" type="text" maxlength="150" :aria-invalid="!!fieldErrors.beneficiario" :aria-describedby="fieldErrors.beneficiario ? 'setting-beneficiary-error' : undefined" :class="inputClass('beneficiario')">
            <p v-if="fieldErrors.beneficiario" id="setting-beneficiary-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.beneficiario[0] }}</p>
          </div>
          <div>
            <label for="setting-concept" class="mb-1 block text-xs text-muted">Concepto</label>
            <input id="setting-concept" v-model="form.concepto" type="text" maxlength="100" :aria-invalid="!!fieldErrors.concepto" :aria-describedby="fieldErrors.concepto ? 'setting-concept-error' : undefined" :class="inputClass('concepto')">
            <p v-if="fieldErrors.concepto" id="setting-concept-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.concepto[0] }}</p>
          </div>
        </div>
      </section>

      <p v-if="saveError" role="alert" class="text-sm text-red-400">{{ saveError }}</p>
      <p v-if="saveSuccess" role="status" class="text-sm text-emerald-400">{{ saveSuccess }}</p>
      <button type="submit" :disabled="saving" class="w-fit rounded-lg bg-gold px-6 py-2 text-sm font-semibold text-black hover:bg-gold-dim disabled:opacity-50">
        {{ saving ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </form>

    <section class="ui-card mt-6 max-w-3xl p-5">
      <h2 class="mb-1 text-sm font-black uppercase tracking-wide text-ink">Respaldo de la base de datos</h2>
      <p class="mb-4 text-sm text-muted">Descarga un zip con cada colección exportada en JSON, restaurable con <code>mongoimport</code>.</p>
      <button
        type="button" :disabled="downloadingBackup"
        class="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-gold/40 hover:text-ink disabled:opacity-50"
        @click="downloadBackup"
      >
        {{ downloadingBackup ? 'Generando respaldo…' : 'Descargar respaldo' }}
      </button>
      <p v-if="backupError" role="alert" class="mt-2 text-sm text-red-400">{{ backupError }}</p>
    </section>
  </div>
</template>
