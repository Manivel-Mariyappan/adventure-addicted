import * as THREE from 'three';

export type SceneTheme = 'ladakh' | 'kashmir' | 'himachal' | 'uttarakhand' | 'rajasthan';
export type TimeOfDay = 'dawn' | 'day' | 'dusk';

// one stop of the route fly-along, e.g. a day of the itinerary
export interface RouteMarker {
  altitudeM: number | null;
}

export interface EngineOptions {
  theme: SceneTheme;
  time: TimeOfDay;
  markers: RouteMarker[] | null;
  // seconds for one pass along the road
  duration: number;
  reducedMotion: boolean;
  onProgress?: (progress: number) => void;
  onContextLost?: () => void;
}

interface Palette {
  low: number;
  mid: number;
  rock: number;
  snow: number | null;
  road: number;
  skyTop: number;
  skyHorizon: number;
  sun: number;
  water: number | null;
  trees: number | null;
  height: number;
  dunes: boolean;
}

const PALETTES: Record<SceneTheme, Palette> = {
  ladakh: {
    low: 0x9a7b5a,
    mid: 0x8a6a4c,
    rock: 0x6f6259,
    snow: 0xf4f7fb,
    road: 0x2b2b30,
    skyTop: 0x1d4ed8,
    skyHorizon: 0xbfdcff,
    sun: 0xfff3d6,
    water: 0x18b6c9,
    trees: null,
    height: 1,
    dunes: false,
  },
  kashmir: {
    low: 0x5f7d3a,
    mid: 0x4d6b35,
    rock: 0x7b8088,
    snow: 0xf8fafc,
    road: 0x2f3036,
    skyTop: 0x3b82f6,
    skyHorizon: 0xe0f0ff,
    sun: 0xfff6e5,
    water: 0x2f8fc4,
    trees: 0x3b6b34,
    height: 0.95,
    dunes: false,
  },
  himachal: {
    low: 0x4e7a2f,
    mid: 0x3f6728,
    rock: 0x6c7280,
    snow: 0xf1f5f9,
    road: 0x2c2d33,
    skyTop: 0x0ea5e9,
    skyHorizon: 0xd8f1ff,
    sun: 0xfffbea,
    water: null,
    trees: 0x386a2e,
    height: 0.9,
    dunes: false,
  },
  uttarakhand: {
    low: 0x58743a,
    mid: 0x46602f,
    rock: 0x7a6f86,
    snow: 0xfff1f2,
    road: 0x2c2b33,
    skyTop: 0x7c3aed,
    skyHorizon: 0xfed7aa,
    sun: 0xfff1e0,
    water: 0x14b8a6,
    trees: 0x3a6230,
    height: 0.85,
    dunes: false,
  },
  rajasthan: {
    low: 0xe0a04f,
    mid: 0xd08a3c,
    rock: 0xb86f30,
    snow: null,
    road: 0x3a2f2a,
    skyTop: 0xf97316,
    skyHorizon: 0xfde68a,
    sun: 0xfff7e6,
    water: null,
    trees: null,
    height: 0.25,
    dunes: true,
  },
};

const LENGTH = 520; // road length along -z
const START_Z = 160;
const WIDTH = 360;

// ---- noise: seeded 2D value noise with smooth interpolation, summed in octaves ----
function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  let s = seed;
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const p = Array.from({ length: 256 }, (_, i) => i).sort(() => rand() - 0.5);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h: number) => (h / 255) * 2 - 1;
  const fade = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const a = grad(perm[perm[xi] + yi]);
    const b = grad(perm[perm[xi + 1] + yi]);
    const c = grad(perm[perm[xi] + yi + 1]);
    const d = grad(perm[perm[xi + 1] + yi + 1]);
    const u = fade(xf);
    const v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x: number, y: number, octaves = 5) => {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  };
}

// the road snakes left and right as it heads into the mountains
const LAKE_Z = START_Z - LENGTH * 0.62;

const roadX = (z: number) => Math.sin(z * 0.012) * 26 + Math.sin(z * 0.031 + 1.3) * 9;

