import {
  AmbientLight,
  Box3,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  Spherical,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  BoxGeometry,
  DoubleSide,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ScaleOverlay } from './overlay';

// NainDev brand colours (brandbook/tokens.css).
const BRAND_RED = 0xff001f;
const BRAND_GREEN = 0x80ff00;

export interface Anchor {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface StageOptions {
  /** Recording mode: no controls, camera driven only by `setTime` (deterministic). */
  record: boolean;
  reducedMotion: boolean;
}

const EDGE_PAIRS: [number, number][] = [
  [0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7],
];

function boxCorners(min: Vector3, max: Vector3): Vector3[] {
  const c: Vector3[] = [];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) c.push(new Vector3(x, y, z));
  return c;
}

/** Thick box outline built from 12 thin cylinders (WebGL lines are always 1 px wide). */
function boxFrame(min: Vector3, max: Vector3, thickness: number, material: Material): Group {
  const group = new Group();
  const corners = boxCorners(min, max);
  for (const [a, b] of EDGE_PAIRS) {
    const from = corners[a];
    const to = corners[b];
    const length = from.distanceTo(to);
    const bar = new Mesh(new CylinderGeometry(thickness, thickness, length, 8), material);
    bar.position.copy(from).add(to).multiplyScalar(0.5);
    bar.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize());
    group.add(bar);
  }
  return group;
}

function glowTexture(): Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(60,110,200,0.55)');
    grad.addColorStop(0.55, 'rgba(0,71,171,0.18)');
    grad.addColorStop(1, 'rgba(0,71,171,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function disposeObject(root: Object3D): void {
  root.traverse((node) => {
    const mesh = node as Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of materials) {
      for (const value of Object.values(m as unknown as Record<string, unknown>)) {
        if (value instanceof Texture) value.dispose();
      }
      m.dispose();
    }
  });
}

