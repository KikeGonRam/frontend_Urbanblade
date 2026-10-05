#!/usr/bin/env node
/*
 * Gate de SCA (HT-08 / TT22): corre `npm audit --json` y falla con cualquier
 * advisory HIGH o CRITICAL del árbol completo (prod + dev), igual que
 * `npm audit --audit-level=high`, salvo los que estén en ALLOWLIST.
 *
 * La allowlist es solo para advisories SIN versión corregida
 * (first_patched_version: null) que no llegan a la imagen de producción.
 * Cada entrada caduca en `revisar`: pasada esa fecha el CI vuelve a fallar
 * y hay que revisar si ya salió el parche (y quitar la entrada) o renovarla
 * con una nueva justificación. Un advisory nuevo, aunque sea del mismo
 * paquete, NO queda cubierto: se compara por ID de GHSA.
 *
 * Uso: node scripts/audit-gate.mjs   (o `npm run audit:gate`)
 */
import { spawnSync } from 'node:child_process'

const ALLOWLIST = [
  {
    id: 'GHSA-vfj7-8cjw-p6xm',
    paquete: 'braces <=3.0.3',
    motivo:
      'Sin versión corregida. Entra solo por nitropack -> globby -> fast-glob -> micromatch '
      + '(build de Nuxt) con patrones del propio proyecto, no de usuarios; no está en .output/.',
    revisar: '2026-11-13',
  },
  {
    id: 'GHSA-86w9-cpqp-85rv',
    paquete: 'node-forge <=1.4.0',
    motivo:
      'Sin versión corregida. Entra solo por listhen (servidor de desarrollo de @nuxt/cli y '
      + 'nitropack), que lo usa para certificados autofirmados, no para verificar firmas RSA; '
      + 'no está en .output/.',
    revisar: '2026-11-13',
  },
]

const BLOQUEANTES = new Set(['high', 'critical'])
const hoy = new Date().toISOString().slice(0, 10)

// Comando fijo en una sola cadena: con shell (necesario para npm.cmd en
// Windows) Node desaconseja pasar los argumentos aparte.
const npm = spawnSync('npm audit --json', {
  encoding: 'utf8',
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
})

let reporte
try {
  reporte = JSON.parse(npm.stdout)
}
catch {
  console.error('npm audit no devolvió JSON válido:\n', npm.stderr || npm.stdout)
  process.exit(1)
}
if (reporte.error) {
  console.error('npm audit falló:', reporte.error.summary ?? reporte.error)
  process.exit(1)
}

// Advisories raíz: los objetos en `via` (las cadenas son paquetes que solo
// heredan la vulnerabilidad de una dependencia).
const advisories = new Map()
for (const vuln of Object.values(reporte.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via === 'string' || !BLOQUEANTES.has(via.severity)) continue
    const id = via.url?.split('/').pop() ?? String(via.source)
    advisories.set(id, { id, paquete: `${via.name} ${via.range}`, titulo: via.title, url: via.url })
  }
}

const vigentes = new Map(ALLOWLIST.filter(e => e.revisar >= hoy).map(e => [e.id, e]))
const caducadas = ALLOWLIST.filter(e => e.revisar < hoy)

let fallo = false
for (const adv of advisories.values()) {
  const permitido = vigentes.get(adv.id)
  if (permitido) {
    console.log(`PERMITIDO  ${adv.id}  ${adv.paquete} (revisar antes de ${permitido.revisar})`)
    console.log(`           ${permitido.motivo}`)
  }
  else {
    fallo = true
    console.error(`BLOQUEA    ${adv.id}  ${adv.paquete}  ${adv.titulo}\n           ${adv.url}`)
  }
}

for (const e of caducadas) {
  if (advisories.has(e.id)) console.error(`CADUCADA   ${e.id}: la excepción venció el ${e.revisar}; revisar si ya hay parche o renovarla.`)
}
for (const e of vigentes.values()) {
  if (!advisories.has(e.id)) console.warn(`SOBRA      ${e.id} ya no aparece en npm audit; quitarla de la allowlist.`)
}

const totales = reporte.metadata?.vulnerabilities ?? {}
console.log(`\nnpm audit: ${totales.critical ?? 0} critical, ${totales.high ?? 0} high, ${totales.moderate ?? 0} moderate, ${totales.low ?? 0} low (incluye paquetes que solo heredan el advisory)`)

if (fallo) {
  console.error('\nGate de SCA: FALLA. Hay advisories HIGH/CRITICAL fuera de la allowlist.')
  process.exit(1)
}
console.log('Gate de SCA: OK.')
