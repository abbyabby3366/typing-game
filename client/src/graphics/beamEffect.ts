import * as THREE from 'three';

interface Shockwave {
  mesh: THREE.Mesh;
  scale: number;
  maxScale: number;
  opacity: number;
  isP1: boolean;
}

export class BeamEffect {
  private scene: THREE.Scene;
  private p1Pos: THREE.Vector3;
  private p2Pos: THREE.Vector3;

  private p1BeamInner!: THREE.Mesh;
  private p1BeamOuter!: THREE.Mesh;
  private p2BeamInner!: THREE.Mesh;
  private p2BeamOuter!: THREE.Mesh;

  private nexusCore!: THREE.Mesh;
  private nexusHalo!: THREE.Mesh;
  private nexusSparks!: THREE.Points;
  private sparkPositions!: Float32Array;
  private sparkVelocities!: Float32Array;

  private shockwaves: Shockwave[] = [];
  private shockwavePoolP1: THREE.Mesh[] = [];
  private shockwavePoolP2: THREE.Mesh[] = [];
  private static ringGeo: THREE.RingGeometry | null = null;
  private static p1ShockMat: THREE.MeshBasicMaterial | null = null;
  private static p2ShockMat: THREE.MeshBasicMaterial | null = null;

  public currentClashX: number = 0;
  private targetClashX: number = 0;
  private clashPos = new THREE.Vector3(0, 0.5, 0);

