// 조립기(PM 소유): sections/*.ts를 order 순으로 이어 붙여 Course를 만든다.
import * as THREE from 'three';
import { DROP_GAP, TOWER_TOP, type Course, type Rapier, type SectionBuilt, type SectionDef, type World } from '../types';

const FINISH_RADIUS = 13;
/** 결승 판정 원기둥 반경: 마지막 출구 아래로 떨어지는 구슬이 이 안을 지나면 완주(접시에서 튕겨 나가도 인정) */
const FINISH_CATCH = 16;

// import.meta.glob은 registry.ts에 둔다(헤드리스 시뮬레이터가 node에서 이 파일을 쓰기 때문).

/** only: 이름 목록을 주면 그 구간만(순서는 order 기준) 이어 붙인다 — 단독 시험용 */
export function assembleFrom(
  defs: SectionDef[],
  R: Rapier,
  world: World,
  scene: THREE.Scene,
  only?: string[],
): Course {
  defs = [...defs].sort((a, b) => a.order - b.order);
  const list = only?.length ? defs.filter((d) => only.includes(d.name)) : defs;
  if (!list.length) throw new Error(`구간 없음: ${only?.join(',')}`);

  // 탑 구조: 위에서 아래로 쌓는다. 다음 구간 입구 = 이전 출구 바로 아래 DROP_GAP.
  let entry = new THREE.Vector3(0, TOWER_TOP, 0);
  const built: { def: SectionDef; b: SectionBuilt }[] = [];
  for (const def of list) {
    const b = def.build({ R, world, scene, entry: entry.clone() });
    built.push({ def, b });
    entry = b.exit.clone().add(new THREE.Vector3(0, -DROP_GAP, 0));
  }

  // 결승 접시: 마지막 출구 아래 DROP_GAP 지점의 둥근 받침(바닥 + 낮은 테두리)
  const end = built[built.length - 1].b.exit.clone();
  const pad = end.clone().add(new THREE.Vector3(0, -DROP_GAP, 0));
  {
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff1a8 });
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(pad.x, pad.y - 0.5, pad.z));
    world.createCollider(R.ColliderDesc.cylinder(0.5, FINISH_RADIUS).setFriction(0.9).setRestitution(0.1), body);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(FINISH_RADIUS, FINISH_RADIUS, 1, 48), mat);
    m.position.set(pad.x, pad.y - 0.5, pad.z);
    m.receiveShadow = true;
    scene.add(m);
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = pad.x + Math.cos(a) * (FINISH_RADIUS + 0.25);
      const z = pad.z + Math.sin(a) * (FINISH_RADIUS + 0.25);
      const rb = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, pad.y + 1.25, z).setRotation(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a),
      ));
      const half = (Math.PI * (FINISH_RADIUS + 0.25)) / n + 0.05;
      world.createCollider(R.ColliderDesc.cuboid(0.25, 1.25, half), rb);
      const wm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.5, half * 2), new THREE.MeshStandardMaterial({ color: 0xff9ec4, transparent: true, opacity: 0.4 }));
      wm.position.set(x, pad.y + 1.25, z);
      wm.rotation.y = -a;
      scene.add(wm);
    }
  }

  // 중심선 연결 + 누적 길이
  const pts: THREE.Vector3[] = [];
  const sectionStartIdx: number[] = [];
  for (const { b } of built) {
    sectionStartIdx.push(pts.length);
    for (const p of b.centerline) pts.push(p.clone());
  }
  pts.push(pad.clone().add(new THREE.Vector3(0, 0.6, 0))); // 결승 = 접시 착지
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = cum[cum.length - 1];

  // 갈래 경로: 각 점에 본선 누적거리 s를 매핑해 둔다(루트 내 길이 비율 → 구간 [from,to] 선형)
  type Line = { p: THREE.Vector3[]; s: number[] };
  const lines: Line[] = [{ p: pts, s: cum }];
  built.forEach(({ b }, k) => {
    if (!b.routes?.length) return;
    const i0 = sectionStartIdx[k];
    const i1 = i0 + b.centerline.length - 1;
    const secS0 = cum[i0];
    const secLen = cum[i1] - secS0;
    for (const r of b.routes) {
      if (r.points.length < 2) continue;
      const rc = [0];
      for (let i = 1; i < r.points.length; i++) rc.push(rc[i - 1] + r.points[i].distanceTo(r.points[i - 1]));
      const rl = rc[rc.length - 1] || 1;
      const a = secS0 + r.fromFrac * secLen;
      const z = secS0 + r.toFrac * secLen;
      lines.push({ p: r.points.map((q) => q.clone()), s: rc.map((v) => a + (v / rl) * (z - a)) });
    }
  });

  let minY = Infinity;
  for (const l of lines) for (const p of l.p) minY = Math.min(minY, p.y);

  const seg = new THREE.Vector3();
  const rel = new THREE.Vector3();
  const proj = new THREE.Vector3();
  function nearest(p: THREE.Vector3): { s: number; d: number } {
    let best = { s: 0, d: Infinity };
    for (const l of lines) {
      const P = l.p;
      for (let i = 0; i < P.length - 1; i++) {
        seg.subVectors(P[i + 1], P[i]);
        const L2 = seg.lengthSq() || 1e-9;
        const u = THREE.MathUtils.clamp(rel.subVectors(p, P[i]).dot(seg) / L2, 0, 1);
        proj.copy(P[i]).addScaledVector(seg, u);
        const d = proj.distanceTo(p);
        if (d < best.d) best = { s: l.s[i] + u * (l.s[i + 1] - l.s[i]), d };
      }
    }
    return best;
  }
  function pointAt(s: number): THREE.Vector3 {
    s = THREE.MathUtils.clamp(s, 0, total);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const u = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return pts[i - 1].clone().lerp(pts[i], u);
  }

  const checkpoints = sectionStartIdx.map((i) => cum[i] / total);
  checkpoints[0] = 0;

  const first = built[0].b;
  const e0 = list.length ? built[0].b.centerline[0] : new THREE.Vector3();
  const spawnPoints =
    first.spawnPoints ??
    Array.from({ length: 40 }, (_, i) =>
      new THREE.Vector3(e0.x + ((i % 5) - 2) * 1.6, e0.y + 1.5 + Math.floor(i / 5) * 1.2, e0.z - 1.5 - (Math.floor(i / 5) % 2) * 1.2),
    );

  const box = new THREE.Box3().setFromPoints(pts);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z);

  const updaters = built.map((x) => x.b.update).filter((f): f is NonNullable<typeof f> => !!f);

  return {
    spawnPoints,
    progressOf: (p) => THREE.MathUtils.clamp(nearest(p).s / total, 0, 1),
    // 결승 = 마지막 출구 높이 아래 2.5 지점을 결승 원기둥 안에서 지남(접시 착지 전에 판정 → 튕겨 나가도 완주)
    isFinished: (p) => p.y < end.y - 2.5 && Math.hypot(p.x - pad.x, p.z - pad.z) < FINISH_CATCH,
    isOut: (p) => p.y < pad.y - 10 || nearest(p).d > 30,
    respawnPoint: (pr) => pointAt(pr * total + 1.5).add(new THREE.Vector3(0, 1.2, 0)),
    checkpoints,
    update: (t, dt) => {
      for (const f of updaters) f(t, dt);
    },
    hotspots: built.flatMap((x) => x.b.hotspots),
    overviewShot: {
      name: 'overview',
      position: c.clone().add(new THREE.Vector3(r * 0.7, r * 0.45, r * 0.25)),
      target: c,
    },
  };
}
