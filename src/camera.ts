// STUB — 워커 B가 교체한다. 계약은 src/types.ts의 CameraDirector.
// 현재: focus 구슬 뒤를 단순 추적 + 수동 모드 OrbitControls.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CreateCameraDirector } from './types';

export const createCameraDirector: CreateCameraDirector = (camera, dom, course) => {
  const controls = new OrbitControls(camera, dom);
  controls.enabled = false;
  let manual = false;
  const target = course.overviewShot.target.clone();
  camera.position.copy(course.overviewShot.position);
  camera.lookAt(target);

  return {
    update(dt, snap) {
      if (manual) {
        controls.update();
        return;
      }
      const k = 1 - Math.exp(-dt * 3);
      if (snap.phase === 'racing' && snap.ranked[0]) {
        const p = snap.ranked[0].mesh.position;
        camera.position.lerp(new THREE.Vector3(p.x + 8, p.y + 8, p.z + 14), k);
        target.lerp(p, k);
      } else {
        camera.position.lerp(course.overviewShot.position, k);
        target.lerp(course.overviewShot.target, k);
      }
      camera.lookAt(target);
    },
    setManual(on) {
      manual = on;
      controls.enabled = on;
      if (on) controls.target.copy(target);
    },
    isManual: () => manual,
  };
};
