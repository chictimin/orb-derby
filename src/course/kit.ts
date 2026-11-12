// 구간 제작 공용 헬퍼(PM 소유). 구간 워커는 import해서 쓰되 수정하지 않는다. 필요한 헬퍼는 자기 파일에 로컬로 만든다.
import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { SectionCtx } from '../types';

export const PASTEL = {
  pink: 0xffcfe0,
  peach: 0xffe0b8,
  sky: 0xc4e6ff,
  lilac: 0xded2ff,
  mint: 0xd3f2c4,
  lemon: 0xfff0a8,
  wall: 0xf7f4ff,
  coral: 0xff7b8f,
  orange: 0xff9f5a,
  yellow: 0xffd166,
  teal: 0x8fe3c0,
  violet: 0xb8a9ff,
  blue: 0x7fc8ff,
};

export interface PhysOpt {
  friction?: number;
  restitution?: number;
  cast?: boolean;
  receive?: boolean;
  /** 보이지 않는 충돌체(메시 생략) */
  invisible?: boolean;
  opacity?: number;
}

const mats = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number, opacity = 1): THREE.MeshStandardMaterial {
  const key = `${color}:${opacity}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.02,
      transparent: opacity < 1,
      opacity,
      side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
    });
    mats.set(key, m);
  }
  return m;
}

export function makeKit(ctx: SectionCtx) {
  const { R, world, scene } = ctx;

  function place(
    desc: RAPIER.RigidBodyDesc,
    collider: RAPIER.ColliderDesc,
    geom: THREE.BufferGeometry,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    color: number,
    opt: PhysOpt,
  ) {
    const body = world.createRigidBody(
      desc.setTranslation(pos.x, pos.y, pos.z).setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }),
    );
    world.createCollider(collider.setFriction(opt.friction ?? 0.4).setRestitution(opt.restitution ?? 0.25), body);
    let mesh: THREE.Mesh | null = null;
    if (!opt.invisible) {
      mesh = new THREE.Mesh(geom, mat(color, opt.opacity ?? 1));
      mesh.position.copy(pos);
      mesh.quaternion.copy(quat);
      mesh.castShadow = opt.cast ?? true;
      mesh.receiveShadow = opt.receive ?? true;
      scene.add(mesh);
    }
    return { body, mesh };
  }

  const Q0 = new THREE.Quaternion();
  return {
    box: (hx: number, hy: number, hz: number, pos: THREE.Vector3, quat = Q0, color = PASTEL.wall, opt: PhysOpt = {}) =>
      place(R.RigidBodyDesc.fixed(), R.ColliderDesc.cuboid(hx, hy, hz), new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), pos, quat, color, opt),
    cylinder: (halfH: number, r: number, pos: THREE.Vector3, quat = Q0, color = PASTEL.wall, opt: PhysOpt = {}) =>
      place(R.RigidBodyDesc.fixed(), R.ColliderDesc.cylinder(halfH, r), new THREE.CylinderGeometry(r, r, halfH * 2, 28), pos, quat, color, opt),
    /** 움직이는 상자. 반환된 body에 update에서 setNextKinematicTranslation/Rotation */
    kinBox: (hx: number, hy: number, hz: number, pos: THREE.Vector3, quat = Q0, color = PASTEL.coral, opt: PhysOpt = {}) =>
      place(R.RigidBodyDesc.kinematicPositionBased(), R.ColliderDesc.cuboid(hx, hy, hz), new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), pos, quat, color, opt),
    kinCylinder: (halfH: number, r: number, pos: THREE.Vector3, quat = Q0, color = PASTEL.coral, opt: PhysOpt = {}) =>
      place(R.RigidBodyDesc.kinematicPositionBased(), R.ColliderDesc.cylinder(halfH, r), new THREE.CylinderGeometry(r, r, halfH * 2, 28), pos, quat, color, opt),
    /**
     * 임의 메시(월드 좌표 정점) → 고정 trimesh 충돌체. 파이프·곡면 받침 등.
     * 주의: trimesh는 두께가 0이라 빠른 구슬이 뚫을 수 있다 — 속도 상한 22, CCD 켜짐 전제에서도 급경사 고속 구간은 피한다.
     */
    trimesh: (geom: THREE.BufferGeometry, color = PASTEL.sky, opt: PhysOpt = {}) => {
      const g = geom.index ? geom : (geom.setIndex([...Array(geom.attributes.position.count).keys()]), geom);
      const v = new Float32Array(g.attributes.position.array as ArrayLike<number>);
      const idx = new Uint32Array(g.index!.array as ArrayLike<number>);
      return place(R.RigidBodyDesc.fixed(), R.ColliderDesc.trimesh(v, idx), g, new THREE.Vector3(), Q0, color, opt);
    },
    /** 장식 전용(충돌 없음) */
    deco: (geom: THREE.BufferGeometry, pos: THREE.Vector3, quat = Q0, color = PASTEL.pink) => {
      const m = new THREE.Mesh(geom, mat(color));
      m.position.copy(pos);
      m.quaternion.copy(quat);
      m.castShadow = true;
      scene.add(m);
      return m;
    },
    /** kinematic 바디 이동 + 메시 동기화 헬퍼 */
    drive: (body: RAPIER.RigidBody, mesh: THREE.Mesh | null, pos: THREE.Vector3 | null, quat: THREE.Quaternion | null) => {
      if (pos) body.setNextKinematicTranslation(pos);
      if (quat) body.setNextKinematicRotation(quat);
      if (mesh) {
        if (pos) mesh.position.copy(pos);
        if (quat) mesh.quaternion.copy(quat);
      }
    },
  };
}
