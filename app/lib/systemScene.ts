/*
 * TT38 (HT-15): escena three.js del mapa del sistema en /system.
 *
 * Este módulo solo se carga con import() desde components/system/Map3D.vue, después de
 * comprobar que hay WebGL y que el usuario no pidió movimiento reducido; así three.js
 * queda en un chunk aparte que solo descarga /system. Vive en app/lib (y no en utils o
 * composables) para que Nuxt no lo auto-importe y nadie lo meta por accidente en el
 * bundle principal.
 *
 * Los colores salen de las variables CSS del tema activo (--gold, --line, --muted y
 * --success/--warning/--danger-rgb) y se recalculan cuando cambia data-theme en <html>.
 * Las etiquetas son DOM (CSS2DRenderer) con la clase .ub-sysmap-label de Map3D.vue.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import type { SystemNode, SystemNodeState } from '~/utils/systemMap'

export interface SystemScene {
  update: (nodes: SystemNode[]) => void
  select: (id: string | null) => void
  dispose: () => void
}

const STATE_VAR: Record<SystemNodeState, string> = {
  activo: '--success-rgb',
  lento: '--warning-rgb',
  caido: '--danger-rgb',
  sin_uso: '--muted',
}

/** Vueltas por segundo del paquete que recorre cada enlace; sin flujo hacia lo caído o sin uso. */
const PACKET_SPEED: Record<SystemNodeState, number> = { activo: 0.45, lento: 0.15, caido: 0, sin_uso: 0 }

const RADIUS = { api: 0.85, servicio: 0.55, tarea: 0.3 }

interface NodeView {
  node: SystemNode
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
  link: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>
  packet: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null
  label: CSS2DObject
  offset: number
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Acepta "#rrggbb" o canales "R G B" (formato de las variables *-rgb del tema). */
function themeColor(name: string, fallback: string): THREE.Color {
  const value = cssVar(name)
  const channels = value.match(/^(\d+)\s+(\d+)\s+(\d+)$/)
  if (channels) {
    return new THREE.Color().setRGB(Number(channels[1]) / 255, Number(channels[2]) / 255, Number(channels[3]) / 255, THREE.SRGBColorSpace)
  }

  return new THREE.Color(value || fallback)
}

/** Posición de cada nodo: la API al centro, servicios en un anillo y tareas en otro más abajo. */
function layout(nodes: SystemNode[]): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>()
  const services = nodes.filter(node => node.kind === 'servicio')
  const tasks = nodes.filter(node => node.kind === 'tarea')

  for (const node of nodes) {
    if (node.kind === 'api') positions.set(node.id, new THREE.Vector3(0, 0.4, 0))
  }
  services.forEach((node, index) => {
    const angle = (index / services.length) * Math.PI * 2 - Math.PI / 2
    positions.set(node.id, new THREE.Vector3(Math.cos(angle) * 3.2, 0.4, Math.sin(angle) * 3.2))
  })
  tasks.forEach((node, index) => {
    const angle = (index / tasks.length) * Math.PI * 2 + Math.PI / 6
    positions.set(node.id, new THREE.Vector3(Math.cos(angle) * 5, -1.1, Math.sin(angle) * 5))
  })

  return positions
}

