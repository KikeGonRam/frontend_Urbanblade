export function hashFnv1a(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

export function buildDataKey(base: string, params: Record<string, unknown> | undefined): string {
  if (!params) return base
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return base
  entries.sort(([a], [b]) => a.localeCompare(b))
  return `${base}?${hashFnv1a(JSON.stringify(entries))}`
}
