// 코스 워커 A: 오리지널 파티 장애물 코스 "파스텔 그랑프리"
// 직선(-Z) 센터라인, 전 구간 7~10° 경사. 원작 맵과 무관한 자체 설계.
// 구간: 출발 언덕(지그재그 범프) → 회전 쓸개 바 x2 → 흔들 시소 x2
//       → 핀볼 범퍼 + 왕복 푸셔 → 갈림길 + 깔때기 → 미니 스피너 → 결승 아치.
import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { BuildCourse, Course } from './types';

const FINISH_Z = -183; // 결승선
const PROG_Z0 = 4; // 진행도 0 기준
const END_Z = -196; // 런아웃 끝
const BACK_Z = 6; // 출발 뒤쪽 끝

// 센터라인 표면 높이 (z, y). z 내림차순. 전 구간 경사 7~10°.
const RAIL: Array<[number, number]> = [
  [6, 42.5],
  [-30, 36.5], // 출발 언덕 끝 (9.5°)
  [-55, 33.2], // 쓸개 바 (7.5°)
  [-80, 29.5], // 시소 (8.4°)
  [-110, 25.0], // 핀볼 (8.5°)
  [-140, 19.6], // 깔때기 (10.2°)
  [-165, 15.9], // 파이널 (8.4°)
  [-186, 12.4], // 결승 주변 (9.5°)
  [-196, 10.7], // 런아웃 (9.6°)
];

function yAt(z: number): number {
  if (z >= RAIL[0][0]) return RAIL[0][1];
  for (let i = 0; i < RAIL.length - 1; i++) {
    const [z0, y0] = RAIL[i];
    const [z1, y1] = RAIL[i + 1];
    if (z <= z0 && z >= z1) {
      const a = (z0 - z) / (z0 - z1);
      return y0 + (y1 - y0) * a;
    }
  }
  return RAIL[RAIL.length - 1][1];
}

const C = {
  start: 0xffe0b8,
  sweeper: 0xffcfe0,
  seesaw: 0xc4e6ff,
  pinball: 0xded2ff,
  funnel: 0xd3f2c4,
  final: 0xfff0a8,
  finish: 0xffe3ec,
  wall: 0xf7f4ff,
  pivot: 0xb8a9ff,
  arm: 0xff7b8f,
  plank: 0x8fe3c0,
  fulcrum: 0xe8b4d0,
  bumper: 0xffd166,
  pusher: 0xff9f5a,
  divider: 0xff9ebb,
  post: 0x7fc8ff,
  lintel: 0xff8fa3,
};

const IDENTITY_Q = new THREE.Quaternion();

interface Driver {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  fn: (t: number) => void;
}

