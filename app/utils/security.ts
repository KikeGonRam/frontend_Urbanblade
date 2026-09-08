/**
 * Valida que una URL de redirección post-login sea estrictamente una ruta relativa local,
 * evitando vulnerabilidades de Redirección Abierta (Open Redirect / CWE-601).
 */
export function getSafeRedirectUrl(target: unknown, fallback = '/dashboard'): string {
  if (typeof target !== 'string' || !target.trim()) {
    return fallback
  }

  const clean = target.trim()

  // Prohibir protocolos explícitos, pseudo-protocolos javascript: y URLs relativas de protocolo (//ejemplo.com)
  if (
    clean.startsWith('//') ||
    clean.includes('://') ||
    clean.toLowerCase().startsWith('javascript:') ||
    clean.toLowerCase().startsWith('data:')
  ) {
    return fallback
  }

  // Asegurar que inicia con un solo slash relativo local
  if (!clean.startsWith('/')) {
    return fallback
  }

  return clean
}
