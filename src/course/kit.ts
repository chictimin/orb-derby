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

/**
 * 반투명 유리 재질(가드레일 공용). depthWrite 끔 → 반투명 면끼리 서로를 가려 깜빡이거나 사라지는 정렬 문제 완화.
 * 색·투명도별로 하나만 만들어 공유한다.
 */
const glass = new Map<string, THREE.MeshStandardMaterial>();
export function glassMat(color: number, opacity = 0.35): THREE.MeshStandardMaterial {
  const key = `${color}:${opacity}`;
  let m = glass.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    glass.set(key, m);
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

  function trimeshBody(geom: THREE.BufferGeometry, color: number, opt: PhysOpt) {
    const g = geom.index ? geom : (geom.setIndex([...Array(geom.attributes.position.count).keys()]), geom);
    const v = new Float32Array(g.attributes.position.array as ArrayLike<number>);
    const idx = new Uint32Array(g.index!.array as ArrayLike<number>);
    // 이음매 튐 방지: 인접 삼각형 법선을 고려해 내부 모서리 접촉을 보정 + 중복 정점 병합
    const flags = R.TriMeshFlags.FIX_INTERNAL_EDGES | R.TriMeshFlags.MERGE_DUPLICATE_VERTICES;
    g.computeVertexNormals();
    const res = place(R.RigidBodyDesc.fixed(), R.ColliderDesc.trimesh(v, idx, flags), g, new THREE.Vector3(), Q0, color, {
      cast: false,
      ...opt,
    });
    // 곡면은 안팎 어느 쪽에서도 보이게
    if (res.mesh) {
      const m = (res.mesh.material as THREE.MeshStandardMaterial).clone();
      m.side = THREE.DoubleSide;
      res.mesh.material = m;
    }
    return res;
  }

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
    trimesh: (geom: THREE.BufferGeometry, color = PASTEL.sky, opt: PhysOpt = {}) => trimeshBody(geom, color, opt),
    /**
     * 매끈한 경사로(캡틴 지적: 상자 이어붙인 바닥은 이음매에서 계단처럼 튄다).
     * path: 바닥 표면 중심선(월드, 위→아래). 폭 width. 한 덩어리 trimesh + FIX_INTERNAL_EDGES라 이음매 튐이 없다.
     * 곡선이면 점을 촘촘히(<= 1.5) 준다. banking: 바깥쪽을 들어올리는 각도(rad, 커브에서 이탈 방지).
     */
    ramp: (path: THREE.Vector3[], width: number, color = PASTEL.peach, opt: PhysOpt & { banking?: number } = {}) => {
      const pos: number[] = [];
      const idx: number[] = [];
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < path.length; i++) {
        const a = path[Math.max(0, i - 1)];
        const b = path[Math.min(path.length - 1, i + 1)];
        const fwd = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
        const side = new THREE.Vector3().crossVectors(fwd, up).normalize(); // 오른쪽
        const lift = Math.tan(opt.banking ?? 0) * (width / 2);
        const l = path[i].clone().addScaledVector(side, -width / 2);
        const r = path[i].clone().addScaledVector(side, width / 2);
        l.y += lift;
        r.y += lift;
        pos.push(l.x, l.y, l.z, r.x, r.y, r.z);
        if (i > 0) {
          const k = i * 2;
          idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return trimeshBody(g, color, opt);
    },
    /**
     * 매끈한 회전체 깔때기(한 덩어리). center = 림 중심(림 높이), 림 반경 rimR → 구멍 반경 holeR, 깊이 depth.
     * 벽 기울기는 atan(depth / (rimR - holeR)) — 30° 이상 되게 고른다. 구멍은 뚫려 있다.
     */
    funnel: (center: THREE.Vector3, rimR: number, holeR: number, depth: number, color = PASTEL.lilac, opt: PhysOpt = {}) => {
      const prof = [new THREE.Vector2(holeR, -depth), new THREE.Vector2(rimR, 0)];
      const steps = 6;
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= steps; i++) pts.push(prof[0].clone().lerp(prof[1], i / steps));
      const g = new THREE.LatheGeometry(pts, 48);
      g.translate(center.x, center.y, center.z);
      return trimeshBody(g, color, { ...opt, opacity: opt.opacity ?? 1 });
    },
    /**
     * 매끈한 가드레일(캡틴: 이음새 겹침 없이). 보이는 벽 = 경로를 따라 한 장으로 이어진 리본 메시 1개(겹침·두 번 칠 없음),
     * 물리 = 구간마다 보이지 않는 cuboid(두께 0.5, 기존과 같은 충돌 동작).
     * path: 벽 아래 가장자리 점들(바닥 표면 높이, 위→아래 순서 무관). 급하게 꺾이는 곳(U턴 등)은 쓰지 말고 기존 box 유지.
     * side: 벽 두께를 경로의 어느 쪽으로 둘지(+1 = 진행 방향 기준 오른쪽 바깥). 리본은 경로 위치에 그린다.
     */
    wallRibbon: (path: THREE.Vector3[], height: number, side: 1 | -1 = 1, color = PASTEL.wall, opt: PhysOpt = {}) => {
      const pos: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i < path.length; i++) {
        const p = path[i];
        pos.push(p.x, p.y, p.z, p.x, p.y + height, p.z);
        if (i > 0) {
          const k = i * 2;
          idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, glassMat(color, opt.opacity ?? 0.35));
      mesh.renderOrder = 2;
      scene.add(mesh);
      // 물리: 세그먼트마다 보이지 않는 상자(바깥쪽으로 두께), 이음매가 비지 않게 양끝 0.25 연장
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const d = new THREE.Vector3().subVectors(b, a);
        const len = d.length();
        if (len < 1e-4) continue;
        const f = d.clone().normalize();
        const out = new THREE.Vector3().crossVectors(f, up).normalize().multiplyScalar(side);
        const c = a.clone().add(b).multiplyScalar(0.5).addScaledVector(out, 0.25).addScaledVector(up, height / 2);
        const m = new THREE.Matrix4().makeBasis(out, up.clone().projectOnPlane(f).normalize(), f);
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(c.x, c.y, c.z).setRotation(q));
        world.createCollider(
          R.ColliderDesc.cuboid(0.25, height / 2, len / 2 + 0.25)
            .setFriction(opt.friction ?? 0.05)
            .setRestitution(opt.restitution ?? 0.5),
          body,
        );
      }
      return mesh;
    },
    /**
     * 둥근 테두리 벽(깔때기 림·접시 테두리). 보이는 벽 = 뚜껑 없는 원통 옆면 1장, 물리 = 보이지 않는 상자 segments개.
     * center = 벽 아래쪽 원 중심, radius = 안쪽 반경.
     */
    rimWall: (center: THREE.Vector3, radius: number, height: number, color = PASTEL.wall, opt: PhysOpt & { segments?: number } = {}) => {
      const g = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true);
      const mesh = new THREE.Mesh(g, glassMat(color, opt.opacity ?? 0.35));
      mesh.position.set(center.x, center.y + height / 2, center.z);
      mesh.renderOrder = 2;
      scene.add(mesh);
      const n = opt.segments ?? Math.max(16, Math.round(radius * 3));
      const half = (Math.PI * (radius + 0.25)) / n + 0.08;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = center.x + Math.cos(a) * (radius + 0.25);
        const z = center.z + Math.sin(a) * (radius + 0.25);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
        const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, center.y + height / 2, z).setRotation(q));
        world.createCollider(
          R.ColliderDesc.cuboid(0.25, height / 2, half).setFriction(opt.friction ?? 0.05).setRestitution(opt.restitution ?? 0.5),
          body,
        );
      }
      return mesh;
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