export const buildCourse: BuildCourse = (R, world, scene) => {
  const drivers: Driver[] = [];
  const matCache = new Map<number, THREE.MeshStandardMaterial>();
  const mat = (color: number) => {
    let m = matCache.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.02 });
      matCache.set(color, m);
    }
    return m;
  };

  interface PhysOpt {
    friction?: number;
    restitution?: number;
    cast?: boolean;
    receive?: boolean;
  }

  const finishMesh = (
    mesh: THREE.Mesh,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    color: number,
    opt: PhysOpt = {},
  ) => {
    mesh.position.copy(pos);
    mesh.quaternion.copy(quat);
    mesh.material = mat(color);
    mesh.castShadow = opt.cast ?? false;
    mesh.receiveShadow = opt.receive ?? false;
    scene.add(mesh);
    return mesh;
  };

  const fixedBox = (
    hx: number,
    hy: number,
    hz: number,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    color: number,
    opt: PhysOpt = {},
  ) => {
    const body = world.createRigidBody(
      R.RigidBodyDesc.fixed()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }),
    );
    world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz)
        .setFriction(opt.friction ?? 0.4)
        .setRestitution(opt.restitution ?? 0.2),
      body,
    );
    finishMesh(new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2)), pos, quat, color, {
      cast: opt.cast ?? true,
      receive: opt.receive ?? true,
    });
  };

  const fixedCylinder = (
    halfH: number,
    radius: number,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    color: number,
    opt: PhysOpt = {},
  ) => {
    const body = world.createRigidBody(
      R.RigidBodyDesc.fixed()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }),
    );
    world.createCollider(
      R.ColliderDesc.cylinder(halfH, radius)
        .setFriction(opt.friction ?? 0.4)
        .setRestitution(opt.restitution ?? 0.2),
      body,
    );
    finishMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, halfH * 2, 24)),
      pos,
      quat,
      color,
      { cast: opt.cast ?? true, receive: opt.receive ?? true },
    );
  };

  const fixedCapsule = (
    halfH: number,
    radius: number,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    color: number,
    opt: PhysOpt = {},
  ) => {
    const body = world.createRigidBody(
      R.RigidBodyDesc.fixed()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }),
    );
    world.createCollider(
      R.ColliderDesc.capsule(halfH, radius)
        .setFriction(opt.friction ?? 0.4)
        .setRestitution(opt.restitution ?? 0.2),
      body,
    );
    finishMesh(new THREE.Mesh(new THREE.CapsuleGeometry(radius, halfH * 2, 6, 20)), pos, quat, color, {
      cast: opt.cast ?? true,
      receive: opt.receive ?? true,
    });
  };

  const kinematicBox = (
    hx: number,
    hy: number,
    hz: number,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    color: number,
    opt: PhysOpt = {},
  ): { body: RAPIER.RigidBody; mesh: THREE.Mesh } => {
    const body = world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }),
    );
    world.createCollider(
      R.ColliderDesc.cuboid(hx, hy, hz)
        .setFriction(opt.friction ?? 0.4)
        .setRestitution(opt.restitution ?? 0.2),
      body,
    );
    const mesh = finishMesh(
      new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2)),
      pos,
      quat,
      color,
      { cast: true, receive: true },
    );
    return { body, mesh };
  };

  const slopeQ = (z0: number, z1: number) => {
    const s = Math.atan2(yAt(z0) - yAt(z1), z0 - z1);
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(-s, 0, 0));
  };

  // ── 바닥 한 조각 (표면이 yAt을 따르도록) ──
  const floorPiece = (z0: number, z1: number, w: number, color: number) => {
    const y0 = yAt(z0);
    const y1 = yAt(z1);
    const slope = Math.atan2(y0 - y1, z0 - z1);
    const hyp = Math.hypot(y0 - y1, z0 - z1);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-slope, 0, 0));
    const center = new THREE.Vector3(
      0,
      (y0 + y1) / 2 - 0.25 * Math.cos(slope) - 0.03,
      (z0 + z1) / 2,
    );
    fixedBox(w / 2, 0.25, hyp / 2 + 0.4, center, q, color, {
      friction: 0.5,
      restitution: 0.15,
      cast: false,
      receive: true,
    });
  };

  // ── 직선 측벽 (내면이 ±innerX) ──
  const sideWall = (z0: number, z1: number, innerX: number, extraDown = 0) => {
    const y0 = yAt(z0);
    const y1 = yAt(z1);
    const slope = Math.atan2(y0 - y1, z0 - z1);
    const hyp = Math.hypot(y0 - y1, z0 - z1);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-slope, 0, 0));
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const h = 2.2 + extraDown;
    for (const s of [1, -1]) {
      const surfMid = new THREE.Vector3(s * (innerX + 0.3), (y0 + y1) / 2, (z0 + z1) / 2);
      const center = surfMid.addScaledVector(up, h / 2 - 0.6);
      fixedBox(0.3, h / 2, hyp / 2 + 0.5, center, q, C.wall, {
        friction: 0.05,
        restitution: 0.55,
      });
    }
  };

  // ── 경사진 사선 벽 (깔때기 가이드·폭 전이부). (x0,z0)→(x1,z1) 중심선 ──
  const angledWall = (x0: number, z0: number, x1: number, z1: number, color: number) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const y0 = yAt(z0);
    const y1 = yAt(z1);
    const slope = Math.atan2(y0 - y1, Math.abs(dz));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-slope, yaw, 0, 'YXZ'));
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const h = 2.4;
    const center = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).addScaledVector(
      up,
      h / 2 - 0.6,
    );
    fixedBox(0.25, h / 2, len / 2 + 0.4, center, q, color, {
      friction: 0.05,
      restitution: 0.55,
    });
  };

  // ═══ 바닥 ═══
  floorPiece(BACK_Z, -30, 14, C.start);
  floorPiece(-30, -55, 14, C.sweeper);
  // 시소 구간: 앞·중간·뒤 바닥 + 낙하 대비 캐치 바닥(하류에서 본바닥과 합류)
  floorPiece(-55, -61.75, 10, C.seesaw);
  floorPiece(-67.25, -69.75, 10, C.seesaw);
  floorPiece(-75.25, -80, 10, C.seesaw);
  {
    const cy0 = yAt(-55) - 1.8;
    const cy1 = yAt(-80);
    const slope = Math.atan2(cy0 - cy1, 25);
    const hyp = Math.hypot(cy0 - cy1, 25);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-slope, 0, 0));
    fixedBox(
      6,
      0.25,
      hyp / 2 + 0.4,
      new THREE.Vector3(0, (cy0 + cy1) / 2 - 0.25 * Math.cos(slope) - 0.03, -67.5),
      q,
      C.seesaw,
      { friction: 0.5, restitution: 0.15, cast: false, receive: true },
    );
  }
  floorPiece(-80, -110, 14, C.pinball);
  floorPiece(-110, -140, 14, C.funnel);
  floorPiece(-140, -165, 6, C.final);
  floorPiece(-165, END_Z, 6, C.finish);

  // ═══ 측벽 ═══
  sideWall(BACK_Z, -30, 7);
  sideWall(-30, -55, 6);
  sideWall(-55, -80, 5, 2.2); // 캐치 바닥까지 내려옴
  sideWall(-80, -110, 6);
  sideWall(-110, -140, 7);
  // 폭 전이(내벽이 안으로 들어오는 곳)는 사선 벽으로 부드럽게
  for (const s of [1, -1]) {
    angledWall(s * 7, -27.5, s * 6, -32.5, C.wall); // 7→6
    angledWall(s * 6, -52.5, s * 5, -57.5, C.wall); // 6→5
    angledWall(s * 7, -140, s * 2.5, -144, C.wall); // 깔때기 출구→파이널
  }
  sideWall(-144, -165, 2.5);
  sideWall(-165, END_Z, 2.5);
  // 뒷벽·끝벽
  fixedBox(7.6, 1.8, 0.3, new THREE.Vector3(0, yAt(BACK_Z) + 1.0, BACK_Z + 0.5), IDENTITY_Q, C.wall, {
    friction: 0.05,
    restitution: 0.55,
  });
  fixedBox(3.6, 1.8, 0.3, new THREE.Vector3(0, yAt(END_Z) + 1.0, END_Z - 0.3), IDENTITY_Q, C.wall, {
    friction: 0.05,
    restitution: 0.55,
  });

  // ═══ S0 출발 언덕: 지그재그 반원 범프 (좌우로 갈라지게) ═══
  const humpQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  const addHump = (x0: number, x1: number, z: number) => {
    const len = Math.abs(x1 - x0);
    fixedCylinder(
      len / 2,
      0.5,
      new THREE.Vector3((x0 + x1) / 2, yAt(z) + 0.05, z),
      humpQ,
      C.bumper,
      { friction: 0.5, restitution: 0.25 },
    );
  };
  addHump(-6, 0.8, -10);
  addHump(-0.8, 6, -16);
  addHump(-6, 0.8, -22);

  // ═══ 출발 게이트 아치 ═══
  const addArch = (z: number, halfW: number) => {
    const y = yAt(z);
    for (const s of [1, -1]) {
      fixedCylinder(2.0, 0.4, new THREE.Vector3(s * halfW, y + 2.0, z), IDENTITY_Q, C.post, {});
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.8, 0.8, 0.8), mat(C.lintel));
    lintel.position.set(0, y + 4.2, z);
    lintel.castShadow = true;
    scene.add(lintel);
  };
  addArch(-2, 6.2);

  // ═══ S1 회전 쓸개 바 x2 ═══
  const addSweeper = (
    z: number,
    dir: 1 | -1,
    phase: number,
    omega: number,
    armLen: number,
    pivotR: number,
  ) => {
    const y = yAt(z);
    fixedCylinder(0.45, pivotR, new THREE.Vector3(0, y + 0.45, z), IDENTITY_Q, C.pivot, {
      friction: 0.3,
      restitution: 0.4,
    });
    const { body, mesh } = kinematicBox(
      armLen / 2,
      0.35,
      0.35,
      new THREE.Vector3(0, y + 1.3, z),
      IDENTITY_Q,
      C.arm,
      { friction: 0.3, restitution: 0.4 },
    );
    drivers.push({
      body,
      mesh,
      fn: (t: number) => {
        const a = dir * omega * t + phase;
        const q = new THREE.Quaternion(0, Math.sin(a / 2), 0, Math.cos(a / 2));
        body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        mesh.quaternion.copy(q);
      },
    });
  };
  addSweeper(-38.5, 1, 0, 0.85, 9, 1.0);
  addSweeper(-48.5, -1, Math.PI / 2, 0.85, 9, 1.0);

  // ═══ S2 흔들 시소 x2 (위상 엇갈림) ═══
  const catchY = (z: number) => {
    const cy0 = yAt(-55) - 1.8;
    const cy1 = yAt(-80);
    return cy0 + (cy1 - cy0) * ((-55 - z) / 25);
  };
  const addSeesaw = (z: number, phase: number) => {
    const y = yAt(z);
    const slope = Math.atan2(yAt(z + 2.5) - yAt(z - 2.5), 5);
    const base = new THREE.Quaternion().setFromEuler(new THREE.Euler(-slope, 0, 0));
    const { body, mesh } = kinematicBox(
      4.7,
      0.2,
      2.5,
      new THREE.Vector3(0, y - 0.2, z),
      base,
      C.plank,
      { friction: 0.6, restitution: 0.1 },
    );
    drivers.push({
      body,
      mesh,
      fn: (t: number) => {
        const phi = THREE.MathUtils.degToRad(7) * Math.sin(t * 1.15 + phase);
        const q = base
          .clone()
          .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(phi, 0, 0)));
        body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        mesh.quaternion.copy(q);
      },
    });
    // 받침 기둥 (캐치 바닥→플랭크 바로 아래)
    const top = y - 0.25;
    const bot = catchY(z) - 0.3;
    fixedBox(0.6, (top - bot) / 2, 0.5, new THREE.Vector3(0, (top + bot) / 2, z), IDENTITY_Q, C.fulcrum, {});
  };
  addSeesaw(-64.5, 0);
  addSeesaw(-72.5, Math.PI);

  // ═══ S3 핀볼 범퍼 + 왕복 푸셔 ═══
  const addBumper = (x: number, z: number, r = 0.55) => {
    fixedCylinder(1.0, r, new THREE.Vector3(x, yAt(z) + 1.0, z), IDENTITY_Q, C.bumper, {
      friction: 0.1,
      restitution: 0.9,
    });
  };
  addBumper(-3, -88);
  addBumper(3, -93.5);
  addBumper(0, -99);
  addBumper(-3, -107);
  addBumper(3.5, -108);
  {
    const z = -103;
    const y = yAt(z);
    const { body, mesh } = kinematicBox(
      4.5,
      0.5,
      0.6,
      new THREE.Vector3(0, y + 0.65, z),
      IDENTITY_Q,
      C.pusher,
      { friction: 0.2, restitution: 0.7 },
    );
    drivers.push({
      body,
      mesh,
      fn: (t: number) => {
        const x = 1.5 * Math.sin((t * 2 * Math.PI) / 4.2);
        body.setNextKinematicTranslation({ x, y: y + 0.65, z });
        mesh.position.set(x, y + 0.65, z);
      },
    });
  }

  // ═══ S4 갈림길 + 깔때기 ═══
  {
    // 중앙 분할 캡슐 (경사 따라 기울임)
    const zc = -118;
    const slope = Math.atan2(yAt(zc + 4) - yAt(zc - 4), 8);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-(Math.PI / 2 + slope), 0, 0));
    fixedCapsule(4.0, 0.9, new THREE.Vector3(0, yAt(zc) + 0.9, zc), q, C.divider, {
      friction: 0.2,
      restitution: 0.5,
    });
    // 좌 채널 범프 2개 / 우 채널 범퍼 1개 ( 비대칭 운 요소)
    addHump(-6, -2.5, -126);
    addHump(-6, -2.5, -131);
    addBumper(4.2, -128.5, 0.5);
    // 깔때기 가이드 벽
    for (const s of [1, -1]) {
      angledWall(s * 6.4, -112, s * 2.5, -138, C.lintel);
      // 가이드 끝 흘리기 범퍼
      fixedCylinder(0.9, 0.45, new THREE.Vector3(s * 2.5, yAt(-138.6) + 0.9, -138.6), IDENTITY_Q, C.bumper, {
        friction: 0.1,
        restitution: 0.5,
      });
    }
  }

  // ═══ S5 파이널 미니 스피너 (막판 뒤집기) ═══
  addSweeper(-152, 1, Math.PI, 1.4, 3.6, 0.7);
  addHump(-2, 2, -146);
  addHump(-2, 2, -158);

  // ═══ 결승 아치 + 체커 스트립 ═══
  addArch(FINISH_Z, 2.0);
  {
    const z0 = FINISH_Z + 1;
    const z1 = FINISH_Z - 1;
    const q = slopeQ(z0, z1);
    for (let r = 0; r < 2; r++) {
      for (let cix = 0; cix < 8; cix++) {
        const x = -2.1875 + cix * 0.625;
        const z = z0 - (r + 0.5) * ((z0 - z1) / 2);
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, (z0 - z1) / 2 - 0.02), mat((r + cix) % 2 === 0 ? 0x222831 : 0xffffff));
        m.position.set(x, yAt(z) + 0.03, z);
        m.quaternion.copy(q);
        m.receiveShadow = true;
        scene.add(m);
      }
    }
  }

  // ═══ 계약 이행 ═══
  const spawnPoints: THREE.Vector3[] = [];
  const cols = [-4.4, -2.2, 0, 2.2, 4.4];
  const rows = [3, 1.6, 0.2, -1.2];
  for (const z of rows) {
    for (const x of cols) {
      spawnPoints.push(new THREE.Vector3(x, yAt(z) + 1.6, z));
    }
  }

  const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);
  const progressOf = (p: THREE.Vector3) => clamp01((PROG_Z0 - p.z) / (PROG_Z0 - FINISH_Z));

  const course: Course = {
    spawnPoints,
    progressOf,
    isFinished: (p) => p.z < FINISH_Z,
    isOut: (p) => p.y < yAt(THREE.MathUtils.clamp(p.z, END_Z, BACK_Z)) - 12,
    respawnPoint: (pr) => {
      const c = clamp01(pr);
      const z = PROG_Z0 + (FINISH_Z - PROG_Z0) * c;
      return new THREE.Vector3(0, yAt(z) + 3.0, z);
    },
    update: (t: number) => {
      for (const d of drivers) d.fn(t);
    },
    hotspots: [
      {
        name: 'start-hill',
        center: new THREE.Vector3(0, yAt(-12) + 1, -12),
        radius: 16,
        shot: {
          name: 'start-hill',
          position: new THREE.Vector3(16, yAt(-12) + 10, 2),
          target: new THREE.Vector3(0, yAt(-12) + 1, -12),
        },
      },
      {
        name: 'sweeper',
        center: new THREE.Vector3(0, yAt(-43.5) + 1, -43.5),
        radius: 14,
        shot: {
          name: 'sweeper',
          position: new THREE.Vector3(17, yAt(-43.5) + 11, -43.5),
          target: new THREE.Vector3(0, yAt(-43.5) + 1, -43.5),
        },
      },
      {
        name: 'seesaw',
        center: new THREE.Vector3(0, yAt(-67.5) + 1, -67.5),
        radius: 14,
        shot: {
          name: 'seesaw',
          position: new THREE.Vector3(-17, yAt(-67.5) + 11, -67.5),
          target: new THREE.Vector3(0, yAt(-67.5) + 1, -67.5),
        },
      },
      {
        name: 'pinball',
        center: new THREE.Vector3(0, yAt(-95) + 1, -95),
        radius: 16,
        shot: {
          name: 'pinball',
          position: new THREE.Vector3(18, yAt(-95) + 12, -95),
          target: new THREE.Vector3(0, yAt(-95) + 1, -95),
        },
      },
      {
        name: 'funnel',
        center: new THREE.Vector3(0, yAt(-125) + 1, -125),
        radius: 16,
        shot: {
          name: 'funnel',
          position: new THREE.Vector3(-19, yAt(-125) + 13, -125),
          target: new THREE.Vector3(0, yAt(-125) + 1, -125),
        },
      },
      {
        name: 'finish',
        center: new THREE.Vector3(0, yAt(FINISH_Z) + 1, FINISH_Z),
        radius: 10,
        shot: {
          name: 'finish',
          position: new THREE.Vector3(14, yAt(-170) + 9, -170),
          target: new THREE.Vector3(0, yAt(FINISH_Z) + 1, FINISH_Z),
        },
      },
    ],
    overviewShot: {
      name: 'overview',
      position: new THREE.Vector3(72, 80, 48),
      target: new THREE.Vector3(0, 16, -92),
    },
  };
  return course;
};
