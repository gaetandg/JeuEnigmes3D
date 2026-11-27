import * as THREE from 'three';
import type { LoreNote } from '../world/lore.ts';
import { heightAt } from '../world/terrain.ts';
import { stoneMaterial } from '../world/props.ts';
import { mergeMeshes } from './merge.ts';

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** portée de lecture d'un billet (m) */
export const NOTE_REACH = 4;

interface NoteView {
  note: LoreNote;
  paper: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  pick: THREE.Mesh;
  glow: THREE.Sprite;
  read: boolean;
  phase: number;
}

/**
 * Les billets du gardien : un petit socle de pierre et, dessus, un billet plié en tente qui
 * luit doucement et flotte un peu tant qu'on ne l'a pas lu. Lu, il s'éteint et se pose.
 */
export class LoreNotes {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Mesh[] = [];
  private views: NoteView[] = [];

  constructor(notes: LoreNote[], read: Iterable<string>) {
    this.group.name = 'billets';
    const already = new Set(read);
    const stone = stoneMaterial('#cfc4ae');
    const pedestals: THREE.Mesh[] = [];
    const pedGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.75, 7);
    const sheetGeo = new THREE.PlaneGeometry(0.52, 0.36);
    const glowTex = glowTexture();
    const pickGeo = new THREE.BoxGeometry(0.8, 1.4, 0.8);
    const pickMat = new THREE.MeshBasicMaterial({ visible: false });
    notes.forEach((note, i) => {
      const y = heightAt(note.x, note.z);
      const ped = new THREE.Mesh(pedGeo, stone);
      ped.position.set(note.x, y + 0.35, note.z);
      ped.rotation.y = i * 1.7;
      ped.castShadow = ped.receiveShadow = true;
      pedestals.push(ped);
      this.group.add(ped);
      // billet plié en deux, posé comme une petite tente
      const mat = new THREE.MeshStandardMaterial({
        color: '#fbf3df', roughness: 0.9, side: THREE.DoubleSide, emissive: '#ffd98a', emissiveIntensity: 0,
      });
      const paper = new THREE.Group();
      for (const s of [-1, 1]) {
        const leaf = new THREE.Mesh(sheetGeo, mat);
        leaf.rotation.x = -Math.PI / 2 + s * 0.55;
        leaf.position.z = s * 0.09;
        leaf.castShadow = true;
        paper.add(leaf);
      }
      paper.position.set(note.x, y + 0.85, note.z);
      paper.rotation.y = i * 2.3;
      this.group.add(paper);
      // une lueur au-dessus des billets pas encore lus : on les repère de loin
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: '#ffe2a0', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.set(0.9, 1.6, 1);
      glow.position.set(note.x, y + 1.25, note.z);
      this.group.add(glow);
      const pick = new THREE.Mesh(pickGeo, pickMat);
      pick.position.set(note.x, y + 0.7, note.z);
      pick.userData = { note: note.id };
      this.group.add(pick);
      this.pickables.push(pick);
      this.views.push({ note, paper, mat, pick, glow, read: already.has(note.id), phase: i * 0.9 });
    });
    // les socles ne bougent pas : un seul maillage
    if (pedestals.length) mergeMeshes(pedestals, this.group, stone).castShadow = true;
  }

  /** Billet survolé : un peu plus lumineux. */
  private hovered: string | null = null;
  setHover(id: string | null): void {
    this.hovered = id;
  }

  markRead(id: string): void {
    const v = this.views.find((w) => w.note.id === id);
    if (v) v.read = true;
  }

  /** position d'un billet (tests : viser) */
  anchor(id: string): THREE.Vector3 | null {
    const v = this.views.find((w) => w.note.id === id);
    return v ? v.pick.position.clone() : null;
  }

  update(time: number): void {
    for (const v of this.views) {
      const base = heightAt(v.note.x, v.note.z) + 0.85;
      v.glow.visible = !v.read;
      if (v.read) {
        v.paper.position.y = base;
        v.mat.emissiveIntensity = this.hovered === v.note.id ? 0.25 : 0;
        continue;
      }
      // pas encore lu : il flotte et luit doucement
      v.paper.position.y = base + 0.08 + Math.sin(time * 1.6 + v.phase) * 0.05;
      v.paper.rotation.y += 0.004;
      v.mat.emissiveIntensity = (this.hovered === v.note.id ? 0.9 : 0.35) + 0.2 * Math.sin(time * 2.2 + v.phase);
      (v.glow.material as THREE.SpriteMaterial).opacity = 0.3 + 0.2 * Math.sin(time * 1.4 + v.phase);
    }
  }
}
