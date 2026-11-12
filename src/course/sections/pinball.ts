// 구간 pinball(order 70): 넓은 경사판 2단 핀볼. 위 판(A)은 +z로, 아래 판(B)은 -z로 내려와 출구가 입구 xz 근처로 돌아온다.
// 범퍼 기둥·삼각 범퍼·핀 격자·회전 막대. B판의 '행운 구멍' 3개는 아래 결승 깔때기(반경 15.5)로 바로 낙하(낙하 역전).
import * as THREE from 'three';
import type { SectionDef } from '../../types';
import { makeKit, mat, PASTEL } from '../kit';

const TH = (18 * Math.PI) / 180;
const C = Math.cos(TH);
const S = Math.sin(TH);
const W = 12.5; // 판 반폭

interface Board {
  O: THREE.Vector3;
  dir: 1 | -1;
  q: THREE.Quaternion;
  xv: THREE.Vector3;
  N: THREE.Vector3;
  Sv: THREE.Vector3;
}
function makeBoard(O: THREE.Vector3, dir: 1 | -1): Board {
  const xv = new THREE.Vector3(dir, 0, 0);
  const N = new THREE.Vector3(0, C, dir * S);
  const Sv = new THREE.Vector3(0, -S, dir * C);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xv, N, Sv));
  return { O, dir, q, xv, N, Sv };
}
/** 판 좌표 (u: 가로, s: 경사 방향 길이, n: 판 법선 방향 높이) → 월드 */
const at = (b: Board, u: number, s: number, n: number) =>
  b.O.clone().addScaledVector(b.xv, u).addScaledVector(b.Sv, s).addScaledVector(b.N, n);

interface Hole {
  u: number;
  s: number;
  w: number;
  l: number;
}

function densify(pts: THREE.Vector3[], maxGap = 1.8): THREE.Vector3[] {
  const out: THREE.Vector3[] = [pts[0].clone()];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / maxGap));
    for (let k = 1; k <= n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
}

