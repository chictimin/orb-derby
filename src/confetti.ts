// 우승 색종이(PM 소유). InstancedMesh 1개로 그려 draw call 1회. prefers-reduced-motion이면 아무것도 안 한다.
import * as THREE from 'three';

const N = 220;
const LIFE = 3.2; // 초
const PALETTE = [0xff7fb0, 0xffd166, 0x8fe3c0, 0x7fc8ff, 0xb39dff, 0xff9f5a];

export function createConfetti(scene: THREE.Scene) {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const geo = new THREE.PlaneGeometry(0.28, 0.18);
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);

  const pos = Array.from({ length: N }, () => new THREE.Vector3());
  const vel = Array.from({ length: N }, () => new THREE.Vector3());
  const rot = Array.from({ length: N }, () => new THREE.Euler());
  const spin = Array.from({ length: N }, () => new THREE.Vector3());
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  let t = -1;

  return {
    burst(at: THREE.Vector3, accent?: string) {
      if (reduce) return;
      for (let i = 0; i < N; i++) {
        pos[i].copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2));
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 5;
        vel[i].set(Math.cos(a) * s * 0.5, 7 + Math.random() * 7, Math.sin(a) * s * 0.5);
        rot[i].set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        spin[i].set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
        col.set(accent && i % 3 === 0 ? accent : PALETTE[i % PALETTE.length]);
        mesh.setColorAt(i, col);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      t = 0;
      mesh.visible = true;
    },
    update(dt: number) {
      if (t < 0) return;
      t += dt;
      if (t > LIFE) {
        t = -1;
        mesh.visible = false;
        return;
      }
      const fade = Math.min(1, (LIFE - t) / 0.6); // 마지막 0.6초 축소
      for (let i = 0; i < N; i++) {
        vel[i].y -= 9.8 * 0.55 * dt; // 종이라 천천히
        vel[i].multiplyScalar(1 - 0.9 * dt); // 공기 저항
        pos[i].addScaledVector(vel[i], dt);
        rot[i].x += spin[i].x * dt;
        rot[i].y += spin[i].y * dt;
        rot[i].z += spin[i].z * dt;
        q.setFromEuler(rot[i]);
        m4.compose(pos[i], q, one.clone().multiplyScalar(fade));
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
