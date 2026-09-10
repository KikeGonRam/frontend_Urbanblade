export type MascotId = 'nava' | 'bladebot' | 'bruno'
export type MascotState = 'idle' | 'welcome' | 'waiting' | 'success' | 'empty' | 'forbidden' | 'lost' | 'error'

interface MascotDefinition {
  name: string
  image: string
  role: string
  motto: string
  story: string
  stateImages: Partial<Record<MascotState, string>>
}

export const MASCOTS: Record<MascotId, MascotDefinition> = {
  nava: {
    name: 'Nava',
    image: '/images/mascots/nava-panther.png',
    role: 'Guía de experiencia',
    motto: 'Siempre hay una ruta con estilo.',
    story: 'Nava creció entre barrios donde una barbería era punto de encuentro. Aprendió a leer el ambiente, orientar sin imponer y convertir cada desvío en una nueva oportunidad. Representa exploración, cercanía y confianza.',
    stateImages: {
      empty: '/images/mascots/states/nava-empty.webp',
      lost: '/images/mascots/states/nava-lost.webp',
    },
  },
  bladebot: {
    name: 'Bladebot',
    image: '/images/mascots/bladebot.png',
    role: 'Asistente de precisión',
    motto: 'Orden, precisión y una cálida bienvenida.',
    story: 'Bladebot nació en el taller digital de UrbanBlade para coordinar cada detalle sin perder el trato humano. Organiza, recuerda y acompaña. Representa tecnología útil, eficiencia y servicio.',
    stateImages: {
      welcome: '/images/mascots/states/bladebot-welcome.webp',
      waiting: '/images/mascots/states/bladebot-waiting.webp',
      success: '/images/mascots/states/bladebot-success.webp',
    },
  },
  bruno: {
    name: 'Bruno',
    image: '/images/mascots/bruno-raven.png',
    role: 'Guardián del conocimiento',
    motto: 'Observar, comprender y resolver.',
    story: 'Bruno ha recorrido cada rincón de la operación y guarda las historias que hacen crecer al equipo. Cuando algo falla, estudia las pistas antes de actuar. Representa análisis, memoria y criterio.',
    stateImages: {
      forbidden: '/images/mascots/states/bruno-forbidden.webp',
      error: '/images/mascots/states/bruno-error.webp',
    },
  },
}
export function useBrandMascots() {
  const { theme } = useTheme()
  const themeMascot = computed<MascotId>(() => theme.value === 'salon' ? 'nava' : theme.value === 'libreta' ? 'bruno' : 'bladebot')
  return { mascots: MASCOTS, themeMascot }
}
