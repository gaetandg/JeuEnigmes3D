import * as THREE from 'three';
import { heightAt, walkable } from '../world/terrain.ts';
import type { Colliders } from './colliders.ts';

const EYE = 1.65;
const RADIUS = 0.35;
const WALK = 4.2;
const RUN = 7.5;

/**
 * Joueur à la première personne. Les entrées (clavier/souris) sont séparées
 * du déplacement pour pouvoir ajouter plus tard des contrôles tactiles.
 */
export class Player {
  readonly position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  /** Entrées de déplacement normalisées (-1..1), remplies par le clavier ou le tactile. */
  readonly move = { forward: 0, right: 0, run: false };
  sensitivity = 0.0022;
  private bob = 0;
  /** appelé à chaque pas (sons) */
  onStep: (() => void) | null = null;
  private velocity = new THREE.Vector2();

  constructor(private camera: THREE.PerspectiveCamera, private colliders: Colliders) {}

  place(x: number, z: number, yaw: number, pitch = 0): void {
    this.position.set(x, heightAt(x, z) + EYE, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.velocity.set(0, 0);
    this.apply();
  }

  /** inverser l'axe vertical du regard */
  invertY = false;
  /** balancement de la tête en marchant */
  bobOn = true;

  look(dx: number, dy: number): void {
    this.lookRadians(-dx * this.sensitivity, -dy * this.sensitivity);
  }

  /** Tourne le regard (radians) : utilisé par la souris, le tactile et la manette. */
  lookRadians(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    this.pitch += this.invertY ? -dPitch : dPitch;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  update(dt: number): void {
    const f = this.move.forward;
    const r = this.move.right;
    const len = Math.hypot(f, r);
    const speed = this.move.run ? RUN : WALK;
    // directions au sol
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const tx = len > 0 ? ((fx * f + rx * r) / Math.max(1, len)) * speed : 0;
    const tz = len > 0 ? ((fz * f + rz * r) / Math.max(1, len)) * speed : 0;
    const k = Math.min(1, dt * 10);
    this.velocity.x += (tx - this.velocity.x) * k;
    this.velocity.y += (tz - this.velocity.y) * k;

    let nx = this.position.x + this.velocity.x * dt;
    let nz = this.position.z + this.velocity.y * dt;
    // pas de baignade : on reste sur la terre ferme
    if (!walkable(nx, nz)) {
      nx = this.position.x;
      nz = this.position.z;
    }
    const res = this.colliders.resolve(nx, nz, RADIUS);
    // marches trop raides interdites
    const h0 = heightAt(this.position.x, this.position.z);
    const h1 = heightAt(res.x, res.z);
    const stepLen = Math.hypot(res.x - this.position.x, res.z - this.position.z);
    if (stepLen > 1e-4 && (h1 - h0) / stepLen > 1.6) {
      this.velocity.set(0, 0);
    } else {
      this.position.x = res.x;
      this.position.z = res.z;
    }
    const moving = Math.hypot(this.velocity.x, this.velocity.y);
    const before = Math.floor(this.bob / Math.PI);
    this.bob += dt * moving * 1.9;
    if (moving > 1 && Math.floor(this.bob / Math.PI) !== before) this.onStep?.();
    const ground = heightAt(this.position.x, this.position.z) + EYE + (this.bobOn ? Math.sin(this.bob) * 0.025 * Math.min(1, moving / WALK) : 0);
    this.position.y += (ground - this.position.y) * Math.min(1, dt * 14);
    this.apply();
  }

  private apply(): void {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}

/** Entrées clavier + souris (verrouillage du pointeur). */
export class DesktopInput {
  private keys = new Set<string>();
  locked = false;
  onClick: ((button: number) => void) | null = null;
  onLockChange: ((locked: boolean) => void) | null = null;
  /** touche H : demander de l'aide */
  onHelp: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, private player: Player) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && !e.repeat && this.locked) this.onHelp?.();
      this.keys.add(e.code);
      this.sync();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.sync();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.sync();
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) this.player.look(e.movementX, e.movementY);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.locked) this.onClick?.(e.button);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) {
        this.keys.clear();
        this.sync();
      }
      this.onLockChange?.(this.locked);
    });
  }

  /** Libère la souris (séquence de fin). */
  release(): void {
    if (this.locked) document.exitPointerLock?.();
  }

  requestLock(): void {
    const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => undefined);
  }

  private sync(): void {
    const k = (c: string) => this.keys.has(c);
    // KeyW etc. sont des positions physiques : ZQSD sur AZERTY, WASD sur QWERTY
    this.player.move.forward = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    this.player.move.right = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    this.player.move.run = k('ShiftLeft') || k('ShiftRight');
  }
}
