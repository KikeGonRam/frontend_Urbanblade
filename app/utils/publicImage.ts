/**
 * Requests a larger, higher-quality variant only for providers that support
 * URL transformations. Storage URLs from the API are left untouched because
 * guessing their query contract could break signed or private URLs.
 */
export function publicImageUrl(url: string | null, width = 1600): string | null {
  if (!url) return null
  if (!url.includes('images.unsplash.com')) return url

  try {
    const parsed = new URL(url)
    parsed.searchParams.set('w', String(width))
    parsed.searchParams.set('q', '90')
    parsed.searchParams.set('auto', 'format')
    parsed.searchParams.set('fit', 'max')

    return parsed.toString()
  } catch {
    return url
  }
}
