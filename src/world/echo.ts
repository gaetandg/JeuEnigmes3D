import * as THREE from 'three';
import { ECHO, ECHO_EXIT, ECHO_MODULES, ECHO_MOUTH, echoStones } from './layout.ts';
import type { EchoLang } from './layout.ts';
import { heightAt } from './terrain.ts';
import { stoneMaterial } from './props.ts';
import { mulberry32 } from './noise.ts';
import type { Colliders } from '../game/colliders.ts';

/** La couleur de chaque langage (emblèmes, cristaux qui poussent aux parois). */
export const ECHO_COLORS: Record<EchoLang, string> = {
  lumiere: '#ffd36b',
  pliage: '#f5ecd6',
  ombres: '#9a8cff',
  inclinaison: '#ff7a5c',
  racines: '#7fe0b0',
  vases: '#6cc8ff',
};

const CRYSTALS = 360;

export interface EchoWorld {
  /** le rocher creux de la côte ouest (toujours là) */
  outside: THREE.Group;
  /** la salle, sous la mer (dessinée seulement de près) */
  interior: THREE.Group;
  /** un langage maîtrisé : son emblème s'allume */
  setUnlocked(kind: EchoLang, on: boolean): void;
  /** la pierre de taille choisie (0 petite, 1 moyenne, 2 grande) s'éclaire */
  setTier(kind: EchoLang, tier: number): void;
  /** les cristaux des parois : un par énigme résolue, de la couleur de son langage */
  setCrystals(counts: Record<EchoLang, number>): void;
  /** une énigme vient d'être résolue ici : l'emblème rayonne un instant */
  pulse(kind: EchoLang, time: number): void;
  update(time: number): void;
}

/** Un point rond et doux (les lueurs de l'entrée). */
function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/** Une forme simple par langage, qui flotte au-dessus de son alcôve. */
function emblemGeometry(kind: EchoLang): THREE.BufferGeometry {
  switch (kind) {
    case 'lumiere':
      return new THREE.OctahedronGeometry(0.32, 0);
    case 'pliage': {
      // un billet plié en tente
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.35, 0, -0.25, 0.35, 0, -0.25, 0, 0.3, 0, 0.35, 0, -0.25, 0.35, 0, 0.25, 0, 0.3, 0, 0.35, 0, 0.25, -0.35, 0, 0.25, 0, 0.3, 0, -0.35, 0, 0.25, -0.35, 0, -0.25, 0, 0.3, 0], 3));
      g.computeVertexNormals();
      return g;
    }
    case 'ombres':
      return new THREE.BoxGeometry(0.4, 0.4, 0.4);
    case 'inclinaison':
      return new THREE.SphereGeometry(0.26, 16, 10);
    case 'racines':
      return new THREE.ConeGeometry(0.2, 0.6, 5);
    case 'vases':
      return new THREE.CylinderGeometry(0.18, 0.18, 0.55, 14);
  }
}

