import * as THREE from 'three';

/** Lueur ronde et douce. */
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Un bateau de papier plié, comme ceux du gardien : une coque en deux pans qui se rejoignent
 * sous la ligne de flottaison, et la voile triangulaire au milieu. Long selon z (proue vers +z).
 */
function boatGeometry(): THREE.BufferGeometry {
  const L = 1.25; // demi-longueur au bord
  const K = 0.62; // demi-longueur de la quille
  const H = 0.62; // hauteur du bord
  const W = 0.42; // demi-largeur au milieu du bord
  const S = 1.35; // hauteur de la voile au-dessus du bord
  const bowT = [0, H, L];
  const sternT = [0, H, -L];
  const keelF = [0, 0, K];
  const keelB = [0, 0, -K];
  const midL = [-W, H, 0];
  const midR = [W, H, 0];
  const sailF = [0, H, L * 0.55];
  const sailB = [0, H, -L * 0.55];
  const top = [0, H + S, 0];
  const tris = [
    // pan gauche
    bowT, keelF, midL, keelF, keelB, midL, keelB, sternT, midL,
    // pan droit
    bowT, midR, keelF, keelF, midR, keelB, keelB, midR, sternT,
    // la voile (double face par le matériau)
    sailF, top, sailB,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

/** Où attend la barque : au bord de l'eau, devant la plage du départ. */
export const BOAT_AT = new THREE.Vector3(-5, 0, 114.5);
/** Où une nouvelle lumière apparaît : loin au large, vers le sud-ouest, loin de celle de la Bulle. */
export const FAR_LIGHT = new THREE.Vector3(-170, 4, 600);
/** Jusqu'où la barque s'en va. */
const SAIL_TO = new THREE.Vector3(-24, 0, 270);

/** Trois éclats brefs, puis une pause : une question, pas la même voix que la Bulle. */
export function threeBlinks(time: number, low = 0.12): number {
  const ph = time % 3.2;
  return ph < 0.2 || (ph > 0.4 && ph < 0.6) || (ph > 0.8 && ph < 1.0) ? 1 : low;
}

/**
 * La récompense du 100 % : une barque de papier dorée attend au bord de l'eau quand tout est
 * résolu, éclats compris. On la pousse vers le large ; au loin, une lumière que personne ne
 * connaît encore se met à clignoter (quelqu'un arrivera par la mer, comme nous).
 */
export class PaperBoat {
  readonly group = new THREE.Group();
  /** la coque et sa voile (et la lanterne) : ce qui part au large */
  readonly boat = new THREE.Group();
  /** zone à viser pour la pousser */
  readonly pick: THREE.Mesh;
  private paper: THREE.MeshStandardMaterial;
  private lantern: THREE.Sprite;
  private beam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private far: THREE.Sprite;
  private hover = false;
  /** 0 : au bord ; 1 : au large */
  private away = 0;
  private farOn = 0;

  constructor() {
    this.group.name = 'barque de papier';
    this.paper = new THREE.MeshStandardMaterial({
      color: '#f5ecd4', roughness: 0.85, flatShading: true, side: THREE.DoubleSide, emissive: '#ffcf70', emissiveIntensity: 0.25,
    });
    const hull = new THREE.Mesh(boatGeometry(), this.paper);
    hull.castShadow = true;
    hull.scale.setScalar(1.3);
    this.boat.add(hull);
    const tex = glowTexture();
    this.lantern = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: '#ffd98a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.lantern.position.set(0, 2.6, 0);
    this.lantern.scale.setScalar(1.6);
    this.lantern.renderOrder = 5;
    this.boat.add(this.lantern);
    // une colonne de lumière, visible de loin : quelque chose attend sur la plage
    const beamGeo = new THREE.CylinderGeometry(0.25, 0.9, 30, 12, 1, true);
    beamGeo.translate(0, 15, 0);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: '#ffcf70', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
    });
    this.beam = new THREE.Mesh(beamGeo, this.beamMat);
    this.beam.position.y = 0.6;
    this.boat.add(this.beam);
    this.pick = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 3.6), new THREE.MeshBasicMaterial({ visible: false }));
    this.pick.position.y = 1.3;
    this.boat.add(this.pick);
    this.boat.position.copy(BOAT_AT);
    this.group.add(this.boat);
    this.far = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: '#fff6dc', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.far.position.copy(FAR_LIGHT);
    this.far.scale.setScalar(80);
    this.far.renderOrder = 5;
    this.far.visible = false;
    this.group.add(this.far);
    this.boat.visible = false;
  }

  /** La barque attend au bord (tout est résolu, elle n'est pas encore partie). */
  get waiting(): boolean {
    return this.boat.visible && this.away === 0;
  }

  /** `waiting` : la barque est là ; `gone` : elle est partie, la lumière lointaine reste. */
  set(waiting: boolean, gone: boolean): void {
    this.away = gone ? 1 : 0;
    this.boat.visible = waiting && !gone;
    this.boat.position.copy(BOAT_AT);
    this.beam.visible = true;
    this.farOn = gone ? 1 : 0;
    this.far.visible = gone;
  }

  setHover(on: boolean): void {
    this.hover = on;
  }

  /** Le départ : `k` de 0 (au bord) à 1 (au large) ; `far` : la lumière lointaine (0 → 1). */
  sail(k: number, far: number): void {
    this.away = k;
    this.boat.visible = k < 1;
    this.boat.position.lerpVectors(BOAT_AT, SAIL_TO, k);
    this.beam.visible = k === 0;
    this.farOn = far;
    this.far.visible = far > 0;
  }

  /** Position de la barque (pour la caméra du départ). */
  get position(): THREE.Vector3 {
    return this.boat.position;
  }

  /** `cam` : la lanterne garde une taille lisible, même au loin. */
  update(time: number, cam: THREE.Vector3): void {
    if (this.boat.visible) {
      // posée sur la houle (la même que celle de la mer) : elle tangue et roule doucement
      const { x, z } = this.boat.position;
      const wave = (px: number, pz: number) => Math.sin(px * 0.11 + time * 0.9) * 0.18 + Math.cos(pz * 0.13 + time * 0.7) * 0.18;
      this.boat.position.y = wave(x, z) + 0.12;
      this.boat.rotation.x = (wave(x, z - 1.2) - wave(x, z + 1.2)) * 0.25;
      this.boat.rotation.z = Math.sin(time * 1.3 + 1) * 0.05;
      const glow = this.hover ? 0.7 : 0.25 + 0.1 * Math.sin(time * 2);
      this.paper.emissiveIntensity = glow;
      this.beamMat.opacity = 0.06 + 0.07 * (0.5 + 0.5 * Math.sin(time * 1.6));
      // au large, la lanterne de la barque répond à la lumière lointaine
      const m = this.lantern.material as THREE.SpriteMaterial;
      m.opacity = this.away > 0.45 ? threeBlinks(time + 1.6, 0.45) : 1;
      this.lantern.scale.setScalar(Math.max(1.6, cam.distanceTo(this.boat.position) * 0.05));
    }
    if (this.far.visible) (this.far.material as THREE.SpriteMaterial).opacity = this.farOn * threeBlinks(time, 0.3);
  }
}
