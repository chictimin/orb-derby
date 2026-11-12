// STUB — 워커 A가 교체한다. 계약은 src/types.ts의 Course.
// 현재: z=0 → z=-100으로 내려가는 단순 경사 슈트.
import * as THREE from 'three';
import type { BuildCourse, Course } from './types';

const LEN = 100;
const TOP = 30;

export const buildCourse: BuildCourse = (R, world, scene) => {
  const slope = Math.atan2(TOP, LEN);
  const hyp = Math.hypot(TOP, LEN);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-slope, 0, 0));
  const center = new THREE.Vector3(0, TOP / 2, -LEN / 2);

  const add = (hx: number, hy: number, hz: number, pos: THREE.Vector3, color: number) => {
    const body = world.createRigidBody(
      R.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z).setRotation(q),
    );
    world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.3).setRestitution(0.3), body);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2),
      new THREE.MeshStandardMaterial({ color }),
    );
    mesh.position.copy(pos);
    mesh.quaternion.copy(q);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  add(6, 0.25, hyp / 2, center, 0xffd6e8);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  add(0.25, 1.5, hyp / 2, center.clone().add(new THREE.Vector3(-6, 0, 0)).addScaledVector(up, 1.2), 0x9ad0ff);
  add(0.25, 1.5, hyp / 2, center.clone().add(new THREE.Vector3(6, 0, 0)).addScaledVector(up, 1.2), 0x9ad0ff);

  const progressOf = (p: THREE.Vector3) => THREE.MathUtils.clamp(-p.z / LEN, 0, 1);
  const course: Course = {
    spawnPoints: Array.from({ length: 20 }, (_, i) =>
      new THREE.Vector3(((i % 5) - 2) * 1.6, TOP + 2 + Math.floor(i / 5) * 1.2, -1),
    ),
    progressOf,
    isFinished: (p) => p.z < -LEN,
    isOut: (p) => p.y < -10,
    respawnPoint: (pr) => new THREE.Vector3(0, TOP * (1 - pr) + 2, -pr * LEN),
    update: () => {},
    hotspots: [],
    overviewShot: {
      name: 'overview',
      position: new THREE.Vector3(40, 45, 10),
      target: new THREE.Vector3(0, 10, -50),
    },
  };
  return course;
};
