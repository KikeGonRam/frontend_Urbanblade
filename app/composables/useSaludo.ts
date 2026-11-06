/**
 * Saludo según la hora local (Fase C del plan de calidez). De 6:00 a 11:59 «Buenos días», de 12:00 a 18:59
 * «Buenas tardes» y el resto «Buenas noches». Puro y sin zona horaria propia: usa la hora del dispositivo.
 */
export function saludoPorHora(fecha: Date = new Date()): string {
  const hora = fecha.getHours()
  if (hora >= 6 && hora < 12) return 'Buenos días'
  if (hora >= 12 && hora < 19) return 'Buenas tardes'

  return 'Buenas noches'
}

/**
 * Saludo para los paneles. Parte de un «Hola» neutro y se afina al montar en el navegador: el servidor no conoce la
 * hora del dispositivo y un texto distinto en cada lado provocaría un desajuste de hidratación.
 */
export function useSaludo() {
  const saludo = ref('Hola')
  onMounted(() => {
    saludo.value = saludoPorHora()
  })

  return saludo
}
