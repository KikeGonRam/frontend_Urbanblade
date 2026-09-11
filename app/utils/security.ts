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
    // Los caracteres de control aqui son DELIBERADOS, no un descuido: bloquea
    // colar un tab dentro de javascript: o meter saltos de linea/NUL en la redireccion
    // para evadir los startsWith() de abajo. no-control-regex existe para
    // cazar control chars accidentales, no este caso.
    // eslint-disable-next-line no-control-regex
    /[\\\u0000-\u0020\u007f]/.test(clean) ||
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
