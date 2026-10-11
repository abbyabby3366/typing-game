import * as THREE from 'three';
import { soundEngine } from '../audio/soundEngine';

interface FlyingWord {
  pooledItem: PooledWordMesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  progress: number;
  speed: number;
  isP1: boolean;
  word: string;
  combo: number;
  pushPower: number;
}

interface PooledWordMesh {
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  inUse: boolean;
}

interface PooledSparkBurst {
  particles: THREE.Points;
  positions: Float32Array;
  velocities: Float32Array;
  mat: THREE.PointsMaterial;
  life: number;
  maxLife: number;
  activeCount: number;
  inUse: boolean;
}

export class ProjectileManager {
  private scene: THREE.Scene;
  private projectiles: FlyingWord[] = [];
  private wordPool: PooledWordMesh[] = [];
  private burstPool: PooledSparkBurst[] = [];
  private activeBursts: PooledSparkBurst[] = [];

  private static readonly MAX_BURST_PARTICLES = 160;
  private static planeGeo: THREE.PlaneGeometry | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    if (!ProjectileManager.planeGeo) {
      ProjectileManager.planeGeo = new THREE.PlaneGeometry(3.6, 0.9);
    }
  }

  private getOrCreateWordMesh(): PooledWordMesh {
    const existing = this.wordPool.find((p) => !p.inUse);
    if (existing) {
      existing.inUse = true;
      return existing;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Mesh(ProjectileManager.planeGeo!, material);
    const item: PooledWordMesh = {
      mesh,
      canvas,
      ctx,
      texture,
      material,
      inUse: true,
    };
    this.wordPool.push(item);
    return item;
  }

  private renderWordToCanvas(item: PooledWordMesh, word: string, isP1: boolean, combo: number): void {
    const { canvas, ctx, texture } = item;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const primaryColor = isP1 ? '#00f0ff' : '#ff0055';
    const glowColor = isP1 ? 'rgba(0, 240, 255, 0.8)' : 'rgba(255, 0, 85, 0.8)';

    // Cyber border badge
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4;
    ctx.fillStyle = 'rgba(5, 8, 16, 0.85)';
    ctx.beginPath();
    ctx.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 12);
    ctx.fill();
    ctx.stroke();

    // Word text with intense neon glow
    ctx.font = 'bold 54px "Orbitron", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(word.toUpperCase(), canvas.width / 2, canvas.height / 2);

    // Multiplier pill if combo active
    if (combo > 1) {
      ctx.font = 'bold 22px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.fillText(`+${combo}X`, canvas.width - 70, 36);
    }

    texture.needsUpdate = true;
  }

  public fireWord(
    word: string,
    isP1: boolean,
    startPos: THREE.Vector3,
    targetClashX: number,
    combo: number = 1,
    pushPower: number = 1.0
  ): void {
    const pooledItem = this.getOrCreateWordMesh();
    this.renderWordToCanvas(pooledItem, word, isP1, combo);

    const origin = startPos.clone().add(new THREE.Vector3(isP1 ? 2.0 : -2.0, 1.2, 0));
    pooledItem.mesh.position.copy(origin);
    pooledItem.mesh.rotation.set(0, 0, 0);
    this.scene.add(pooledItem.mesh);

    const target = new THREE.Vector3(targetClashX, 0.5, 0);

    this.projectiles.push({
      pooledItem,
      startPos: origin,
      targetPos: target,
      progress: 0,
      speed: 2.2 + Math.min(combo * 0.25, 2.0),
      isP1,
      word,
      combo,
      pushPower,
    });

    // Play laser audio zap
    soundEngine.playWordFired(isP1, combo);
  }

  private getOrCreateBurst(): PooledSparkBurst {
    const existing = this.burstPool.find((b) => !b.inUse);
    if (existing) {
      existing.inUse = true;
      return existing;
    }

    const maxCount = ProjectileManager.MAX_BURST_PARTICLES;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxCount * 3);
    const velocities = new Float32Array(maxCount * 3);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.32,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geo, mat);
    const burst: PooledSparkBurst = {
      particles,
      positions,
      velocities,
      mat,
      life: 0,
      maxLife: 0.55,
      activeCount: 0,
      inUse: true,
    };
    this.burstPool.push(burst);
    return burst;
  }

  private createDetonationBurst(pos: THREE.Vector3, isP1: boolean, power: number): void {
    const burst = this.getOrCreateBurst();
    const count = Math.min(80 + Math.floor(power * 40), ProjectileManager.MAX_BURST_PARTICLES);
    burst.activeCount = count;
    burst.life = 0;
    burst.maxLife = 0.55;
    burst.mat.color.setHex(isP1 ? 0x00f0ff : 0xff0055);
    burst.mat.opacity = 1.0;

    for (let i = 0; i < count; i++) {
      burst.positions[i * 3] = pos.x;
      burst.positions[i * 3 + 1] = pos.y;
      burst.positions[i * 3 + 2] = pos.z;

      const speed = 6.0 + Math.random() * 10.0;
      const angle = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      burst.velocities[i * 3] = Math.cos(angle) * Math.cos(phi) * speed;
      burst.velocities[i * 3 + 1] = Math.sin(phi) * speed;
      burst.velocities[i * 3 + 2] = Math.sin(angle) * Math.cos(phi) * speed;
    }

    const posAttr = burst.particles.geometry.attributes.position as THREE.BufferAttribute;
    posAttr.needsUpdate = true;

    this.scene.add(burst.particles);
    this.activeBursts.push(burst);
  }

  public update(
    delta: number,
    currentClashX: number,
    onImpactCallback?: (isP1: boolean, power: number) => void
  ): void {
    // Update flying words
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += delta * p.speed;

      // Dynamically adjust target to moving clash nexus
      p.targetPos.x = currentClashX;

      // Arc trajectory: slight parabolic lift mid-flight
      const arcY = Math.sin(p.progress * Math.PI) * 1.2;
      p.pooledItem.mesh.position.x = THREE.MathUtils.lerp(p.startPos.x, p.targetPos.x, p.progress);
      p.pooledItem.mesh.position.y = THREE.MathUtils.lerp(p.startPos.y, p.targetPos.y, p.progress) + arcY;
      p.pooledItem.mesh.position.z = THREE.MathUtils.lerp(p.startPos.z, p.targetPos.z, p.progress);

      // Slight tilt rotation
      p.pooledItem.mesh.rotation.z = Math.sin(p.progress * Math.PI * 4) * 0.08;

      if (p.progress >= 1.0) {
        // Impact at clash nexus!
        this.createDetonationBurst(p.targetPos, p.isP1, p.pushPower);
        soundEngine.playClashImpact(p.pushPower);

        if (onImpactCallback) {
          onImpactCallback(p.isP1, p.pushPower);
        }

        // Return mesh to pool without GC destruction
        this.scene.remove(p.pooledItem.mesh);
        p.pooledItem.inUse = false;
        this.projectiles.splice(i, 1);
      }
    }

    // Update active detonation bursts
    for (let i = this.activeBursts.length - 1; i >= 0; i--) {
      const b = this.activeBursts[i];
      b.life += delta;
      const count = b.activeCount;

      for (let j = 0; j < count; j++) {
        b.positions[j * 3] += b.velocities[j * 3] * delta;
        b.positions[j * 3 + 1] += b.velocities[j * 3 + 1] * delta;
        b.positions[j * 3 + 2] += b.velocities[j * 3 + 2] * delta;
      }

      const posAttr = b.particles.geometry.attributes.position as THREE.BufferAttribute;
      posAttr.needsUpdate = true;

      const progress = b.life / b.maxLife;
      b.mat.opacity = Math.max(0, 1.0 - progress);

      if (b.life >= b.maxLife) {
        this.scene.remove(b.particles);
        b.inUse = false;
        this.activeBursts.splice(i, 1);
      }
    }
  }
}
