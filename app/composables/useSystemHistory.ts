import type { SystemStatus } from '~/utils/systemMap'
import { appendSample, incidentsFrom, parseHistory, sampleFromStatus, type SystemSample } from '~/utils/systemHistory'

/*
 * Historial local del monitor del ingeniero (auditoría UI/UX I-01). Guarda hasta 24 h de lecturas en este
 * navegador (`localStorage`, sin datos personales: solo latencias, cola y salud) para dibujar tendencias y
 * registrar cambios de estado aunque se recargue la página. Si el almacenamiento no está disponible, sigue
 * funcionando en memoria.
 */
const KEY = 'ub_system_history_v1'

export function useSystemHistory() {
  const samples = useState<SystemSample[]>('system_history', () => [])

  onMounted(() => {
    try {
      const guardado = parseHistory(localStorage.getItem(KEY))
      // Se conserva lo que ya llegó en esta sesión (puede haber lecturas más nuevas que las guardadas).
      const nuevas = samples.value.filter(s => !guardado.some(g => g.t === s.t))
      samples.value = [...guardado, ...nuevas].sort((a, b) => a.t - b.t)
    } catch {
      // Sin almacenamiento: solo memoria.
    }
  })

  function record(status: SystemStatus) {
    if (!import.meta.client) return
    samples.value = appendSample(samples.value, sampleFromStatus(status, Date.now()))
    try {
      localStorage.setItem(KEY, JSON.stringify(samples.value))
    } catch {
      // Cuota llena o modo privado: se ignora.
    }
  }

  function clear() {
    samples.value = []
    try {
      localStorage.removeItem(KEY)
    } catch {
      // Nada que limpiar.
    }
  }

  const incidents = computed(() => incidentsFrom(samples.value))

  return { samples, incidents, record, clear }
}
