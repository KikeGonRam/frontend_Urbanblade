/**
 * Heurística propia y ligera (sin librería tipo zxcvbn, que pesa ~800KB
 * minificado para lo que necesita un formulario de 2 campos): 4 criterios
 * simples, cada uno suma un punto. score 0 = campo vacío.
 */
export function usePasswordStrength(password: Ref<string>) {
  const score = computed(() => {
    const value = password.value
    if (!value) return 0

    let points = 0
    if (value.length >= 8) points++
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) points++
    if (/\d/.test(value)) points++
    if (/[^A-Za-z0-9]/.test(value) || value.length >= 12) points++

    return points
  })

  // displayScore nunca baja de 1 si ya hay algo escrito -- score 0 solo debe
  // significar "campo vacío", no "contraseña pésima sin ninguna barra ni
  // etiqueta visible" (p.ej. "abc" cumple 0 de los 4 criterios pero sigue
  // siendo una contraseña real que el usuario está evaluando).
  const displayScore = computed(() => (password.value ? Math.max(1, score.value) : 0))

  const label = computed(() => ['', 'Muy débil', 'Débil', 'Buena', 'Excelente'][displayScore.value])
  const barColor = computed(() => ['', 'bg-red-500', 'bg-amber-400', 'bg-gold', 'bg-emerald-400'][displayScore.value])
  const textColor = computed(() => ['', 'text-red-400', 'text-amber-400', 'text-gold', 'text-emerald-400'][displayScore.value])

  return { score: displayScore, label, barColor, textColor }
}
