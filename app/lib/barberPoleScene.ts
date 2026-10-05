/*
 * TT39 (HT-16): poste de barbería 3D del hero de la portada.
 *
 * Solo se carga con import() desde components/landing/BarberPole3D.vue, después de la
 * primera pintura y si el navegador cumple las condiciones (pantalla ancha, WebGL, sin
 * movimiento reducido ni ahorro de datos). Vive en app/lib para que Nuxt no lo auto-importe.
 *
 * Todo se construye con código: las franjas son una textura dibujada en un <canvas> con
 * los colores del tema (--gold, --ink, --bg-card), así que no se descarga ninguna imagen
 * ni modelo y la CSP no cambia. La textura se redibuja cuando cambia data-theme en <html>.
 */
import * as THREE from 'three'

export interface BarberPoleScene {
  dispose: () => void
}

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Franjas diagonales del tema; la textura se repite y se desplaza para el giro clásico. */
function paintStripes(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  const colors = [cssVar('--gold', '#d4af37'), cssVar('--ink', '#f2f2f2'), cssVar('--bg-card', '#161616'), cssVar('--ink', '#f2f2f2')]
  const band = height / colors.length

  ctx.clearRect(0, 0, width, height)
  // Cada banda se dibuja inclinada y repetida arriba y abajo para que el mosaico no tenga cortes.
  for (let copy = -1; copy <= 1; copy++) {
    colors.forEach((color, index) => {
      const y = index * band + copy * height
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y + height / 2)
      ctx.lineTo(width, y + height / 2 + band)
      ctx.lineTo(0, y + band)
      ctx.closePath()
      ctx.fill()
    })
  }
}

export function createBarberPoleScene(host: HTMLElement): BarberPoleScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.style.display = 'block'
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(0, 0, 10)

  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(-3, 4, 6)
  scene.add(key)
  const rim = new THREE.PointLight(0xffffff, 18, 12)
  rim.position.set(3, 1, -2)
  scene.add(rim)

  const stripeCanvas = document.createElement('canvas')
  stripeCanvas.width = 128
  stripeCanvas.height = 256
  const stripes = new THREE.CanvasTexture(stripeCanvas)
  stripes.colorSpace = THREE.SRGBColorSpace
  stripes.wrapS = THREE.RepeatWrapping
  stripes.wrapT = THREE.RepeatWrapping
  stripes.repeat.set(1, 2.5)

  const pole = new THREE.Group()
  scene.add(pole)

  const tubeGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3.4, 48, 1, true)
  const tubeMaterial = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.35, metalness: 0.05 })
  pole.add(new THREE.Mesh(tubeGeometry, tubeMaterial))

  const glassGeometry = new THREE.CylinderGeometry(0.58, 0.58, 3.4, 48, 1, true)
  const glassMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false })
  pole.add(new THREE.Mesh(glassGeometry, glassMaterial))

  // Remates metálicos: cuerpo, aro, domo y perilla arriba; cuerpo y aro abajo.
  const metal = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.9 })
  const capGeometry = new THREE.CylinderGeometry(0.7, 0.7, 0.32, 48)
  const ringGeometry = new THREE.TorusGeometry(0.62, 0.05, 12, 48)
  const domeGeometry = new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
  const knobGeometry = new THREE.SphereGeometry(0.14, 16, 12)
  const parts: Array<[THREE.BufferGeometry, number]> = [
    [capGeometry, 1.86], [capGeometry, -1.86], [domeGeometry, 2.02], [knobGeometry, 2.6],
  ]
  for (const [geometry, y] of parts) {
    const mesh = new THREE.Mesh(geometry, metal)
    mesh.position.y = y
    pole.add(mesh)
  }
  for (const y of [1.7, -1.7]) {
    const ring = new THREE.Mesh(ringGeometry, metal)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    pole.add(ring)
  }

  function applyTheme() {
    paintStripes(stripeCanvas)
    stripes.needsUpdate = true
    const gold = new THREE.Color(cssVar('--gold', '#d4af37'))
    metal.color.copy(gold)
    rim.color.copy(gold)
  }
  applyTheme()

  // Inclinación leve hacia el puntero (el contenedor no recibe eventos: escucha la ventana).
  const tilt = { x: 0, y: 0 }
  function onPointerMove(event: PointerEvent) {
    tilt.x = (event.clientX / window.innerWidth - 0.5) * 0.5
    tilt.y = (event.clientY / window.innerHeight - 0.5) * 0.2
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true })

  function resize() {
    const width = host.clientWidth
    const height = host.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height)
    camera.aspect = width / height
    // Que el poste (unos 5.4 de alto con los remates) quepa también a lo ancho.
    camera.position.z = Math.max(10, 6.2 / camera.aspect)
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()

  const themeObserver = new MutationObserver(applyTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  const clock = new THREE.Clock()
  let frame = 0
  let running = false
  let visible = true

  // Solo anima mientras el hero está en pantalla y la pestaña visible.
  function render() {
    if (!visible || document.hidden) {
      running = false
      return
    }
    frame = requestAnimationFrame(render)
    const delta = Math.min(clock.getDelta(), 0.1)
    const time = clock.elapsedTime
    stripes.offset.y -= delta * 0.18
    pole.rotation.y += (tilt.x + Math.sin(time * 0.35) * 0.25 - pole.rotation.y) * 0.04
    pole.rotation.x += (tilt.y - pole.rotation.x) * 0.04
    pole.rotation.z = 0.08 + Math.sin(time * 0.5) * 0.02
    pole.position.y = Math.sin(time * 0.8) * 0.06
    renderer.render(scene, camera)
  }
  function start() {
    if (running) return
    running = true
    clock.getDelta()
    render()
  }

  const viewObserver = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting)
    if (visible) start()
  })
  viewObserver.observe(host)
  function onVisibility() {
    if (!document.hidden) start()
  }
  document.addEventListener('visibilitychange', onVisibility)
  start()

  function dispose() {
    cancelAnimationFrame(frame)
    running = false
    resizeObserver.disconnect()
    themeObserver.disconnect()
    viewObserver.disconnect()
    window.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('visibilitychange', onVisibility)
    for (const geometry of [tubeGeometry, glassGeometry, capGeometry, ringGeometry, domeGeometry, knobGeometry]) geometry.dispose()
    for (const material of [tubeMaterial, glassMaterial, metal]) material.dispose()
    stripes.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }

  return { dispose }
}