export function createSystemScene(host: HTMLElement, options: { onSelect: (id: string) => void }): SystemScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.style.display = 'block'
  host.appendChild(renderer.domElement)

  const labels = new CSS2DRenderer()
  labels.domElement.style.position = 'absolute'
  labels.domElement.style.inset = '0'
  labels.domElement.style.pointerEvents = 'none'
  host.appendChild(labels.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(0, 6, 10.5)

  scene.add(new THREE.AmbientLight(0xffffff, 1.4))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(4, 8, 6)
  scene.add(sun)

  // Blanco en las dos tintas de la cuadrícula: así el color del material (el --line del
  // tema) es el color final; con las tintas grises por defecto en noir quedaba negra.
  const floor = new THREE.GridHelper(14, 14, 0xffffff, 0xffffff)
  floor.position.y = -1.9
  const floorMaterial = floor.material as THREE.LineBasicMaterial
  floorMaterial.transparent = true
  floorMaterial.opacity = 0.35
  scene.add(floor)

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.05, 12, 48),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 }),
  )
  ring.visible = false
  scene.add(ring)

  const graph = new THREE.Group()
  scene.add(graph)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.enableZoom = false
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.6
  controls.minPolarAngle = Math.PI / 5
  controls.maxPolarAngle = Math.PI / 2.1

  let views: NodeView[] = []
  let selectedId: string | null = null
  let apiPosition = new THREE.Vector3(0, 0.4, 0)

  function applyTheme() {
    const line = themeColor('--line', '#2c2c2c')
    floorMaterial.color.copy(line).lerp(themeColor('--muted', '#9c9c9c'), 0.25)
    ring.material.color.copy(themeColor('--gold', '#d4af37'))
    for (const view of views) {
      const color = themeColor(STATE_VAR[view.node.state], '#9c9c9c')
      view.mesh.material.color.copy(color)
      view.mesh.material.emissive.copy(color).multiplyScalar(0.35)
      view.link.material.color.copy(view.node.state === 'activo' ? line.clone().lerp(color, 0.55) : color)
      view.packet?.material.color.copy(color)
    }
  }

  function clearGraph() {
    for (const view of views) {
      view.mesh.geometry.dispose()
      view.mesh.material.dispose()
      view.link.geometry.dispose()
      view.link.material.dispose()
      view.packet?.geometry.dispose()
      view.packet?.material.dispose()
      view.label.element.remove()
    }
    graph.clear()
    views = []
  }

  function select(id: string | null) {
    selectedId = id
    const view = views.find(item => item.node.id === id)
    ring.visible = Boolean(view)
    for (const item of views) item.label.element.classList.toggle('is-selected', item === view)
    if (view) {
      ring.position.copy(view.mesh.position)
      ring.scale.setScalar(RADIUS[view.node.kind] + 0.25)
    }
  }

  function update(nodes: SystemNode[]) {
    clearGraph()
    const positions = layout(nodes)
    apiPosition = positions.get('api') ?? new THREE.Vector3(0, 0.4, 0)

    nodes.forEach((node, index) => {
      const position = positions.get(node.id) ?? new THREE.Vector3()
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS[node.kind], 32, 20),
        new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.15 }),
      )
      mesh.position.copy(position)
      mesh.userData.id = node.id
      graph.add(mesh)

      const link = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([apiPosition, position]),
        new THREE.LineBasicMaterial({ transparent: true, opacity: node.state === 'caido' ? 0.9 : 0.6 }),
      )
      link.visible = node.kind !== 'api'
      graph.add(link)

      let packet: NodeView['packet'] = null
      if (node.kind !== 'api' && PACKET_SPEED[node.state] > 0) {
        packet = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial())
        graph.add(packet)
      }

      const element = document.createElement('div')
      element.className = 'ub-sysmap-label'
      element.dataset.state = node.state
      element.textContent = node.label
      const label = new CSS2DObject(element)
      label.position.set(0, RADIUS[node.kind] + 0.35, 0)
      mesh.add(label)

      views.push({ node, mesh, link, packet, label, offset: index * 0.37 })
    })

    applyTheme()
    select(selectedId)
  }

  // Clic (sin arrastre) sobre un nodo: lo selecciona. Arrastrar solo gira la cámara.
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let downAt: { x: number, y: number } | null = null

  function nodeAt(event: PointerEvent): string | null {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(views.map(view => view.mesh), false)[0]

    return (hit?.object.userData.id as string | undefined) ?? null
  }
  function onPointerDown(event: PointerEvent) {
    downAt = { x: event.clientX, y: event.clientY }
  }
  function onPointerUp(event: PointerEvent) {
    const start = downAt
    downAt = null
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return
    const id = nodeAt(event)
    if (id) options.onSelect(id)
  }
  function onPointerMove(event: PointerEvent) {
    if (event.buttons !== 0) return
    renderer.domElement.style.cursor = nodeAt(event) ? 'pointer' : 'grab'
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('pointermove', onPointerMove)

  function resize() {
    const width = host.clientWidth
    const height = host.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height)
    labels.setSize(width, height)
    camera.aspect = width / height
    // En lienzos angostos se aleja la cámara para que quepa el anillo de tareas.
    camera.position.setLength(Math.max(12, 18 / camera.aspect))
    camera.updateProjectionMatrix()
  }
  // La altura del contenedor la fija la clase de Map3D.vue; el lienzo nunca la empuja.
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()

  const themeObserver = new MutationObserver(applyTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  const clock = new THREE.Clock()
  let frame = 0

  function render() {
    frame = requestAnimationFrame(render)
    if (document.hidden) return
    const time = clock.getElapsedTime()
    controls.update()

    for (const view of views) {
      if (view.node.state === 'caido') view.mesh.scale.setScalar(1 + Math.sin(time * 4) * 0.1)
      if (view.packet) {
        const progress = (time * PACKET_SPEED[view.node.state] + view.offset) % 1
        view.packet.position.lerpVectors(apiPosition, view.mesh.position, progress)
      }
    }
    ring.quaternion.copy(camera.quaternion)

    renderer.render(scene, camera)
    labels.render(scene, camera)
  }
  render()

  function dispose() {
    cancelAnimationFrame(frame)
    resizeObserver.disconnect()
    themeObserver.disconnect()
    renderer.domElement.removeEventListener('pointerdown', onPointerDown)
    renderer.domElement.removeEventListener('pointerup', onPointerUp)
    renderer.domElement.removeEventListener('pointermove', onPointerMove)
    controls.dispose()
    clearGraph()
    ring.geometry.dispose()
    ring.material.dispose()
    floor.geometry.dispose()
    floorMaterial.dispose()
    renderer.dispose()
    renderer.domElement.remove()
    labels.domElement.remove()
  }

  return { update, select, dispose }
}