  constructor(scene: THREE.Scene, p1Pos: THREE.Vector3, p2Pos: THREE.Vector3) {
    this.scene = scene;
    this.p1Pos = p1Pos.clone().add(new THREE.Vector3(0, 0.5, 0));
    this.p2Pos = p2Pos.clone().add(new THREE.Vector3(0, 0.5, 0));

    if (!BeamEffect.ringGeo) {
      BeamEffect.ringGeo = new THREE.RingGeometry(0.8, 1.2, 32);
      BeamEffect.p1ShockMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      BeamEffect.p2ShockMat = new THREE.MeshBasicMaterial({
        color: 0xff0055,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
    }

    this.initBeams();
    this.initNexus();
  }

  private initBeams(): void {
    // P1 Cyan Beam
    const p1InnerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    const p1OuterMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });

    const dummyGeo = new THREE.CylinderGeometry(0.25, 0.25, 1, 16);
    dummyGeo.rotateZ(Math.PI / 2);

    this.p1BeamInner = new THREE.Mesh(dummyGeo, p1InnerMat);
    this.p1BeamOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1, 16).rotateZ(Math.PI / 2), p1OuterMat);
    this.scene.add(this.p1BeamInner);
    this.scene.add(this.p1BeamOuter);

    // P2 Magenta Beam
    const p2InnerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    const p2OuterMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });

    this.p2BeamInner = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 16).rotateZ(Math.PI / 2), p2InnerMat);
    this.p2BeamOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1, 16).rotateZ(Math.PI / 2), p2OuterMat);
    this.scene.add(this.p2BeamInner);
    this.scene.add(this.p2BeamOuter);
  }

  private initNexus(): void {
    // Clash Nexus Sphere Core
    const coreGeo = new THREE.SphereGeometry(0.85, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
    });
    this.nexusCore = new THREE.Mesh(coreGeo, coreMat);
    this.scene.add(this.nexusCore);

    // Clash Halo
    const haloGeo = new THREE.SphereGeometry(1.6, 24, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    this.nexusHalo = new THREE.Mesh(haloGeo, haloMat);
    this.scene.add(this.nexusHalo);

    // Dynamic Spark Particles at Clash Nexus
    const sparkCount = 180;
    const geo = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(sparkCount * 3);
    this.sparkVelocities = new Float32Array(sparkCount * 3);

    for (let i = 0; i < sparkCount; i++) {
      this.sparkPositions[i * 3] = 0;
      this.sparkPositions[i * 3 + 1] = 0.5;
      this.sparkPositions[i * 3 + 2] = 0;

      this.sparkVelocities[i * 3] = (Math.random() - 0.5) * 8.0;
      this.sparkVelocities[i * 3 + 1] = (Math.random() - 0.5) * 8.0;
      this.sparkVelocities[i * 3 + 2] = (Math.random() - 0.5) * 8.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.28,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    this.nexusSparks = new THREE.Points(geo, sparkMat);
    this.scene.add(this.nexusSparks);
  }

  public setTugPosition(tug: number): void {
    // tug ranges from -1.0 (P1 winning, clash pushed to +11) to +1.0 (P2 winning, clash pushed to -11)
    // Note: If P1 pushes, clash moves toward P2 (+X direction)
    this.targetClashX = -tug * 11.5;
  }

  public triggerShockwave(isP1: boolean, power: number = 1.0): void {
    const pool = isP1 ? this.shockwavePoolP1 : this.shockwavePoolP2;
    let ring = pool.pop();

    if (!ring) {
      const mat = isP1 ? BeamEffect.p1ShockMat! : BeamEffect.p2ShockMat!;
      ring = new THREE.Mesh(BeamEffect.ringGeo!, mat.clone());
      ring.rotation.y = Math.PI / 2;
    }

    ring.position.set(this.currentClashX, 0.5, 0);
    ring.scale.set(1.0, 1.0, 1.0);
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.85;
    this.scene.add(ring);

    this.shockwaves.push({
      mesh: ring,
      scale: 1.0,
      maxScale: 3.5 + power * 2.0,
      opacity: 0.85,
      isP1,
    });
  }

  public update(time: number, delta: number): void {
    // Smooth lerp clash position
    this.currentClashX += (this.targetClashX - this.currentClashX) * 0.08;

    this.clashPos.x = this.currentClashX;
    this.clashPos.y = 0.5;
    this.clashPos.z = 0;

    // Update P1 Beam
    const p1Dist = this.currentClashX - this.p1Pos.x;
    if (p1Dist > 0.1) {
      const p1MidX = this.p1Pos.x + p1Dist / 2;
      this.p1BeamInner.position.set(p1MidX, 0.5, 0);
      this.p1BeamOuter.position.set(p1MidX, 0.5, 0);
      this.p1BeamInner.scale.set(1.0, p1Dist, 1.0);
      this.p1BeamOuter.scale.set(1.0, p1Dist, 1.0);
      this.p1BeamInner.visible = true;
      this.p1BeamOuter.visible = true;
    } else {
      this.p1BeamInner.visible = false;
      this.p1BeamOuter.visible = false;
    }

    // Update P2 Beam
    const p2Dist = this.p2Pos.x - this.currentClashX;
    if (p2Dist > 0.1) {
      const p2MidX = this.currentClashX + p2Dist / 2;
      this.p2BeamInner.position.set(p2MidX, 0.5, 0);
      this.p2BeamOuter.position.set(p2MidX, 0.5, 0);
      this.p2BeamInner.scale.set(1.0, p2Dist, 1.0);
      this.p2BeamOuter.scale.set(1.0, p2Dist, 1.0);
      this.p2BeamInner.visible = true;
      this.p2BeamOuter.visible = true;
    } else {
      this.p2BeamInner.visible = false;
      this.p2BeamOuter.visible = false;
    }

    // Pulse Nexus Core & Halo
    const pulse = 1.0 + Math.sin(time * 24) * 0.25;
    this.nexusCore.position.copy(this.clashPos);
    this.nexusCore.scale.set(pulse, pulse, pulse);

    this.nexusHalo.position.copy(this.clashPos);
    const haloScale = 1.0 + Math.cos(time * 16) * 0.3;
    this.nexusHalo.scale.set(haloScale, haloScale, haloScale);

    // Update Nexus Spark Particles
    const posAttr = this.nexusSparks.geometry.attributes.position as THREE.BufferAttribute;
    const count = this.sparkPositions.length / 3;

    for (let i = 0; i < count; i++) {
      this.sparkPositions[i * 3] += this.sparkVelocities[i * 3] * delta;
      this.sparkPositions[i * 3 + 1] += this.sparkVelocities[i * 3 + 1] * delta;
      this.sparkPositions[i * 3 + 2] += this.sparkVelocities[i * 3 + 2] * delta;

      // Check distance from clash nexus
      const dx = this.sparkPositions[i * 3] - this.clashPos.x;
      const dy = this.sparkPositions[i * 3 + 1] - this.clashPos.y;
      const dz = this.sparkPositions[i * 3 + 2] - this.clashPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > 3.0 || Math.random() < 0.05) {
        // Reset to nexus center with new velocity
        this.sparkPositions[i * 3] = this.clashPos.x;
        this.sparkPositions[i * 3 + 1] = this.clashPos.y;
        this.sparkPositions[i * 3 + 2] = this.clashPos.z;

        this.sparkVelocities[i * 3] = (Math.random() - 0.5) * 10.0;
        this.sparkVelocities[i * 3 + 1] = (Math.random() - 0.5) * 10.0;
        this.sparkVelocities[i * 3 + 2] = (Math.random() - 0.5) * 10.0;
      }
    }
    posAttr.needsUpdate = true;

    // Update Expanding Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.scale += delta * 6.5;
      sw.opacity -= delta * 1.5;
      sw.mesh.scale.set(sw.scale, sw.scale, 1);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, sw.opacity);

      if (sw.opacity <= 0 || sw.scale >= sw.maxScale) {
        this.scene.remove(sw.mesh);
        if (sw.isP1) {
          this.shockwavePoolP1.push(sw.mesh);
        } else {
          this.shockwavePoolP2.push(sw.mesh);
        }
        this.shockwaves.splice(i, 1);
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.p1BeamInner.visible = visible;
    this.p1BeamOuter.visible = visible;
    this.p2BeamInner.visible = visible;
    this.p2BeamOuter.visible = visible;
    this.nexusCore.visible = visible;
    this.nexusHalo.visible = visible;
    this.nexusSparks.visible = visible;
    if (!visible) {
      for (const sw of this.shockwaves) {
        sw.mesh.visible = false;
      }
    }
  }

  public dispose(): void {
    this.scene.remove(this.p1BeamInner);
    this.scene.remove(this.p1BeamOuter);
    this.scene.remove(this.p2BeamInner);
    this.scene.remove(this.p2BeamOuter);
    this.scene.remove(this.nexusCore);
    this.scene.remove(this.nexusHalo);
    this.scene.remove(this.nexusSparks);
    for (const sw of this.shockwaves) {
      this.scene.remove(sw.mesh);
    }
  }
}
