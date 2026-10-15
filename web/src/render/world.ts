// Real 3D exploration view (IMPROVEMENTS.md IMP-001), built from a GEO map and its wall sets.
import * as THREE from 'three'
import { EGA, spriteFeet, spriteImage, type Picture } from '../data/image'
import type { GeoMap } from '../data/geo'
import type { WallSets } from '../data/walls'

/** The nearest front-wall piece (kind 6) is 7 x 8 tiles; walls keep that aspect. */
export const WALL_HEIGHT = 64 / 56
const EYE = WALL_HEIGHT * 0.5
const EPS = 0.002
const FOV = 70
/** Focal length in pixels of the original 88-pixel-high view, for this camera's field of view. */
const FOCAL88 = 44 / Math.tan((FOV / 2) * (Math.PI / 180))
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]

export interface View {
  x: number
  y: number
  /** 0 N, 1 E, 2 S, 3 W */
  facing: number
}

export class World {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 40)
  private textures = new Map<number, THREE.Texture>()
  private group = new THREE.Group()
  private anim: { from: THREE.Vector3; to: THREE.Vector3; fromYaw: number; toYaw: number; t0: number; ms: number } | null = null
  private yaw = 0
  private view: View = { x: 0, y: 0, facing: 0 }
  private sprite: { mesh: THREE.Mesh; pic: Picture; distance: number } | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.scene.background = new THREE.Color(0x0b1a33)
    this.scene.fog = new THREE.Fog(0x0b1a33, 3, 9)
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(0.4, 1, 0.7)
    this.scene.add(sun)
    this.scene.add(this.group)
  }

  /** Wall texture for type 1-15: the nearest front-wall piece, tile 0 transparent. */
  private texture(walls: WallSets, type: number): THREE.Texture {
    let t = this.textures.get(type)
    if (t) return t
    const p = walls.piece(type, 6)
    const c = document.createElement('canvas')
    c.width = p.width
    c.height = p.height
    const img = c.getContext('2d')!.createImageData(p.width, p.height)
    for (let i = 0; i < p.pixels.length; i++) {
      const v = p.pixels[i]
      if (v < 0) continue
      const [r, g, b] = EGA[v]
      img.data.set([r, g, b, 255], i * 4)
    }
    c.getContext('2d')!.putImageData(img, 0, 0)
    t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.colorSpace = THREE.SRGBColorSpace
    this.textures.set(type, t)
    return t
  }

  build(geo: GeoMap, walls: WallSets) {
    this.group.clear()
    this.textures.forEach((t) => t.dispose())
    this.textures.clear()
    const materials = new Map<number, THREE.Material>()
    const mat = (type: number) => {
      let m = materials.get(type)
      if (!m) {
        m = new THREE.MeshLambertMaterial({ map: this.texture(walls, type), alphaTest: 0.5, side: THREE.FrontSide })
        materials.set(type, m)
      }
      return m
    }
    const plane = new THREE.PlaneGeometry(1, WALL_HEIGHT)
    // each square draws its own four sides, facing into the square
    const sides: [number, number, number][] = [
      [0.5, EPS, 0], // N edge, normal +z (south)
      [1 - EPS, 0.5, -Math.PI / 2], // E edge, normal -x
      [0.5, 1 - EPS, Math.PI], // S edge, normal -z
      [EPS, 0.5, Math.PI / 2], // W edge, normal +x
    ]
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      for (let d = 0; d < 4; d++) {
        const type = geo.wall(x, y, d)
        if (!type) continue
        const m = new THREE.Mesh(plane, mat(type))
        const [ox, oz, rot] = sides[d]
        m.position.set(x + ox, WALL_HEIGHT / 2, y + oz)
        m.rotation.y = rot
        this.group.add(m)
      }
    }
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(...EGA[8].map((v) => v / 255)) }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(8, 0, 8)
    this.group.add(floor)
  }

  private target(v: View): { pos: THREE.Vector3; yaw: number } {
    const dir = DIRS[v.facing]
    // stand a little behind the square's centre so its side walls are in view, as in the original
    const pos = new THREE.Vector3(v.x + 0.5 - dir[0] * 0.35, EYE, v.y + 0.5 - dir[1] * 0.35)
    return { pos, yaw: -v.facing * (Math.PI / 2) }
  }

  /** Move the camera to a view, animated over `ms` (0 = jump). */
  go(v: View, ms = 180) {
    this.view = { ...v }
    this.placeSprite()
    const { pos, yaw } = this.target(v)
    let toYaw = yaw
    while (toYaw - this.yaw > Math.PI) toYaw -= 2 * Math.PI
    while (toYaw - this.yaw < -Math.PI) toYaw += 2 * Math.PI
    if (ms <= 0) {
      this.camera.position.copy(pos)
      this.yaw = toYaw
      this.anim = null
      return
    }
    // wrapping across the map edge jumps instead of sliding over the whole map
    const jump = this.camera.position.distanceTo(pos) > 1.5
    this.anim = {
      from: jump ? pos.clone() : this.camera.position.clone(),
      to: pos,
      fromYaw: this.yaw,
      toYaw,
      t0: performance.now(),
      ms,
    }
  }

  /**
   * Show an encounter sprite frame standing on the floor `distance` squares ahead, or remove it
   * (IMP-020). Each frame keeps its original on-screen pixel size: it is placed at depth z and
   * scaled by z / focal length. The original draws the frame at a fixed spot in its pre-drawn
   * view, which does not line up with this camera's floor.
   */
  showSprite(pic: Picture | null, distance = 0) {
    if (this.sprite) {
      const { mesh } = this.sprite
      this.scene.remove(mesh)
      const m = mesh.material as THREE.MeshBasicMaterial
      m.map?.dispose()
      m.dispose()
      mesh.geometry.dispose()
      this.sprite = null
    }
    if (!pic) return
    const c = document.createElement('canvas')
    c.width = pic.width
    c.height = pic.height
    c.getContext('2d')!.putImageData(spriteImage(pic), 0, 0)
    const tex = new THREE.CanvasTexture(c)
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    tex.colorSpace = THREE.SRGBColorSpace
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }))
    this.sprite = { mesh, pic, distance }
    this.placeSprite()
    this.scene.add(mesh)
  }

  /** Position the sprite relative to the current view; scripts can show it before the view is set. */
  private placeSprite() {
    if (!this.sprite) return
    const { mesh, pic, distance } = this.sprite
    // the figure stands near the far side of its square: 0.8 from the camera at distance 0
    const z = distance + 0.8
    const s = z / FOCAL88
    const dir = DIRS[this.view.facing]
    const right = [-dir[1], dir[0]]
    // horizontal place as in the original: header x cells from the left of the 88-pixel view
    const side = (pic.x * 8 + pic.width / 2 - 44) * s
    const eye = this.target(this.view).pos
    mesh.scale.set(pic.width * s, pic.height * s, 1)
    mesh.position.set(
      eye.x + dir[0] * z + right[0] * side,
      (spriteFeet(pic) + 1 - pic.height / 2) * s,
      eye.z + dir[1] * z + right[1] * side,
    )
    mesh.rotation.y = -this.view.facing * (Math.PI / 2)
  }

  busy(): boolean {
    return this.anim !== null
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  frame(now: number) {
    if (this.anim) {
      const a = this.anim
      const k = Math.min((now - a.t0) / a.ms, 1)
      const e = k * k * (3 - 2 * k)
      this.camera.position.lerpVectors(a.from, a.to, e)
      this.yaw = a.fromYaw + (a.toYaw - a.fromYaw) * e
      if (k >= 1) this.anim = null
    }
    this.camera.rotation.set(0, this.yaw, 0)
    this.renderer.render(this.scene, this.camera)
  }
}
