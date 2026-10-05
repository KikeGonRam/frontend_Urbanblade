#!/usr/bin/env node
/*
 * Contrato de API (T094 / HU-27) — ver .claude/skills/api-contract-plan/SKILL.md
 *
 * El backend (`barber`) publica su OpenAPI en public/docs/openapi.yaml. Este repo
 * es independiente y su CI no puede leer ../barber, así que guarda una copia en
 * contract/openapi.yaml y genera de ella app/types/api.d.ts (openapi-typescript).
 *
 *   node scripts/contract.mjs sync    Copia el spec de barber (hermano local o
 *                                     GitHub raw de `main`) y regenera los tipos.
 *   node scripts/contract.mjs types   Regenera app/types/api.d.ts desde la copia.
 *   node scripts/contract.mjs check   Falla si api.d.ts no corresponde a la copia
 *                                     versionada (es el gate bloqueante del CI).
 *   node scripts/contract.mjs drift   Compara la copia con el spec de `main` de
 *                                     barber; sale 1 si quedó atrás (el CI solo avisa).
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COPY = join(root, 'contract', 'openapi.yaml')
const TYPES = join(root, 'app', 'types', 'api.d.ts')
const SIBLING = resolve(root, '..', 'barber', 'public', 'docs', 'openapi.yaml')
const RAW = 'https://raw.githubusercontent.com/KikeGonRam/barber/main/public/docs/openapi.yaml'
const CLI = join(root, 'node_modules', 'openapi-typescript', 'bin', 'cli.js')

// Normaliza saltos de línea: en Windows git puede entregar CRLF y no es deriva.
const normalize = text => text.replace(/\r\n/g, '\n')

function generate(output) {
  const run = spawnSync(process.execPath, [CLI, COPY, '-o', output], { stdio: ['ignore', 'ignore', 'inherit'] })
  if (run.status !== 0) {
    console.error('openapi-typescript falló al leer contract/openapi.yaml.')
    process.exit(1)
  }
}

async function fetchMain() {
  const response = await fetch(RAW, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  return normalize(await response.text())
}

const [command] = process.argv.slice(2)

if (command === 'sync') {
  if (existsSync(SIBLING)) {
    copyFileSync(SIBLING, COPY)
    console.log('Spec copiado desde ../barber (working tree local).')
  } else {
    writeFileSync(COPY, await fetchMain())
    console.log('Spec descargado de barber@main.')
  }
  generate(TYPES)
  console.log('app/types/api.d.ts regenerado.')
} else if (command === 'types') {
  generate(TYPES)
  console.log('app/types/api.d.ts regenerado.')
} else if (command === 'check') {
  const dir = mkdtempSync(join(tmpdir(), 'contract-'))
  try {
    const fresh = join(dir, 'api.d.ts')
    generate(fresh)
    if (normalize(readFileSync(fresh, 'utf8')) !== normalize(readFileSync(TYPES, 'utf8'))) {
      console.error('app/types/api.d.ts no corresponde a contract/openapi.yaml.')
      console.error('Corre `npm run contract:types` y commitea el resultado.')
      process.exit(1)
    }
    console.log('Tipos al día con contract/openapi.yaml.')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
} else if (command === 'drift') {
  // exitCode en vez de process.exit(): con la conexión de fetch aún cerrándose,
  // process.exit() dispara un assert de libuv en Windows (UV_HANDLE_CLOSING).
  let main = null
  try {
    main = await fetchMain()
  } catch (error) {
    console.log(`No se pudo leer barber@main (${error.message}); se omite la comparación.`)
  }
  if (main === null) {
    // sin red no hay nada que comparar
  } else if (main !== normalize(readFileSync(COPY, 'utf8'))) {
    console.error('contract/openapi.yaml quedó atrás del spec de barber@main.')
    console.error('Corre `npm run contract:sync`, revisa el diff de app/types/api.d.ts y commitea.')
    process.exitCode = 1
  } else {
    console.log('La copia coincide con barber@main.')
  }
} else {
  console.error('Uso: node scripts/contract.mjs sync | types | check | drift')
  process.exit(2)
}
