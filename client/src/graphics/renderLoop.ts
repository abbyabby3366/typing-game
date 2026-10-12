import * as THREE from 'three';
import { BeamEffect } from './beamEffect';
import { SceneManager } from './sceneManager';
import { ProjectileManager } from './projectileManager';

export interface RenderLoopOptions {
  isMatchActive: () => boolean;
  isZenMode?: () => boolean;
  beamEffect: BeamEffect;
  sceneManager: SceneManager;
  projectileManager: ProjectileManager;
  onTugUpdate: (tug: number) => void;
}

export function startRenderLoop(options: RenderLoopOptions): void {
  const clock = new THREE.Clock();
  let lastLobbyFrame = 0;

  const animate = () => {
    requestAnimationFrame(animate);

    // Pause rendering and calculations when tab is hidden to save GPU cycles and battery
    if (document.hidden) {
      return;
    }

    // In lobby, throttle background 3D canvas to ~30 FPS for instant UI response
    if (!options.isMatchActive()) {
      const now = performance.now();
      if (now - lastLobbyFrame < 33) {
        return;
      }
      lastLobbyFrame = now;
    }

    const delta = Math.min(clock.getDelta(), 0.1);
    const time = clock.getElapsedTime();

    options.beamEffect.update(time, delta);
    options.sceneManager.update(time, delta, options.beamEffect.currentClashX);

    if (options.isMatchActive()) {
      const isZen = options.isZenMode?.() ?? false;
      if (!isZen) {
        const currentTug = -options.beamEffect.currentClashX / 11.5;
        options.onTugUpdate(currentTug);

        options.projectileManager.update(delta, options.beamEffect.currentClashX, (isP1, power) => {
          options.beamEffect.triggerShockwave(isP1, power);
          options.sceneManager.triggerShake(power * 0.4);
        });
      } else {
        options.projectileManager.update(delta, 10, () => {});
      }
    }
  };

  animate();
}