export class Stage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.01, 200);
  private readonly controls: OrbitControls | null;
  private readonly floor: Mesh;
  private readonly glow: Mesh;
  private readonly key: DirectionalLight;
  private readonly pmrem: PMREMGenerator;
  private readonly resizeObserver: ResizeObserver;
  private model: Object3D | null = null;
  private overlayGroup: Group | null = null;
  private overlay: ScaleOverlay | null = null;
  private bounds = new Box3();
  private frameRadius = 1;
  private target = new Vector3();
  private autoRotate: boolean;
  private rafId = 0;
  private timeMs = 0;
  private baseAzimuth = Math.PI * 0.2;
  private disposed = false;

  onAnchors: ((anchors: Anchor[]) => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: StageOptions,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    this.pmrem = new PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment();
    this.scene.environment = this.pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environmentIntensity = 0.95;
    envScene.dispose();

    this.scene.add(new AmbientLight(0xffffff, 0.15));
    this.key = new DirectionalLight(0xffffff, 2.4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.radius = 7;
    this.key.shadow.bias = -0.0004;
    this.scene.add(this.key, this.key.target);
    const rim = new DirectionalLight(0x5b8dff, 1.4);
    rim.position.set(-4, 3, -5);
    this.scene.add(rim);

    this.floor = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial({ opacity: 0.38 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.glow = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.scene.add(this.glow, this.floor);

    this.autoRotate = !options.reducedMotion;
    if (options.record) {
      this.controls = null;
    } else {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = !options.reducedMotion;
      this.controls.dampingFactor = 0.07;
      this.controls.enablePan = false;
      this.controls.minPolarAngle = 0.2;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
      this.controls.autoRotateSpeed = 1.6;
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.loop();
  }

  async loadGlb(buffer: ArrayBuffer): Promise<void> {
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    if (this.disposed) {
      disposeObject(gltf.scene);
      return;
    }
    if (this.model) {
      this.scene.remove(this.model);
      disposeObject(this.model);
    }
    this.model = gltf.scene;
    this.model.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    this.scene.add(this.model);
    this.bounds = new Box3().setFromObject(this.model);
    this.refit();
    this.renderFrame();
  }

  setOverlay(overlay: ScaleOverlay | null): void {
    this.overlay = overlay;
    if (this.overlayGroup) {
      this.scene.remove(this.overlayGroup);
      disposeObject(this.overlayGroup);
      this.overlayGroup = null;
    }
    if (overlay && this.model) this.overlayGroup = this.buildOverlay(overlay);
    if (this.overlayGroup) this.scene.add(this.overlayGroup);
    this.refit();
    this.renderFrame();
  }

  setAutoRotate(value: boolean): void {
    this.autoRotate = value && !this.options.reducedMotion;
  }

  /** Keyboard orbit for people who cannot drag: rotates the camera around the model. */
  orbitBy(deltaAzimuth: number, deltaElevation: number): void {
    if (!this.controls) return;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new Spherical().setFromVector3(offset);
    spherical.theta += deltaAzimuth;
    spherical.phi = Math.min(Math.PI / 2 - 0.02, Math.max(0.2, spherical.phi - deltaElevation));
    this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(spherical));
    this.controls.update();
    this.renderFrame();
  }

  /** Recording mode: camera azimuth is a pure function of time. */
  setTime(ms: number): void {
    this.timeMs = ms;
    this.renderFrame();
  }

  renderFrame(): void {
    if (this.disposed) return;
    if (this.options.record) this.placeCameraFromTime();
    else this.controls?.update();
    this.renderer.render(this.scene, this.camera);
    this.emitAnchors();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.controls?.dispose();
    if (this.model) disposeObject(this.model);
    if (this.overlayGroup) disposeObject(this.overlayGroup);
    this.floor.geometry.dispose();
    (this.floor.material as Material).dispose();
    this.glow.geometry.dispose();
    (this.glow.material as MeshBasicMaterial).map?.dispose();
    (this.glow.material as Material).dispose();
    this.scene.environment?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    if (this.options.record) return; // Frames are produced by `setTime` only.
    if (this.controls) this.controls.autoRotate = this.autoRotate;
    this.renderFrame();
  };

  private placeCameraFromTime(): void {
    // Slow ease-in-out sweep: deterministic, readable on a phone, never a full spin.
    const seconds = this.timeMs / 1000;
    const sweep = this.options.reducedMotion ? 0 : Math.sin(seconds * 0.45) * 0.9;
    const azimuth = this.baseAzimuth + sweep;
    const elevation = 0.28;
    const distance = this.fitDistance();
    this.camera.position.set(
      this.target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
      this.target.y + distance * Math.sin(elevation),
      this.target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  private fitDistance(): number {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    return (this.frameRadius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.05;
  }

  private resize(): void {
    const parent = this.canvas.parentElement ?? this.canvas;
    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.refit(false);
    if (this.options.record || this.disposed) this.renderFrame();
  }

  private refit(resetCamera = true): void {
    if (!this.model) return;
    const box = this.bounds.clone();
    if (this.overlay?.exceeds) {
      const half = this.overlay.limit / 2;
      const c = box.getCenter(new Vector3());
      box.expandByPoint(new Vector3(c.x - half, box.min.y, c.z - half));
      box.expandByPoint(new Vector3(c.x + half, box.min.y + this.overlay.limit, c.z + half));
      box.max.x += this.overlay.limit * 0.18; // Room for the ruler labels.
    }
    this.target = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    this.frameRadius = Math.max(0.2, size.length() / 2);

    const floorY = this.bounds.min.y;
    const floorSize = Math.max(size.x, size.z, 0.5) * 3;
    this.floor.scale.set(floorSize, floorSize, 1);
    this.floor.position.set(this.target.x, floorY - 0.0005, this.target.z);
    this.glow.scale.set(floorSize * 0.8, floorSize * 0.8, 1);
    this.glow.position.set(this.target.x, floorY - 0.001, this.target.z);

    const r = this.frameRadius * 1.6;
    this.key.position.set(this.target.x - r * 1.2, this.target.y + r * 2.2, this.target.z + r * 1.4);
    this.key.target.position.copy(this.target);
    const cam = this.key.shadow.camera;
    cam.left = -r * 1.6;
    cam.right = r * 1.6;
    cam.top = r * 1.6;
    cam.bottom = -r * 1.6;
    cam.near = 0.01;
    cam.far = r * 8;
    cam.updateProjectionMatrix();

    if (this.controls) {
      this.controls.target.copy(this.target);
      this.controls.minDistance = this.frameRadius * 0.6;
      this.controls.maxDistance = this.frameRadius * 8;
      if (resetCamera) {
        const d = this.fitDistance();
        this.camera.position.set(
          this.target.x + d * Math.cos(0.25) * Math.sin(this.baseAzimuth),
          this.target.y + d * Math.sin(0.25),
          this.target.z + d * Math.cos(0.25) * Math.cos(this.baseAzimuth),
        );
        this.camera.near = Math.max(0.01, d / 100);
        this.camera.far = d * 60;
        this.camera.updateProjectionMatrix();
        this.controls.update();
      }
    } else {
      this.camera.near = Math.max(0.01, this.fitDistance() / 100);
      this.camera.far = this.fitDistance() * 60;
      this.camera.updateProjectionMatrix();
    }
  }

  private buildOverlay(overlay: ScaleOverlay): Group {
    const group = new Group();
    const centre = this.bounds.getCenter(new Vector3());
    const floorY = this.bounds.min.y;
    const [ex, ey, ez] = overlay.extents;
    // Line weight follows what is framed: the limit box when it is drawn, the model otherwise.
    const bar = (overlay.exceeds ? Math.max(overlay.limit, ey) * 0.006 : Math.max(ex, ey, ez) * 0.0035);
    const verdictColour = new Color(overlay.exceeds ? BRAND_RED : BRAND_GREEN);

    const frameMaterial = new MeshBasicMaterial({ color: verdictColour });
    group.add(
      boxFrame(
        new Vector3(centre.x - ex / 2, floorY, centre.z - ez / 2),
        new Vector3(centre.x + ex / 2, floorY + ey, centre.z + ez / 2),
        bar,
        frameMaterial,
      ),
    );
    const volume = new Mesh(
      new BoxGeometry(ex, ey, ez),
      new MeshBasicMaterial({ color: verdictColour, transparent: true, opacity: overlay.exceeds ? 0.1 : 0.05, depthWrite: false, side: DoubleSide }),
    );
    volume.position.set(centre.x, floorY + ey / 2, centre.z);
    group.add(volume);

    // Within the limit the model stays the hero: only its green outline is drawn.
    if (!overlay.exceeds) return group;

    const l = overlay.limit;
    const limitMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    group.add(
      boxFrame(
        new Vector3(centre.x - l / 2, floorY, centre.z - l / 2),
        new Vector3(centre.x + l / 2, floorY + l, centre.z + l / 2),
        bar * 0.7,
        limitMaterial,
      ),
    );

    // Ruler: vertical bar with a tick per step, on the right-front corner of the span.
    const rulerX = centre.x + Math.max(ex, l) / 2 + l * 0.08;
    const rulerZ = centre.z + Math.max(ez, l) / 2;
    const top = overlay.ticks[overlay.ticks.length - 1];
    const rulerMaterial = new MeshBasicMaterial({ color: 0xedf1f6 });
    const spine = new Mesh(new CylinderGeometry(bar * 0.6, bar * 0.6, top, 8), rulerMaterial);
    spine.position.set(rulerX, floorY + top / 2, rulerZ);
    group.add(spine);
    for (const tick of overlay.ticks) {
      const mark = new Mesh(new CylinderGeometry(bar * 0.5, bar * 0.5, l * 0.06, 6), rulerMaterial);
      mark.rotation.z = Math.PI / 2;
      mark.position.set(rulerX - l * 0.03, floorY + tick, rulerZ);
      group.add(mark);
    }
    return group;
  }

  private emitAnchors(): void {
    if (!this.onAnchors || !this.overlay) {
      this.onAnchors?.([]);
      return;
    }
    const centre = this.bounds.getCenter(new Vector3());
    const floorY = this.bounds.min.y;
    const [ex, ey, ez] = this.overlay.extents;
    const l = this.overlay.limit;
    const rulerX = centre.x + Math.max(ex, l) / 2 + l * 0.08;
    const rulerZ = centre.z + Math.max(ez, l) / 2;
    const points: { id: string; v: Vector3 }[] = [{ id: 'model', v: new Vector3(centre.x, floorY + ey, centre.z) }];
    if (this.overlay.exceeds) {
      points.push(
        { id: 'limit', v: new Vector3(centre.x - l / 2, floorY + l, centre.z + l / 2) },
        ...this.overlay.ticks.map((tick) => ({ id: `tick:${tick}`, v: new Vector3(rulerX, floorY + tick, rulerZ) })),
      );
    }
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.onAnchors(
      points.map(({ id, v }) => {
        const p = v.clone().project(this.camera);
        return {
          id,
          x: ((p.x + 1) / 2) * width,
          y: ((1 - p.y) / 2) * height,
          visible: p.z < 1,
        };
      }),
    );
  }
}