export function buildEchoCave(colliders: Colliders): EchoWorld {
  // ── dehors : un rocher creux, son ouverture sombre tournée vers la mer ──
  const outside = new THREE.Group();
  outside.name = 'grotte des échos (entrée)';
  const y0 = heightAt(ECHO_MOUTH.x, ECHO_MOUTH.z);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#8a8378', roughness: 1, flatShading: true });
  const rocks: [number, number, number, number, number][] = [
    // dx, dy, dz, rayon, aplatissement
    [4.2, 1.6, 0, 3.6, 0.9],
    [1.4, 0.6, -2.6, 2.2, 1],
    [1.4, 0.6, 2.6, 2.3, 1],
    [2.2, 3.4, 0, 2.6, 0.7],
    [5.5, 0.4, -3.8, 2, 0.8],
  ];
  for (const [dx, dy, dz, r, flat] of rocks) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
    m.scale.y = flat;
    m.rotation.set(dx, dz, dy);
    m.position.set(ECHO_MOUTH.x + dx, y0 + dy, ECHO_MOUTH.z + dz);
    m.castShadow = m.receiveShadow = true;
    outside.add(m);
    if (Math.abs(dz) > 1) colliders.addCircle(m.position.x, m.position.z, r * 0.85);
  }
  colliders.addCircle(ECHO_MOUTH.x + 4.2, ECHO_MOUTH.z, 3.2);
  // l'ouverture : un ovale d'ombre profonde
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), new THREE.MeshBasicMaterial({ color: '#07060a' }));
  mouth.scale.y = 1.35;
  mouth.rotation.y = -Math.PI / 2;
  mouth.position.set(ECHO_MOUTH.x + 1.05, y0 + 1.2, ECHO_MOUTH.z);
  outside.add(mouth);
  // des lueurs qui s'en échappent lentement : il y a quelque chose là-dedans
  const motes = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(10 * 3), 3)),
    new THREE.PointsMaterial({ color: '#d9c8ff', size: 0.22, map: dotTexture(), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  motes.frustumCulled = false;
  outside.add(motes);

  // ── la salle ──
  const interior = new THREE.Group();
  interior.name = 'grotte des échos';
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ECHO.r + 1, 48), stoneMaterial('#5f566b'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ECHO.x, ECHO.y - 0.02, ECHO.z);
  floor.receiveShadow = true;
  interior.add(floor);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(ECHO.r + 1.5, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#4a4152', roughness: 1, flatShading: true, side: THREE.BackSide }),
  );
  dome.scale.y = 0.55;
  dome.position.set(ECHO.x, ECHO.y - 0.1, ECHO.z);
  interior.add(dome);
  // le bassin des échos, au centre ; son cristal brille à mesure que la grotte se remplit
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.5, 24, 1, true), stoneMaterial('#a89fb2'));
  basin.position.set(ECHO.x, ECHO.y + 0.25, ECHO.z);
  interior.add(basin);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.15, 24), new THREE.MeshStandardMaterial({ color: '#3d3360', emissive: '#6a52c8', emissiveIntensity: 0.3, roughness: 0.2 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(ECHO.x, ECHO.y + 0.4, ECHO.z);
  interior.add(pool);
  const heartMat = new THREE.MeshStandardMaterial({ color: '#e6dcff', emissive: '#b49cff', emissiveIntensity: 0.3, flatShading: true, roughness: 0.3 });
  const heart = new THREE.Group();
  for (const [dx, dz, h, tilt] of [[0, 0, 1.6, 0], [0.45, 0.2, 1.0, 0.35], [-0.4, 0.25, 0.9, -0.3], [0.05, -0.45, 1.1, 0.25]] as const) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), heartMat);
    c.scale.set(1, h / 0.64, 1);
    c.position.set(dx, 0.4 + h / 2, dz);
    c.rotation.z = tilt;
    heart.add(c);
  }
  heart.position.set(ECHO.x, ECHO.y, ECHO.z);
  interior.add(heart);
  colliders.addCircle(ECHO.x, ECHO.z, 2.5);

  // les alcôves : un emblème au-dessus de chaque module, trois pierres de taille à côté
  const emblems = new Map<EchoLang, { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; on: boolean; pulseAt: number; baseY: number }>();
  const markers = new Map<EchoLang, { ring: THREE.Mesh; stones: { x: number; z: number; r: number }[] }>();
  const stoneMat = stoneMaterial('#b9b0c4');
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd36b', toneMapped: false });
  for (const m of ECHO_MODULES) {
    const mat = new THREE.MeshStandardMaterial({ color: '#6d6675', roughness: 0.4, flatShading: true, emissive: '#000000', side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(emblemGeometry(m.kind), mat);
    // un peu en retrait derrière le module, à hauteur des yeux et au-dessus
    const back = 1.3;
    const baseY = ECHO.y + 2.9;
    mesh.position.set(m.x + Math.cos(m.a) * back, baseY, m.z + Math.sin(m.a) * back);
    interior.add(mesh);
    emblems.set(m.kind, { mesh, mat, on: false, pulseAt: -10, baseY });
    // un tapis de pierre claire sous le module
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), stoneMaterial('#857a96'));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(m.x, ECHO.y + 0.01, m.z);
    rug.receiveShadow = true;
    interior.add(rug);
    colliders.addCircle(m.x, m.z, 0.95);
    // les trois pierres : petite, moyenne, grande
    const stones = echoStones(m);
    for (const s of stones) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r * 1.1, 0.12, 14), stoneMat);
      st.position.set(s.x, ECHO.y + 0.06, s.z);
      st.receiveShadow = true;
      interior.add(st);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 28), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    interior.add(ring);
    markers.set(m.kind, { ring, stones });
  }

  // la pierre du retour
  const exitGlow = new THREE.MeshBasicMaterial({ color: '#d9c8ff', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const exitDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 0.25, 20), stoneMaterial('#d9d0e6'));
  exitDisc.position.set(ECHO_EXIT.x, ECHO.y + 0.12, ECHO_EXIT.z);
  interior.add(exitDisc);
  const exitHalo = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 5, 20, 1, true), exitGlow);
  exitHalo.position.set(ECHO_EXIT.x, ECHO.y + 2.6, ECHO_EXIT.z);
  interior.add(exitHalo);

  // les cristaux des parois : ils poussent, un par énigme résolue
  const crystalGeo = new THREE.OctahedronGeometry(0.16, 0);
  crystalGeo.scale(1, 1.8, 1);
  const crystals = new THREE.InstancedMesh(crystalGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.3, flatShading: true }), CRYSTALS);
  crystals.count = 0;
  const rnd = mulberry32(31);
  const dummy = new THREE.Object3D();
  const slots: THREE.Matrix4[] = [];
  for (let i = 0; i < CRYSTALS; i++) {
    // le long de la paroi, à des hauteurs variées (la voûte s'abaisse vers le haut)
    const a = rnd() * Math.PI * 2;
    const h = 0.3 + rnd() * 4.6;
    const rr = (ECHO.r + 1.2) * Math.sqrt(Math.max(0.05, 1 - (h / ((ECHO.r + 1.5) * 0.55)) ** 2)) - 0.25;
    dummy.position.set(ECHO.x + Math.cos(a) * rr, ECHO.y + h, ECHO.z + Math.sin(a) * rr);
    dummy.rotation.set((rnd() - 0.5) * 1.2, rnd() * 6, (rnd() - 0.5) * 1.2);
    dummy.scale.setScalar(0.7 + rnd() * 0.9);
    dummy.updateMatrix();
    slots.push(dummy.matrix.clone());
  }
  slots.forEach((m, i) => crystals.setMatrixAt(i, m));
  crystals.frustumCulled = false;
  interior.add(crystals);
  const color = new THREE.Color();

  let total = 0;
  return {
    outside,
    interior,
    setUnlocked(kind, on) {
      const e = emblems.get(kind)!;
      e.on = on;
      e.mat.color.set(on ? ECHO_COLORS[kind] : '#6d6675');
      e.mat.emissive.set(on ? ECHO_COLORS[kind] : '#000000');
      e.mat.emissiveIntensity = on ? 0.45 : 0;
    },
    setTier(kind, tier) {
      const mk = markers.get(kind)!;
      const s = mk.stones[tier]!;
      mk.ring.visible = true;
      mk.ring.scale.setScalar(s.r + 0.1);
      mk.ring.position.set(s.x, ECHO.y + 0.14, s.z);
    },
    setCrystals(counts) {
      // un cristal par énigme résolue, les couleurs des langages mêlées
      const order: EchoLang[] = [];
      const left = { ...counts };
      for (let more = true; more && order.length < CRYSTALS; ) {
        more = false;
        for (const m of ECHO_MODULES) {
          if ((left[m.kind] ?? 0) > 0 && order.length < CRYSTALS) {
            order.push(m.kind);
            left[m.kind]--;
            more = true;
          }
        }
      }
      order.forEach((k, i) => crystals.setColorAt(i, color.set(ECHO_COLORS[k])));
      crystals.count = order.length;
      if (crystals.instanceColor) crystals.instanceColor.needsUpdate = true;
      total = order.length;
      heartMat.emissiveIntensity = 0.3 + Math.min(1.4, total / 60);
    },
    pulse(kind, time) {
      emblems.get(kind)!.pulseAt = time;
    },
    update(time) {
      for (const [kind, e] of emblems) {
        const since = time - e.pulseAt;
        const burst = since >= 0 && since < 2 ? 1 - since / 2 : 0;
        e.mesh.rotation.y = time * (e.on ? 0.6 : 0.15);
        e.mesh.position.y = e.baseY + (e.on ? Math.sin(time * 1.3 + kind.length) * 0.08 : 0);
        e.mesh.scale.setScalar(1 + burst * 0.6);
        if (e.on) e.mat.emissiveIntensity = 0.45 + burst * 2;
      }
      exitGlow.opacity = 0.18 + 0.07 * Math.sin(time * 1.4);
      heart.rotation.y = time * 0.1;
      // les lueurs de l'entrée : elles sortent de l'ombre, montent et s'effacent
      const pos = motes.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const u = (time * 0.12 + i / pos.count) % 1;
        const side = Math.sin(i * 12.9898) * 0.8;
        pos.setXYZ(i, ECHO_MOUTH.x + 0.8 - u * 2.2, y0 + 0.6 + u * 2.4 + Math.sin(time + i) * 0.1, ECHO_MOUTH.z + side + Math.sin(time * 0.7 + i) * 0.2);
      }
      pos.needsUpdate = true;
      (motes.material as THREE.PointsMaterial).opacity = 0.75;
    },
  };
}
