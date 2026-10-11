import * as THREE from 'three';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  p1CannonPos: THREE.Vector3;
  p2CannonPos: THREE.Vector3;
}

export class SceneManager {
  private canvas: HTMLCanvasElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  public p1CannonPos = new THREE.Vector3(-14, 0, 0);
  public p2CannonPos = new THREE.Vector3(14, 0, 0);

  private p1CoreMesh!: THREE.Mesh;
  private p2CoreMesh!: THREE.Mesh;
  private p1Ring1!: THREE.Mesh;
  private p1Ring2!: THREE.Mesh;
  private p1HaloShell!: THREE.Mesh;
  private p2Ring1!: THREE.Mesh;
  private p2Ring2!: THREE.Mesh;
  private p2HaloShell!: THREE.Mesh;
  private starsParticles!: THREE.Points;

  private cameraBasePos = new THREE.Vector3(0, 4.5, 22);
  private cameraLookTarget = new THREE.Vector3(0, 0.5, 0);
  public cameraShake = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05070e, 0.025);

    this.camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.copy(this.cameraBasePos);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Cap pixel ratio to 1.25 to prevent GPU fill-rate stalling on 1440p/4K displays
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.initLighting();
    this.initArena();
    this.initCannons();
    this.initStarfield();

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private initLighting(): void {
    const ambient = new THREE.AmbientLight(0x081026, 1.8);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xddeeff, 1.2);
    dirLight.position.set(0, 30, 20);
    this.scene.add(dirLight);

    // Cyan pointlight on P1
    const p1Light = new THREE.PointLight(0x00f0ff, 4, 30);
    p1Light.position.copy(this.p1CannonPos);
    this.scene.add(p1Light);

    // Magenta pointlight on P2
    const p2Light = new THREE.PointLight(0xff0055, 4, 30);
    p2Light.position.copy(this.p2CannonPos);
    this.scene.add(p2Light);
  }

  private initArena(): void {
    // Holographic Cyber Grid Floor
    const gridHelper = new THREE.GridHelper(80, 40, 0x00f0ff, 0x0c2044);
    gridHelper.position.y = -3.5;
    this.scene.add(gridHelper);

    // Floating Arena Bridge / Platform
    const bridgeGeo = new THREE.BoxGeometry(36, 0.4, 6);
    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0x080f20,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x030814,
    });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.y = -3.3;
    this.scene.add(bridge);

    // Neon Edge Rails on Bridge
    const railGeo = new THREE.BoxGeometry(18, 0.08, 0.15);
    const p1RailMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const p1RailFront = new THREE.Mesh(railGeo, p1RailMat);
    p1RailFront.position.set(-9, -3.08, 3.0);
    this.scene.add(p1RailFront);

    const p1RailBack = new THREE.Mesh(railGeo, p1RailMat);
    p1RailBack.position.set(-9, -3.08, -3.0);
    this.scene.add(p1RailBack);

    const p2RailMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const p2RailFront = new THREE.Mesh(railGeo, p2RailMat);
    p2RailFront.position.set(9, -3.08, 3.0);
    this.scene.add(p2RailFront);

    const p2RailBack = new THREE.Mesh(railGeo, p2RailMat);
    p2RailBack.position.set(9, -3.08, -3.0);
    this.scene.add(p2RailBack);

    // Neon Center Divide Line on bridge
    const centerLineGeo = new THREE.PlaneGeometry(0.25, 6);
    const centerLineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    const centerLine = new THREE.Mesh(centerLineGeo, centerLineMat);
    centerLine.rotation.x = Math.PI / 2;
    centerLine.position.set(0, -3.05, 0);
    this.scene.add(centerLine);
  }

  private createCannonPylon(isP1: boolean): {
    pylonGroup: THREE.Group;
    core: THREE.Mesh;
    haloShell: THREE.Mesh;
    ring1: THREE.Mesh;
    ring2: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const color = isP1 ? 0x00f0ff : 0xff0055;

    // Base pedestal - lowered so it sits cleanly beneath the rotating rings
    const baseGeo = new THREE.CylinderGeometry(2.0, 2.6, 1.4, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0c1426,
      metalness: 0.85,
      roughness: 0.3,
      emissive: isP1 ? 0x001828 : 0x280012,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -2.8;
    group.add(base);

    // Glowing emitter collar on top rim of the pedestal
    const collarGeo = new THREE.TorusGeometry(1.95, 0.05, 8, 32);
    collarGeo.rotateX(Math.PI / 2);
    const collarMat = new THREE.MeshBasicMaterial({ color });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.y = -2.1;
    group.add(collar);

    // Holographic levitation containment field holding the core
    const levGeo = new THREE.CylinderGeometry(0.35, 1.35, 2.3, 16, 1, true);
    const levMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const levBeam = new THREE.Mesh(levGeo, levMat);
    levBeam.position.y = -0.9;
    group.add(levBeam);

    // Glowing core crystal
    const coreGeo = new THREE.OctahedronGeometry(1.2, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color,
      wireframe: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.5;
    group.add(core);

    // Wireframe outer containment shell
    const shellGeo = new THREE.OctahedronGeometry(1.5, 0);
    const shellMat = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const haloShell = new THREE.Mesh(shellGeo, shellMat);
    haloShell.position.y = 0.5;
    group.add(haloShell);

    // Rotating containment rings
    const ringGeo1 = new THREE.TorusGeometry(1.9, 0.08, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat);
    ring1.position.y = 0.5;
    group.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(2.3, 0.06, 8, 32);
    const ring2 = new THREE.Mesh(ringGeo2, ringMat);
    ring2.position.y = 0.5;
    group.add(ring2);

    return { pylonGroup: group, core, haloShell, ring1, ring2 };
  }

  private initCannons(): void {
    const p1 = this.createCannonPylon(true);
    p1.pylonGroup.position.copy(this.p1CannonPos);
    this.scene.add(p1.pylonGroup);
    this.p1CoreMesh = p1.core;
    this.p1HaloShell = p1.haloShell;
    this.p1Ring1 = p1.ring1;
    this.p1Ring2 = p1.ring2;

    const p2 = this.createCannonPylon(false);
    p2.pylonGroup.position.copy(this.p2CannonPos);
    this.scene.add(p2.pylonGroup);
    this.p2CoreMesh = p2.core;
    this.p2HaloShell = p2.haloShell;
    this.p2Ring1 = p2.ring1;
    this.p2Ring2 = p2.ring2;
  }

  private initStarfield(): void {
    const count = 750;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 50 - 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 10;

      const isCyan = Math.random() > 0.5;
      colors[i * 3] = isCyan ? 0.2 : 0.8;
      colors[i * 3 + 1] = isCyan ? 0.8 : 0.2;
      colors[i * 3 + 2] = isCyan ? 1.0 : 0.6;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });
    this.starsParticles = new THREE.Points(geo, mat);
    this.scene.add(this.starsParticles);
  }

  public triggerShake(intensity: number = 0.5): void {
    this.cameraShake = Math.min(this.cameraShake + intensity, 1.2);
  }

  public update(time: number, delta: number, clashX: number): void {
    // Rotate pylon rings & pulse cores
    if (this.p1Ring1) {
      this.p1Ring1.rotation.x += delta * 1.5;
      this.p1Ring1.rotation.y += delta * 1.8;
      this.p1Ring2.rotation.x -= delta * 1.2;
      this.p1Ring2.rotation.z += delta * 1.4;
      if (this.p1HaloShell) {
        this.p1HaloShell.rotation.y -= delta * 0.9;
        this.p1HaloShell.rotation.x += delta * 0.6;
        this.p1HaloShell.position.y = 0.5 + Math.sin(time * 3) * 0.12;
      }
      const s1 = 1.0 + Math.sin(time * 5) * 0.12;
      this.p1CoreMesh.scale.set(s1, s1, s1);
      this.p1CoreMesh.position.y = 0.5 + Math.sin(time * 3) * 0.12;
    }
    if (this.p2Ring1) {
      this.p2Ring1.rotation.x += delta * 1.5;
      this.p2Ring1.rotation.y -= delta * 1.8;
      this.p2Ring2.rotation.x -= delta * 1.2;
      this.p2Ring2.rotation.z -= delta * 1.4;
      if (this.p2HaloShell) {
        this.p2HaloShell.rotation.y += delta * 0.9;
        this.p2HaloShell.rotation.x -= delta * 0.6;
        this.p2HaloShell.position.y = 0.5 + Math.cos(time * 3) * 0.12;
      }
      const s2 = 1.0 + Math.cos(time * 5) * 0.12;
      this.p2CoreMesh.scale.set(s2, s2, s2);
      this.p2CoreMesh.position.y = 0.5 + Math.cos(time * 3) * 0.12;
    }

    // Drift star particles slowly
    if (this.starsParticles) {
      this.starsParticles.rotation.y = time * 0.012;
    }

    // Dynamic Camera Tracking: smoothly tracks clash nexus
    const targetCamX = clashX * 0.45;
    this.camera.position.x += (targetCamX - this.camera.position.x) * 0.05;

    // Apply camera shake if any
    if (this.cameraShake > 0.001) {
      const shakeX = (Math.random() - 0.5) * this.cameraShake * 1.2;
      const shakeY = (Math.random() - 0.5) * this.cameraShake * 1.2;
      this.camera.position.x += shakeX;
      this.camera.position.y = this.cameraBasePos.y + shakeY;
      this.cameraShake *= 0.88;
    } else {
      this.camera.position.y = this.cameraBasePos.y;
    }

    this.cameraLookTarget.x = clashX * 0.6;
    this.camera.lookAt(this.cameraLookTarget);

    this.renderer.render(this.scene, this.camera);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