export class MountainEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.5, 900);
  private readonly timer = new THREE.Timer();
  private readonly palette: Palette;
  private readonly flags: THREE.Mesh[] = [];
  private readonly clouds: THREE.Object3D[] = [];
  private readonly rider = new THREE.Group();
  private readonly roadY: (z: number) => number;
  private readonly heightAt: (x: number, z: number) => number;
  private progress = 0;
  private playing: boolean;
  private running = false;
  private frame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opts: EngineOptions,
  ) {
    const mobile = matchMedia('(max-width: 768px)').matches;
    this.palette = PALETTES[opts.theme];
    this.playing = !opts.reducedMotion;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = opts.time === 'day' ? 1 : 1.1;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      opts.onContextLost?.();
    });

    this.roadY = this.makeRoadProfile(opts.markers);
    const noise = makeNoise(opts.theme.length * 97 + 11);
    this.heightAt = (x, z) => this.terrainHeight(noise, x, z);

    this.buildSky();
    this.buildLights();
    this.buildTerrain(mobile ? 90 : 150, mobile ? 130 : 230);
    this.buildRoad();
    if (this.palette.water !== null) this.buildWater();
    if (this.palette.trees !== null) this.buildTrees(mobile ? 260 : 520);
    if (!this.palette.dunes) this.buildFlags();
    this.buildClouds();
    this.buildRider();
    if (opts.markers?.length) this.buildMarkers(opts.markers);

    this.setProgress(opts.reducedMotion ? 0.32 : 0);
  }

  // ---------------------------------------------------------------- shape of the land

  // Road height along z. With markers, it follows the itinerary's altitudes so passes climb.
  private makeRoadProfile(markers: RouteMarker[] | null): (z: number) => number {
    const alts = (markers ?? []).map((m) => m.altitudeM).filter((a): a is number => !!a);
    if (alts.length < 2) return (z) => Math.sin(z * 0.01) * 2;
    const min = Math.min(...alts);
    const max = Math.max(...alts);
    const points = (markers ?? []).map(
      (m) => ((m.altitudeM ?? min) - min) / Math.max(1, max - min),
    );
    return (z) => {
      const t = Math.min(1, Math.max(0, (START_Z - z) / LENGTH)) * (points.length - 1);
      const i = Math.floor(t);
      const f = t - i;
      const a = points[i];
      const b = points[Math.min(points.length - 1, i + 1)];
      const smooth = f * f * (3 - 2 * f);
      return (a + (b - a) * smooth) * 28;
    };
  }

  private terrainHeight(
    noise: (x: number, y: number, o?: number) => number,
    x: number,
    z: number,
  ): number {
    const p = this.palette;
    const dist = Math.abs(x - roadX(z));
    const base = this.roadY(z);
    if (p.dunes) {
      const dunes =
        Math.sin(x * 0.05 + noise(x * 0.01, z * 0.01) * 4) * 4 + noise(x * 0.02, z * 0.02, 3) * 6;
      const flat = Math.min(1, Math.max(0, (dist - 7) / 30));
      return base + dunes * flat;
    }
    // ridged noise gives sharp crests; mountains rise with distance from the road
    const ridge = 1 - Math.abs(noise(x * 0.008, z * 0.008, 5));
    const hills = noise(x * 0.02 + 40, z * 0.02, 4);
    const rise = Math.min(1, Math.max(0, (dist - 9) / 70));
    const mountains = (ridge * ridge * 95 + hills * 14) * rise * rise * p.height;
    const valley = hills * 3 * Math.min(1, dist / 20);
    const height = base + valley + mountains + Math.max(0, dist - 120) * 0.35 * p.height;
    if (p.water === null) return height;
    // carve a basin for the lake (an ellipse 70 x 154 beside the road)
    const lx = (x - roadX(LAKE_Z) - 62) / 70;
    const lz = (z - LAKE_Z) / 154;
    const d = Math.sqrt(lx * lx + lz * lz);
    if (d > 1.2) return height;
    const bed = this.roadY(LAKE_Z) - 1.5;
    const k = Math.min(1, Math.max(0, (d - 0.85) / 0.35));
    return bed + (height - bed) * k * k * (3 - 2 * k);
  }

  // ---------------------------------------------------------------- scene parts

  private buildSky(): void {
    const p = this.palette;
    const sunDir = this.sunDirection();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(800, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(p.skyTop) },
          horizon: {
            value: new THREE.Color(this.opts.time === 'day' ? p.skyHorizon : this.warmHorizon()),
          },
          sun: { value: new THREE.Color(p.sun) },
          sunDir: { value: sunDir },
        },
        vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sun; uniform vec3 sunDir; varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y * 2.2, 0.0, 1.0);
            vec3 col = mix(horizon, top, pow(h, 0.7));
            float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
            col += sun * (pow(d, 600.0) * 2.0 + pow(d, 12.0) * 0.35);
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    this.scene.add(sky);
    const fogColor = new THREE.Color(this.opts.time === 'day' ? p.skyHorizon : this.warmHorizon());
    this.scene.fog = new THREE.Fog(fogColor, 120, 520);
  }

  private warmHorizon(): number {
    return this.opts.time === 'dawn' ? 0xfbcfe8 : 0xfdba74;
  }

  private sunDirection(): THREE.Vector3 {
    const elevation = this.opts.time === 'day' ? 0.55 : 0.08;
    return new THREE.Vector3(-0.35, elevation, -1).normalize();
  }

  private buildLights(): void {
    const warm = this.opts.time !== 'day';
    const sun = new THREE.DirectionalLight(warm ? 0xffc690 : 0xfff4e0, warm ? 2.6 : 2.2);
    sun.position.copy(this.sunDirection()).multiplyScalar(300);
    this.scene.add(sun, new THREE.HemisphereLight(0xdbeafe, 0x4a3b30, warm ? 1.1 : 0.9));
  }

  private buildTerrain(segX: number, segZ: number): void {
    const p = this.palette;
    const geo = new THREE.PlaneGeometry(WIDTH, LENGTH + 360, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, START_Z - (LENGTH + 360) / 2 + 120);
    const pos = geo.attributes['position'] as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color(p.low);
    const mid = new THREE.Color(p.mid);
    const rock = new THREE.Color(p.rock);
    const snow = p.snow === null ? null : new THREE.Color(p.snow);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.heightAt(x, z);
      pos.setY(i, y);
      const rel = y - this.roadY(z);
      if (snow && rel > 52 + Math.sin(x * 0.3) * 6) c.copy(snow);
      else if (rel > 30) c.copy(rock).lerp(snow ?? rock, Math.max(0, (rel - 40) / 30));
      else if (rel > 8) c.copy(mid).lerp(rock, (rel - 8) / 22);
      else c.copy(low).lerp(mid, Math.max(0, rel / 8));
      // slight variation so faces don't look flat-filled
      c.offsetHSL(0, 0, Math.sin(x * 1.7 + z * 2.3) * 0.5 * 0.03);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    );
    this.scene.add(mesh);
  }

  private buildRoad(): void {
    const points: THREE.Vector3[] = [];
    for (let z = START_Z + 80; z >= START_Z - LENGTH - 120; z -= 4) {
      points.push(new THREE.Vector3(roadX(z), this.roadY(z) + 0.25, z));
    }
    const ribbon = (width: number, color: number, lift: number, dashed = false) => {
      const verts: number[] = [];
      const idx: number[] = [];
      points.forEach((pt, i) => {
        const next = points[Math.min(i + 1, points.length - 1)];
        const dir = new THREE.Vector3().subVectors(next, pt).setY(0).normalize();
        if (!dir.lengthSq()) dir.set(0, 0, -1);
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(width / 2);
        verts.push(
          pt.x - side.x,
          pt.y + lift,
          pt.z - side.z,
          pt.x + side.x,
          pt.y + lift,
          pt.z + side.z,
        );
        if (i < points.length - 1 && (!dashed || i % 3 === 0)) {
          const a = i * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }),
      );
    };
    this.scene.add(ribbon(7, this.palette.road, 0), ribbon(0.35, 0xf59e0b, 0.04, true));
  }

  private buildWater(): void {
    // a lake beside the road, two thirds of the way along
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(70, 48),
      new THREE.MeshStandardMaterial({
        color: this.palette.water!,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.92,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(roadX(LAKE_Z) + 62, this.roadY(LAKE_Z) + 1.2, LAKE_Z);
    water.scale.set(1, 2.2, 1);
    this.scene.add(water);
  }

  private buildTrees(count: number): void {
    const geo = new THREE.ConeGeometry(1.6, 6, 6);
    geo.translate(0, 3, 0);
    const mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: this.palette.trees!,
        flatShading: true,
        roughness: 1,
      }),
      count,
    );
    const m = new THREE.Matrix4();
    let placed = 0;
    for (let i = 0; placed < count && i < count * 6; i++) {
      const z = START_Z + 60 - ((i * 37.17) % (LENGTH + 120));
      const side = i % 2 ? 1 : -1;
      const x = roadX(z) + side * (12 + ((i * 13.7) % 70));
      const y = this.heightAt(x, z);
      const rel = y - this.roadY(z);
      if (rel > 26) continue; // no trees on rock and snow
      const s = 0.8 + ((i * 7) % 10) / 12;
      m.compose(
        new THREE.Vector3(x, y - 0.3, z),
        new THREE.Quaternion(),
        new THREE.Vector3(s, s * (0.9 + (i % 5) / 10), s),
      );
      mesh.setMatrixAt(placed++, m);
    }
    mesh.count = placed;
    this.scene.add(mesh);
  }

  private buildFlags(): void {
    const colors = [0x2563eb, 0xf8fafc, 0xdc2626, 0x16a34a, 0xfacc15];
    const flagGeo = new THREE.PlaneGeometry(0.9, 1.1);
    flagGeo.translate(0, -0.55, 0);
    const pole = new THREE.CylinderGeometry(0.08, 0.08, 6, 5);
    pole.translate(0, 3, 0);
    for (let z = START_Z - 40; z > START_Z - LENGTH; z -= 85) {
      const x = roadX(z);
      const y = this.roadY(z);
      const left = new THREE.Vector3(x - 6, y + 6, z);
      const right = new THREE.Vector3(x + 6, y + 6, z - 4);
      for (const end of [left, right]) {
        const p = new THREE.Mesh(pole, new THREE.MeshStandardMaterial({ color: 0x3f3f46 }));
        p.position.set(end.x, end.y - 6, end.z);
        this.scene.add(p);
      }
      for (let i = 1; i < 12; i++) {
        const t = i / 12;
        const flag = new THREE.Mesh(
          flagGeo,
          new THREE.MeshStandardMaterial({
            color: colors[i % 5],
            side: THREE.DoubleSide,
            roughness: 0.9,
          }),
        );
        flag.position.lerpVectors(left, right, t);
        flag.position.y -= Math.sin(t * Math.PI) * 1.2;
        flag.userData['phase'] = i * 0.7 + z;
        this.flags.push(flag);
        this.scene.add(flag);
      }
    }
  }

  private buildClouds(): void {
    // lit from the front so they stay white when the sun is behind them
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
      roughness: 1,
    });
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + j * 2, 0), mat);
        puff.position.set(j * 7 - 10, Math.sin(j) * 2, (j % 2) * 4);
        puff.scale.y = 0.45;
        cloud.add(puff);
      }
      cloud.position.set(((i * 71) % 300) - 150, 95 + (i % 4) * 12, START_Z - ((i * 53) % LENGTH));
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  private buildRider(): void {
    const body = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.5,
      metalness: 0.2,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
    const wheel = new THREE.TorusGeometry(0.42, 0.13, 8, 16);
    const front = new THREE.Mesh(wheel, dark);
    const back = new THREE.Mesh(wheel, dark);
    front.rotation.y = back.rotation.y = Math.PI / 2;
    front.position.set(0, 0.45, -0.85);
    back.position.set(0, 0.45, 0.85);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 1.3), body);
    tank.position.set(0, 0.95, 0);
    const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), dark);
    rider.position.set(0, 1.6, 0.15);
    rider.rotation.x = -0.35;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), body);
    helmet.position.set(0, 2.15, -0.12);
    this.rider.add(front, back, tank, rider, helmet);
    if (this.opts.time !== 'day') {
      const lamp = new THREE.PointLight(0xfff1c1, 18, 22, 1.6);
      lamp.position.set(0, 1.1, -1.4);
      this.rider.add(lamp);
    }
    this.scene.add(this.rider);
  }

  private buildMarkers(markers: RouteMarker[]): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xea580c,
      emissiveIntensity: 0.35,
    });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
    markers.forEach((_, i) => {
      const z = START_Z - (LENGTH * i) / Math.max(1, markers.length - 1);
      const x = roadX(z) + 5;
      const y = this.roadY(z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), poleMat);
      pole.position.set(x, y + 2.5, z);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), mat);
      head.position.set(x, y + 5.4, z);
      this.scene.add(pole, head);
    });
  }

  // ---------------------------------------------------------------- playback

  setProgress(progress: number): void {
    this.progress = ((progress % 1) + 1) % 1;
    this.place();
    this.render();
    this.opts.onProgress?.(this.progress);
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    if (playing) this.start();
  }

  private place(): void {
    // camera follows the road a little behind and above the rider
    const z = START_Z - this.progress * LENGTH;
    const riderZ = z - 16;
    const ahead = riderZ - 6;
    this.rider.position.set(roadX(riderZ), this.roadY(riderZ) + 0.25, riderZ);
    this.rider.lookAt(roadX(ahead), this.roadY(ahead) + 0.25, ahead);
    this.rider.rotateY(Math.PI);
    const camY = this.roadY(z) + 7 + Math.sin(this.progress * Math.PI * 6) * 1.2;
    this.camera.position.set(roadX(z) + 2.5, camY, z);
    const look = z - 40;
    this.camera.lookAt(roadX(look), this.roadY(look) + 3, look);
  }

  resize(width: number, height: number): void {
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < 640 ? 68 : 55;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer.reset();
    const tick = (time: number) => {
      if (!this.running) return;
      this.frame = requestAnimationFrame(tick);
      this.timer.update(time);
      const dt = Math.min(this.timer.getDelta(), 0.1);
      const t = this.timer.getElapsed();
      if (this.playing) this.setProgress(this.progress + dt / this.opts.duration);
      for (const f of this.flags) f.rotation.y = Math.sin(t * 5 + f.userData['phase']) * 0.5;
      for (const c of this.clouds) c.position.x += dt * 2.2;
      this.render();
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.stop();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((m) => m.dispose());
    });
    this.renderer.dispose();
  }
}
