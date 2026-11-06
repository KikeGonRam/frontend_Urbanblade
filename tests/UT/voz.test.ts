import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/* Fase A del plan de calidez (docs/GUIA_DE_VOZ.md): los estados vacíos no abren con un «Sin …» seco. */

function vue(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    return statSync(ruta).isDirectory() ? vue(ruta) : ruta.endsWith('.vue') ? [ruta] : []
  })
}

describe('voz de los estados vacíos', () => {
  const archivos = vue(resolve(process.cwd(), 'app'))

  it('ningún título de estado vacío empieza con «Sin …»', () => {
    const frios: string[] = []
    for (const archivo of archivos) {
      const texto = readFileSync(archivo, 'utf8')
      for (const m of texto.matchAll(/(?:title|empty-title|emptyTitle)="(Sin [^"]+)"/g)) frios.push(`${archivo}: ${m[1]}`)
    }

    expect(frios).toEqual([])
  })

  it('los estados «al día» y «todavía» usan la redacción de la guía', () => {
    const todo = archivos.map(a => readFileSync(a, 'utf8')).join('\n')

    expect(todo).toContain('Estás al día: no hay comprobantes pendientes')
    expect(todo).toContain('Todavía no hay productos registrados')
    expect(todo).toContain('Por ahora no hay servicios disponibles')
  })
})
