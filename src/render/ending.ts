import * as THREE from 'three';

/** Lueur ronde et douce (sprites et points). */
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Où la mer répond : au large, au sud, dans l'axe du dernier plan de la séquence de fin. */
export const ANSWER_AT = new THREE.Vector3(100, 5, 380);
const ISLAND = new THREE.Vector2(0, -15);
/** les lanternes s'arrêtent à cette distance du centre de l'île (juste avant le rivage) */
const HARBOUR = 185;
const LANTERNS = 48;

/**
 * La fin : quand le phare se rallume, une petite lumière répond au large, en clignotant
 * (deux éclats, une pause). Avec les sept éclats, des dizaines de lanternes apparaissent
 * autour d'elle et rentrent lentement vers l'île.
 */
export class SeaAnswer {
  readonly group = new THREE.Group();
  private light: THREE.Sprite;
  private lanterns: THREE.Points;
  private pos: Float32Array;
  private speed: Float32Array;
  private t = -1;
  private full = false;

  constructor() {
    this.group.name = 'réponse de la mer';
    const tex = glowTexture();
    this.light = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: '#fff2c4', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.light.scale.setScalar(30);
    this.light.position.copy(ANSWER_AT);
    // dessinée après la mer (transparente), sinon l'eau la recouvre
    this.light.renderOrder = 5;
    this.group.add(this.light);
    this.pos = new Float32Array(LANTERNS * 3);
    this.speed = new Float32Array(LANTERNS);
    const col = new Float32Array(LANTERNS * 3);
    const warm = [new THREE.Color('#ffcf73'), new THREE.Color('#ffa35c'), new THREE.Color('#fff0b8')];
    let seed = 5;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < LANTERNS; i++) {
      // en éventail autour de la lumière qui a répondu
      const a = (rnd() - 0.5) * Math.PI * 0.9;
      const r = 20 + rnd() * 110;
      this.pos[i * 3] = ANSWER_AT.x + Math.sin(a) * r;
      this.pos[i * 3 + 1] = 1.2;
      this.pos[i * 3 + 2] = ANSWER_AT.z + Math.cos(a) * r * 0.6;
      this.speed[i] = 5 + rnd() * 4;
      warm[i % 3]!.toArray(col, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.lanterns = new THREE.Points(g, new THREE.PointsMaterial({
      map: tex, size: 11, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.lanterns.frustumCulled = false;
    this.lanterns.renderOrder = 5;
    this.lanterns.visible = false;
    this.group.add(this.lanterns);
    this.group.visible = false;
  }

  /** La mer répond (avec les lanternes si les sept éclats sont réunis). `instant` : chargement. */
  start(full: boolean, instant = false): void {
    this.group.visible = true;
    if (this.t < 0) this.t = instant ? 60 : 0;
    if (full) this.bringLanterns(instant);
  }

  /** Les sept éclats sont réunis après la fin : les lanternes partent à leur tour. */
  bringLanterns(instant = false): void {
    if (this.full) return;
    this.full = true;
    this.lanterns.visible = true;
    if (instant) for (let i = 0; i < LANTERNS; i++) this.moveLantern(i, 1e6);
  }

  get answered(): boolean {
    return this.t >= 0;
  }

  get homecoming(): boolean {
    return this.full;
  }

  private moveLantern(i: number, dist: number): void {
    const x = this.pos[i * 3]!;
    const z = this.pos[i * 3 + 2]!;
    const dx = ISLAND.x - x;
    const dz = ISLAND.y - z;
    const d = Math.hypot(dx, dz);
    const left = d - HARBOUR - (i % 7) * 3; // elles se rangent en arc, pas toutes au même endroit
    if (left <= 0) return;
    const step = Math.min(left, dist);
    this.pos[i * 3] = x + (dx / d) * step;
    this.pos[i * 3 + 2] = z + (dz / d) * step;
  }

  update(dt: number, time: number): void {
    if (this.t < 0) return;
    this.t += dt;
    // la lumière apparaît, puis clignote : deux éclats, une pause
    const fadeIn = Math.min(1, this.t / 2);
    const ph = time % 2.4;
    const blink = ph < 0.25 || (ph > 0.5 && ph < 0.75) ? 1 : 0.15;
    (this.light.material as THREE.SpriteMaterial).opacity = fadeIn * blink;
    if (this.full) {
      const m = this.lanterns.material as THREE.PointsMaterial;
      m.opacity = Math.min(1, m.opacity + dt * 0.3);
      for (let i = 0; i < LANTERNS; i++) {
        this.moveLantern(i, this.speed[i]! * dt);
        this.pos[i * 3 + 1] = 1.2 + Math.sin(time * 1.3 + i) * 0.25; // la houle
      }
      this.lanterns.geometry.attributes.position!.needsUpdate = true;
    }
  }
}