export const section: SectionDef = {
  name: 'pinball',
  order: 70,
  build(ctx) {
    const { R, world, scene, entry } = ctx;
    const kit = makeKit(ctx);
    const { x: ex, y: ey, z: ez } = entry;
    const UP = new THREE.Vector3(0, 1, 0);
    /** 직선 벽 리본(보이는 면 1장 + 보이지 않는 물리 상자). inside = 벽의 안쪽(구슬이 있는 쪽) 기준점 */
    const wall = (path: THREE.Vector3[], height: number, inside: THREE.Vector3) => {
      const f = path[1].clone().sub(path[0]).normalize();
      const mid = path[0].clone().add(path[path.length - 1]).multiplyScalar(0.5);
      const side = new THREE.Vector3().crossVectors(f, UP).dot(mid.sub(inside)) > 0 ? 1 : -1;
      kit.wallRibbon(path, height, side, PASTEL.wall, { opacity: 0.35 });
    };

    const A = makeBoard(new THREE.Vector3(ex, ey - 1, ez - 9), 1);
    const LA = 29;
    const GAP = 3;
    const yB = ey - 13.5;
    const B = makeBoard(new THREE.Vector3(ex, yB, ez + 25.5), -1);
    const LB = 26.5;

    // ── 바닥(구멍 지원) ──
    // 구멍이 있는 바닥은 조각 상자를 잇지 않고 한 덩어리 trimesh로 만든다(이음매 튐 방지).
    // 조각 상자는 표면 0.1 아래에 보이지 않게 깔아 터널링만 막는다.
    function floor(b: Board, L: number, holes: Hole[], color: number) {
      const edges = new Set<number>([0, L]);
      for (const h of holes) {
        edges.add(h.s - h.l / 2);
        edges.add(h.s + h.l / 2);
      }
      const es = [...edges].sort((p, q) => p - q);
      const smooth = holes.length > 0;
      const pos: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i < es.length - 1; i++) {
        const s0 = es[i];
        const s1 = es[i + 1];
        const hs = holes
          .filter((h) => h.s - h.l / 2 < s1 - 1e-6 && h.s + h.l / 2 > s0 + 1e-6)
          .sort((p, q) => p.u - q.u);
        const piece = (u0: number, u1: number) => {
          if (u1 - u0 < 0.05) return;
          if (!smooth) {
            kit.box((u1 - u0) / 2, 0.35, (s1 - s0) / 2, at(b, (u0 + u1) / 2, (s0 + s1) / 2, -0.35), b.q, color, {
              friction: 0.35,
              restitution: 0.2,
            });
            return;
          }
          kit.box((u1 - u0) / 2, 0.35, (s1 - s0) / 2, at(b, (u0 + u1) / 2, (s0 + s1) / 2, -0.45), b.q, color, {
            friction: 0.35,
            restitution: 0.2,
            invisible: true,
          });
          const k = pos.length / 3;
          for (const [u, ss] of [[u0, s0], [u1, s0], [u0, s1], [u1, s1]]) {
            const p = at(b, u, ss, 0);
            pos.push(p.x, p.y, p.z);
          }
          idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        };
        let cur = -W;
        for (const h of hs) {
          piece(cur, h.u - h.w / 2);
          cur = h.u + h.w / 2;
        }
        piece(cur, W);
      }
      if (smooth) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        kit.trimesh(g, color, { friction: 0.35, restitution: 0.2, cast: false, receive: true });
      }
    }
    function walls(b: Board, L: number) {
      const c = at(b, 0, L / 2, 0);
      for (const sgn of [-1, 1]) wall([at(b, sgn * W, -0.5, 0), at(b, sgn * W, L, 0)], 2.6, c);
      wall([at(b, -W - 0.5, 0, 0), at(b, W + 0.5, 0, 0)], 2.6, c);
    }

    // 행운 구멍(B판) — 진행 방향으로 길쭉하게 내어 구멍 먼 쪽 모서리에 튕겨 나가지 않고 곧장 떨어지게 한다
    const holes: Hole[] = [
      { u: -3.5, s: 19.5, w: 2.8, l: 4.2 },
      { u: 3.5, s: 23.5, w: 2.8, l: 4.2 },
    ];

    floor(A, LA, [], PASTEL.sky);
    walls(A, LA + GAP);
    floor(B, LB, holes, PASTEL.mint);
    walls(B, LB + GAP);

    // 구멍 테두리(장식): 금색 사각 링
    // 구멍 테두리(장식): 금색 사각 띠 4개
    const ringQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(B.xv, B.Sv.clone().negate(), B.N));
    for (const h of holes) {
      const bars: [number, number, number, number][] = [
        [h.u, h.s - h.l / 2 - 0.25, h.w + 1, 0.5],
        [h.u, h.s + h.l / 2 + 0.25, h.w + 1, 0.5],
        [h.u - h.w / 2 - 0.25, h.s, 0.5, h.l],
        [h.u + h.w / 2 + 0.25, h.s, 0.5, h.l],
      ];
      for (const [bu, bs, bw, bl] of bars) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bl), mat(PASTEL.yellow));
        m.position.copy(at(B, bu, bs, 0.04));
        m.quaternion.copy(ringQ);
        m.receiveShadow = true;
        scene.add(m);
      }
    }

    // 끝단 스커트(수직 벽): 갭에서 떨어지는 구슬의 수평 속도를 흡수
    const exitS = LB + GAP / 2;
    const exitSurf = at(B, 0, LB, 0);
    const exit = new THREE.Vector3(ex, exitSurf.y - 1.0, at(B, 0, exitS, 0).z);
    {
      const zA = at(A, 0, LA + GAP + 0.25, 0).z;
      const topA = at(A, 0, LA + GAP, 2.5).y;
      const botA = at(B, 0, B.dir === -1 ? (B.O.z - zA) / C : 0, 0).y + 2.0;
      const cA = at(A, 0, 10, 0);
      wall([new THREE.Vector3(ex - W - 0.5, botA, zA - 0.25), new THREE.Vector3(ex + W + 0.5, botA, zA - 0.25)], topA - botA, cA);
      const zB = at(B, 0, LB + GAP + 0.25, 0).z;
      const topB = at(B, 0, LB + GAP, 2.5).y;
      const botB = exit.y + 1.0;
      const cB = at(B, 0, 10, 0);
      wall([new THREE.Vector3(ex - W - 0.5, botB, zB + 0.25), new THREE.Vector3(ex + W + 0.5, botB, zB + 0.25)], topB - botB, cB);
    }

    // B판 V자 가이드: 가장자리(u=±12, s=8) → (±6.3, s=23)
    for (const sgn of [-1, 1]) wall([at(B, sgn * 12.9, 7, 0), at(B, sgn * 6.3, 23, 0)], 2.3, at(B, 0, 15, 0));

    // ── 장애물 ──
    // 범퍼·핀은 마찰 0(Min 결합): 구슬이 기둥 정면에 걸려 매달리는 현상을 막는다
    function post(b: Board, u: number, s: number, halfH: number, r: number, color: number, rest: number) {
      const pos = at(b, u, s, halfH);
      const body = world.createRigidBody(
        R.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: b.q.x, y: b.q.y, z: b.q.z, w: b.q.w }),
      );
      world.createCollider(
        R.ColliderDesc.cylinder(halfH, r)
          .setFriction(0)
          .setFrictionCombineRule(R.CoefficientCombineRule.Min)
          .setRestitution(rest)
          .setRestitutionCombineRule(R.CoefficientCombineRule.Max),
        body,
      );
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, halfH * 2, 28), mat(color));
      m.position.copy(pos);
      m.quaternion.copy(b.q);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
    const bumper = (b: Board, u: number, s: number, r: number, color: number) => post(b, u, s, 1.0, r, color, 0.7);
    const pin = (b: Board, u: number, s: number) => post(b, u, s, 0.9, 0.3, PASTEL.violet, 0.6);
    function triBumper(b: Board, u: number, s: number, r: number, color: number) {
      const h = 0.9;
      const pts: number[] = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI; // 꼭짓점이 위(상류)를 향한다 — 평평한 면이 상류를 막으면 구슬이 눌려 정지한다
        for (const y of [-h, h]) pts.push(r * Math.sin(a), y, r * Math.cos(a));
      }
      const pos = at(b, u, s, h);
      const body = world.createRigidBody(
        R.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: b.q.x, y: b.q.y, z: b.q.z, w: b.q.w }),
      );
      const desc = R.ColliderDesc.convexHull(new Float32Array(pts));
      if (desc) world.createCollider(desc.setRestitution(0.8).setFriction(0).setFrictionCombineRule(R.CoefficientCombineRule.Min), body);
      else world.createCollider(R.ColliderDesc.cylinder(h, r * 0.7).setRestitution(1.0), body);
      const geo = new THREE.CylinderGeometry(r, r, h * 2, 3);
      geo.rotateY(Math.PI);
      const m = new THREE.Mesh(geo, mat(color));
      m.position.copy(pos);
      m.quaternion.copy(b.q);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }

    // A판
    bumper(A, -7, 13, 1.3, PASTEL.coral);
    bumper(A, 7, 13, 1.3, PASTEL.coral);
    triBumper(A, -8.5, 19, 1.6, PASTEL.pink);
    triBumper(A, 8.5, 19, 1.6, PASTEL.pink);
    for (const [row, s] of [23.5, 25.7].entries()) {
      for (let u = -10 + (row % 2) * 1.25; u <= 10.1; u += 2.5) pin(A, u, s);
    }
    // 회전 막대(운 요소): A판 중앙
    const spinC = at(A, 0, 18, 0);
    post(A, 0, 18, 0.9, 0.5, PASTEL.yellow, 0.4);
    const bar = kit.kinBox(4.5, 0.8, 0.35, at(A, 0, 18, 0.8), A.q, PASTEL.coral, { restitution: 0.7 });
    // B판
    triBumper(B, 0, 11.5, 1.4, PASTEL.pink);
    pin(B, -4.5, 15.5);
    pin(B, 4.5, 15.5);
    pin(B, 0, 17);

    // 좌우로 미끄러지는 범퍼(운 요소 + 정면에 걸려 매달리는 것 방지)
    const sliders = [
      { b: A, u0: 0, s: 15.5, amp: 3.2, w: 0.8, ph: 0, r: 1.5, color: PASTEL.orange },
      { b: B, u0: -4.8, s: 9, amp: 2.2, w: 0.9, ph: 0.8, r: 1.2, color: PASTEL.coral },
      { b: B, u0: 4.8, s: 9, amp: 2.2, w: 0.9, ph: 3.9, r: 1.2, color: PASTEL.coral },
    ].map((d) => ({ d, k: kit.kinCylinder(1.0, d.r, at(d.b, d.u0, d.s, 1.0), d.b.q, d.color, { restitution: 0.3, friction: 0.05 }) }));

    // ── 중심선 ──
    const sPts: THREE.Vector3[] = [entry.clone()];
    for (let s = 9.3; s <= LA; s += 1.5) sPts.push(at(A, 0, s, 0.6));
    sPts.push(at(A, 0, LA, 0.6));
    sPts.push(at(B, 0, 5, 0.6));
    for (let s = 5; s <= LB; s += 1.5) sPts.push(at(B, 0, s, 0.6));
    sPts.push(at(B, 0, LB, 0.6));
    sPts.push(exit.clone());
    const centerline = densify(sPts);

    const aMid = at(A, 0, 16, 2);
    const bMid = at(B, 0, 15, 2);
    const hotspots = [
      {
        name: 'pinball-top',
        center: aMid,
        radius: 15,
        shot: { name: 'pinball-top', position: aMid.clone().add(new THREE.Vector3(38, 7, 0)), target: aMid.clone() },
      },
      {
        name: 'pinball-low',
        center: bMid,
        radius: 15,
        shot: { name: 'pinball-low', position: bMid.clone().add(new THREE.Vector3(-38, 6, 0)), target: bMid.clone() },
      },
    ];

    const qs = new THREE.Quaternion();
    const qy = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const barPos = at(A, 0, 18, 0.8);
    void spinC;
    return {
      exit,
      centerline,
      hotspots,
      update(t) {
        qy.setFromAxisAngle(yAxis, 1.4 * t + 0.6 * Math.sin(0.8 * t));
        qs.copy(A.q).multiply(qy);
        kit.drive(bar.body, bar.mesh, barPos, qs);
        for (const { d, k } of sliders) kit.drive(k.body, k.mesh, at(d.b, d.u0 + d.amp * Math.sin(d.w * t + d.ph), d.s, 1.0), null);
      },
    };
  },
};
