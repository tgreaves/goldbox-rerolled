// Real 3D exploration view (IMPROVEMENTS.md IMP-001), built from a GEO map and its wall sets.
import * as THREE from 'three'
import { EGA, spriteBox, spriteImage, type Picture } from '../data/image'
import { F, pixels } from './upscale'
import type { GeoMap } from '../data/geo'
import type { WallSets } from '../data/walls'

/** The nearest front-wall piece (kind 6) is 7 x 8 tiles; walls keep that aspect. */
export const WALL_HEIGHT = 64 / 56
const EYE = WALL_HEIGHT * 0.5
const EPS = 0.002
const FOV = 70
/** World size of one pixel of a sprite's nearest frame: a 40-pixel orc is about 0.64, half a wall. */
const SPRITE_UNIT = 0.016
/** One approach step takes this long: a steady walk, shorter than a script pause at speed 2+. */
const SPRITE_GLIDE_MS = 450
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
  private sprite: {
    group: THREE.Group
    frames: Picture[]
    distance: number
    /** current depth from the camera, and a glide towards a new one */
    z: number
    glide: { from: number; to: number; t0: number } | null
  } | null = null
  private geo: GeoMap | null = null
  private floorMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color(...EGA[6].map((v) => v / 255)) })

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
    t = new THREE.CanvasTexture(pixels(img)) // enlarged when smoothing is on (IMP-047)
    t.magFilter = F > 1 ? THREE.LinearFilter : THREE.NearestFilter
    t.minFilter = F > 1 ? THREE.LinearFilter : THREE.NearestFilter
    t.generateMipmaps = false
    t.colorSpace = THREE.SRGBColorSpace
    this.textures.set(type, t)
    return t
  }

  build(geo: GeoMap, walls: WallSets) {
    this.geo = geo
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
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), this.floorMaterial)
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
  /** The original's background colours (EGA indices): sky behind the walls, the floor. */
  colours(sky: number, floor: number) {
    const c = (i: number) => new THREE.Color().setRGB(...(EGA[i].map((v) => v / 255) as [number, number, number]), THREE.SRGBColorSpace)
    this.scene.background = c(sky)
    if (this.scene.fog) this.scene.fog.color = c(sky)
    this.floorMaterial.color = this.floorMaterial.map ? new THREE.Color(1, 1, 1) : c(floor)
  }

  /** A ground picture tiled over the floor, `repeat` times along each square (null: plain colour). */
  ground(img: ImageData | null, repeat = 1) {
    this.floorMaterial.map?.dispose()
    if (!img) { this.floorMaterial.map = null; this.floorMaterial.needsUpdate = true; return }
    const t = new THREE.CanvasTexture(pixels(img))
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(16, 16 * repeat) // the floor plane spans the 16 × 16 map
    t.magFilter = F > 1 ? THREE.LinearFilter : THREE.NearestFilter
    t.minFilter = F > 1 ? THREE.LinearFilter : THREE.NearestFilter
    t.generateMipmaps = false
    t.colorSpace = THREE.SRGBColorSpace
    this.floorMaterial.map = t
    this.floorMaterial.color = new THREE.Color(1, 1, 1)
    this.floorMaterial.needsUpdate = true
  }

  go(v: View, ms = 180) {
    this.view = { ...v }
    this.placeSprite()
    const { pos, yaw } = this.target(v)
    let toYaw = yaw
    while (toYaw - this.yaw > Math.PI) toYaw -= 2 * Math.PI
    while (toYaw - this.yaw < -Math.PI) toYaw += 2 * Math.PI
    // nothing to slide (the view refreshed in place): no wait
    if (ms <= 0 || (!this.anim && this.camera.position.distanceTo(pos) < 1e-6 && Math.abs(toYaw - this.yaw) < 1e-6)) {
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
   * Show an encounter sprite standing in its square `distance` squares ahead, or remove it
   * (IMP-020). The nearest, most detailed frame is used at every distance, at one size in the
   * world, and perspective shrinks it; the original instead draws a smaller frame per distance
   * at a fixed spot in its pre-drawn view.
   */
  showSprite(frames: Picture[] | null, distance = 0) {
    // the same encounter stepping closer or back: glide there (IMP-021)
    if (frames && this.sprite?.frames === frames) {
      const sp = this.sprite
      sp.distance = distance
      const to = this.spriteDepth(distance)
      sp.glide = to === sp.z ? null : { from: sp.z, to, t0: performance.now() }
      return
    }
    if (this.sprite) {
      this.scene.remove(this.sprite.group)
      this.sprite.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        o.geometry.dispose()
        const m = o.material as THREE.MeshBasicMaterial
        m.map?.dispose()
        m.dispose()
      })
      this.sprite = null
    }
    if (!frames?.length) return
    const pic = frames[0]
    const box = spriteBox(pic)
    const u = SPRITE_UNIT
    const tex = new THREE.CanvasTexture(pixels(spriteImage(pic)))
    tex.magFilter = F > 1 ? THREE.LinearFilter : THREE.NearestFilter
    tex.minFilter = F > 1 ? THREE.LinearFilter : THREE.NearestFilter
    tex.generateMipmaps = false
    tex.colorSpace = THREE.SRGBColorSpace
    const group = new THREE.Group()
    const card = new THREE.Mesh(new THREE.PlaneGeometry(pic.width * u, pic.height * u),
      new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }))
    // centred on the square, lowest drawn row (the drop shadow) on the floor
    card.position.set((pic.width / 2 - (box.left + box.right + 1) / 2) * u, (box.bottom + 1 - pic.height / 2) * u, 0)
    group.add(card)
    this.sprite = { group, frames, distance, z: 0, glide: null }
    this.placeSprite()
    this.scene.add(group)
  }

  /**
   * Depth from the camera for a sprite `distance` squares away. Scripts count an open door as
   * passable, so an encounter can be set beyond a door, which is still a drawn wall. Distances
   * 0-2 are spread over the room in front of the first wall in view, so that every approach step
   * shows and the sprite is never hidden behind the wall.
   */
  private spriteDepth(distance: number): number {
    const dir = DIRS[this.view.facing]
    let open = 0
    for (let x = this.view.x, y = this.view.y; open < 2 && this.geo?.wall(x, y, this.view.facing) === 0; open++) {
      x = (x + dir[0]) & 15
      y = (y + dir[1]) & 15
    }
    // the camera is 0.35 behind the centre of its square, so the first wall is open + 0.85 away
    const step = Math.max(0, Math.min(1, (open + 0.85 - 0.8) / 2))
    return 0.65 + distance * step
  }

  /** Position the sprite relative to the current view; scripts can show it before the view is set. */
  private placeSprite() {
    if (!this.sprite) return
    this.sprite.z = this.spriteDepth(this.sprite.distance)
    this.sprite.glide = null
    this.poseSprite()
  }

  private poseSprite() {
    if (!this.sprite) return
    const { group, z } = this.sprite
    const dir = DIRS[this.view.facing]
    const eye = this.target(this.view).pos
    group.position.set(eye.x + dir[0] * z, 0, eye.z + dir[1] * z)
    group.rotation.y = -this.view.facing * (Math.PI / 2)
  }

  busy(): boolean {
    return this.anim !== null
  }

  /** End the current slide at once (a key pressed during it: move on without waiting). */
  finish() {
    if (!this.anim) return
    this.camera.position.copy(this.anim.to)
    this.yaw = this.anim.toYaw
    this.anim = null
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
    const sp = this.sprite
    if (sp?.glide) {
      const k = Math.min((now - sp.glide.t0) / SPRITE_GLIDE_MS, 1)
      sp.z = sp.glide.from + (sp.glide.to - sp.glide.from) * k
      if (k >= 1) sp.glide = null
      this.poseSprite()
    }
    this.camera.rotation.set(0, this.yaw, 0)
    this.renderer.render(this.scene, this.camera)
  }
}
