// 구간 'channel' — 직각 단면 홈통이 지그재그(스위치백)로 탑을 감아 내려간다.
// 입구 경사판(깔때기) → 1단(+x) → U턴 → 2단(-x, 함정문) → U턴 → 3단(+x) → 원뿔 배수구(출구 구멍).
// 운 요소: 1단의 회전 쓸개 바(옆 틈으로 밀려나면 2단 직행 슬라이드), 2단의 주기 함정문(열리면 3단 직행 슬라이드).
import * as THREE from 'three';
import type { Hotspot, SectionDef } from '../../types';
import { PASTEL, glassMat, makeKit } from '../kit';

type V3 = THREE.Vector3;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;

const HW = 2.2; // 채널 반폭
const WALL_HT = 0.25; // 벽 반두께
const FLOOR_HT = 0.35; // 바닥 반두께(두께 0.7)
const WALL_UP = 1.8; // 바닥 위 벽 높이
const TH_STRAIGHT = 24 * D2R;
const TH_TURN = 26 * D2R;
const WALL = { opacity: 0.35, cast: false, friction: 0.0 };
const WALL_PHYS = { opacity: 0.35, friction: 0.0, restitution: 0.25 };
const FLOOR = { friction: 0.0 };
// 바닥은 매끈한 한 덩어리 trimesh(strip/patch/funnel) + 아래 0.12~0.25에 보이지 않는 cuboid 받침(터널링 방지)
const BACK = { friction: 0.0, invisible: true };
const BACK_DROP = 0.18;

const TIER_DZ = 7.2; // 단 간격(z)
const TURN_R = TIER_DZ / 2;
const X_RIGHT = 14; // 1단 끝 / 1번 U턴 x(입구 기준)
const X_LEFT = 2; // 2단 끝 / 2번 U턴 x
const X_RIM = 6.5; // 3단 끝(원뿔 테두리) x

interface Frame {
  T: V3;
  N: V3;
  W: V3;
  q: THREE.Quaternion;
}
/** 수평 진행방향(dx,dz 단위)과 내리막 pitch로 이루어진 국소 좌표계. T=진행(내리막), N=바닥 법선, W=가로 */
function makeFrame(dx: number, dz: number, pitch: number): Frame {
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const T = V(dx * c, -s, dz * c);
  const W = V(-dz, 0, dx);
  const N = new THREE.Vector3().crossVectors(W, T);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, N, W));
  return { T, N, W, q };
}

function resample(pts: V3[], step = 1.8): V3[] {
  const out = [pts[0].clone()];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let k = 1; k <= n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
}

/** x가 단조인 단 점열에서 x 위치의 바닥 높이 */
function yAt(pts: V3[], x: number): number {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((x - a.x) * (x - b.x) <= 0) {
      const u = (x - a.x) / (b.x - a.x || 1e-9);
      return a.y + (b.y - a.y) * u;
    }
  }
  return pts[pts.length - 1].y;
}

export const section: SectionDef = {
  name: 'channel',
  order: 10,
  build(ctx) {
    const kit = makeKit(ctx);
    const E = ctx.entry;

    // 상자 벽을 남기는 곳(U턴·함정문 등)은 겹침 깜빡임을 줄이는 glassMat 재질로
    const glassify = <T extends { mesh: THREE.Mesh | null }>(r: T, opt: { opacity?: number }): T => {
      if (r.mesh && opt.opacity !== undefined && opt.opacity < 1) {
        r.mesh.material = glassMat(PASTEL.wall, opt.opacity);
        r.mesh.renderOrder = 2;
      }
      return r;
    };
    const fbox = (
      o: V3,
      f: Frame,
      l: [number, number, number],
      h: [number, number, number],
      color: number,
      opt = {},
      yaw = 0,
    ) => {
      const pos = o.clone().addScaledVector(f.T, l[0]).addScaledVector(f.N, l[1]).addScaledVector(f.W, l[2]);
      const q = yaw ? f.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw)) : f.q;
      return glassify(kit.box(h[0], h[1], h[2], pos, q, color, opt), opt);
    };

    // ───────── 입구 경사판(깔때기) ─────────
    const PLATE_TH = 15 * D2R;
    const PLATE_H = 15; // 수평 길이
    const O = V(E.x - 7.5, E.y - 1.8, E.z);
    const pf = makeFrame(1, 0, PLATE_TH);
    const Lp = PLATE_H / Math.cos(PLATE_TH);
    const L1 = 10 / Math.cos(PLATE_TH);
    fbox(O, pf, [Lp / 2, -FLOOR_HT - BACK_DROP, 0], [Lp / 2 + 0.1, FLOOR_HT, 7.5], PASTEL.pink, BACK);
    // 입구판 벽: 매끈한 리본(뒷벽·옆벽·수렴 벽). 경로 = 벽 안쪽 면의 바닥 표면 점
    {
      const sy = (x: number) => O.y - (x - O.x) * Math.tan(PLATE_TH);
      const X0 = O.x;
      const X1 = O.x + 10;
      const X2 = O.x + PLATE_H;
      kit.wallRibbon([V(X0, sy(X0), O.z + 7.5), V(X0, sy(X0), O.z - 7.5)], WALL_UP, 1, PASTEL.wall, WALL_PHYS);
      for (const sg of [1, -1] as const) {
        kit.wallRibbon([V(X0, sy(X0), O.z + sg * 7), V(X1, sy(X1), O.z + sg * 7), V(X2, sy(X2), O.z + sg * (HW))], WALL_UP, sg, PASTEL.wall, WALL_PHYS);
      }
    }
    const P0 = V(E.x + 7.5, O.y - PLATE_H * Math.tan(PLATE_TH), E.z);

    // ───────── 채널 단 점열 ─────────
    const step = (p: V3, dx: number, dz: number, h: number, pitch: number) =>
      V(p.x + dx * h, p.y - h * Math.tan(pitch), p.z + dz * h);
    /** xs: 입구 기준 x 경계 목록(조각 경계). 첫 값은 from.x와 같아야 한다 */
    const straight = (from: V3, dx: number, xs: number[]): V3[] => {
      const pts = [from];
      for (let i = 1; i < xs.length; i++) pts.push(step(pts[i - 1], dx, 0, Math.abs(xs[i] - xs[i - 1]), TH_STRAIGHT));
      return pts;
    };
    const arc = (from: V3, cx: number, cz: number, a0: number, a1: number, n: number): V3[] => {
      const pts = [from];
      let prev = from;
      for (let i = 1; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        const x = cx + TURN_R * Math.cos(a);
        const z = cz + TURN_R * Math.sin(a);
        const ch = Math.hypot(x - prev.x, z - prev.z);
        const p = V(x, prev.y - ch * Math.tan(TH_TURN), z);
        pts.push(p);
        prev = p;
      }
      return pts;
    };

    const z1 = E.z;
    const z2 = E.z + TIER_DZ;
    const z3 = E.z + TIER_DZ * 2;
    const tier1 = straight(P0, 1, [7.5, 10, 12, X_RIGHT]);
    const arc1 = arc(tier1[tier1.length - 1], X_RIGHT + E.x, (z1 + z2) / 2, -Math.PI / 2, Math.PI / 2, 14);
    const tier2 = straight(arc1[arc1.length - 1], -1, [X_RIGHT, 12, 10, 8, 6, 4, X_LEFT]);
    const arc2 = arc(tier2[tier2.length - 1], X_LEFT + E.x, (z2 + z3) / 2, -Math.PI / 2, -Math.PI * 1.5, 14);

    // 원뿔 배수구(basin)
    const R_OUT = 5;
    const R_IN = 2.0;
    const CONE = 35 * D2R;
    const xr = E.x + X_RIM;
    const Cb = V(xr + Math.sqrt(R_OUT * R_OUT - 2.5 * 2.5), 0, z3 + 2.5);
    const tier3 = straight(arc2[arc2.length - 1], 1, [X_LEFT, 4.25, X_RIM]);
    const yr = tier3[tier3.length - 1].y; // 3단 끝 바닥 높이
    // 3단 끝~원뿔 테두리 사이 초승달 틈(채널 가장자리에서 테두리가 더 멀다)을 3단 경사 그대로 이어 메운다.
    // 테두리는 그만큼(yD) 낮춰 판 끝이 테두리보다 높게 → 턱 없이 원뿔로 떨어진다.
    const t3a = tier3[tier3.length - 2];
    const t3b = tier3[tier3.length - 1];
    const th3 = (t3a.y - t3b.y) / (t3b.x - t3a.x);
    const xcAt = (z: number) => Cb.x - Math.sqrt(Math.max(0, (R_OUT + 0.05) ** 2 - (Cb.z - z) ** 2));
    const yD = (xcAt(z3 - HW) - xr) * th3;
    const yrC = yr - yD; // 원뿔 테두리 높이
    Cb.y = yrC;

    // ───────── 조각 생성 ─────────
    function piece(a: V3, b: V3, color: number, o: { noWall?: 1 | -1; trap?: boolean; ribbon?: boolean } = {}) {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const h = Math.hypot(dx, dz);
      const pitch = Math.atan2(a.y - b.y, h);
      const fr = makeFrame(dx / h, dz / h, pitch);
      const len = Math.hypot(h, a.y - b.y);
      if (!o.trap) {
        if (o.noWall) {
          // 열린 쪽 바닥은 채널 폭까지만(슈트와 이어붙임)
          const localOpen = o.noWall * Math.sign(fr.W.z);
          fbox(a, fr, [len / 2, -FLOOR_HT - BACK_DROP, -0.25 * localOpen], [len / 2 + 0.2, FLOOR_HT, HW + 0.25], color, BACK);
        } else {
          fbox(a, fr, [len / 2, -FLOOR_HT - BACK_DROP, 0], [len / 2 + 0.2, FLOOR_HT, HW + 0.5], color, BACK);
        }
      }
      for (const s of [1, -1]) {
        if (o.ribbon && !o.trap) continue;
        if (o.noWall && Math.sign(s * fr.W.z) === o.noWall) continue;
        // 함정문 조각: -z쪽 벽은 아래 슈트까지 내려 구슬 이탈 방지, +z쪽은 슈트가 아래로 통과하도록 바닥면에서 시작
        const base = o.trap ? (Math.sign(s * fr.W.z) < 0 ? -3.2 : 0) : -0.7;
        fbox(
          a,
          fr,
          [len / 2, (WALL_UP + base) / 2, s * (HW + WALL_HT)],
          [len / 2 + 0.25, (WALL_UP - base) / 2, WALL_HT],
          PASTEL.wall,
          WALL,
        );
      }
      return { fr, len };
    }
    const chain = (pts: V3[], color: number, mod: (i: number) => { noWall?: 1 | -1; trap?: boolean; ribbon?: boolean } = () => ({})) => {
      const out: ReturnType<typeof piece>[] = [];
      for (let i = 1; i < pts.length; i++) out.push(piece(pts[i - 1], pts[i], color, mod(i - 1)));
      return out;
    };

    chain(tier1, PASTEL.sky, (i) => (i >= 1 ? { noWall: 1, ribbon: true } : { ribbon: true }));
    chain(arc1, PASTEL.lilac);
    chain(tier2, PASTEL.mint, (i) => (i <= 1 ? { noWall: -1, ribbon: true } : i === 4 || i === 5 ? { trap: true } : { ribbon: true }));
    chain(arc2, PASTEL.lilac);
    chain(tier3, PASTEL.peach, () => ({ noWall: -1, ribbon: true }));
    // 직선 단 벽: 연속 구간마다 리본 1장. sg=+1은 +z쪽 벽
    const tierWalls = (pts: V3[], dirx: 1 | -1, has: (i: number, sg: 1 | -1) => boolean) => {
      for (const sg of [1, -1] as const) {
        let run: V3[] = [];
        const flush = () => {
          if (run.length > 1) kit.wallRibbon(run, WALL_UP, (sg * dirx) as 1 | -1, PASTEL.wall, WALL_PHYS);
          run = [];
        };
        for (let i = 0; i < pts.length - 1; i++) {
          if (has(i, sg)) {
            if (!run.length) run.push(V(pts[i].x, pts[i].y, pts[i].z + sg * HW));
            run.push(V(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z + sg * HW));
          } else flush();
        }
        flush();
      }
    };
    tierWalls(tier1, 1, (i, sg) => sg === -1 || i === 0);
    tierWalls(tier2, -1, (i, sg) => i <= 3 && !(sg === -1 && i <= 1));
    tierWalls(tier3, 1, (i, sg) => sg === 1);

    // ───────── 바닥: 매끈한 한 덩어리 strip(캡틴 지적: 이어붙인 조각 바닥 금지) ─────────
    const strip = (pts: V3[], widths: number[], color: number) => {
      const pos: number[] = [];
      const idx: number[] = [];
      const up = V(0, 1, 0);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        const fwd = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
        const side = new THREE.Vector3().crossVectors(fwd, up).normalize();
        const l = pts[i].clone().addScaledVector(side, -widths[i] / 2);
        const r = pts[i].clone().addScaledVector(side, widths[i] / 2);
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
      kit.trimesh(g, color, FLOOR);
    };
    const CH_W = HW * 2 + 0.5;
    {
      // S1: 입구판(+깔때기 수렴) → 1단 → U턴1 → 2단 함정문 앞까지
      const sp: V3[] = [];
      const sw: number[] = [];
      for (let i = 0; i <= 12; i++) {
        const lx = (PLATE_H * i) / 12; // 판 시작 기준 수평 거리
        sp.push(V(O.x + lx, O.y - lx * Math.tan(PLATE_TH), O.z));
        sw.push(lx <= 10 ? 15 : 15 + ((CH_W - 15) * (lx - 10)) / 5);
      }
      for (const arr of [tier1, arc1, tier2.slice(0, 5)]) {
        for (let i = 1; i < arr.length; i++) {
          sp.push(arr[i]);
          sw.push(CH_W);
        }
      }
      strip(sp, sw, PASTEL.sky);
      // S2: 함정문 뒤 2단 → U턴2 → 3단(원뿔 테두리까지)
      const tp: V3[] = [];
      for (const arr of [arc2, tier3]) for (let i = 1; i < arr.length; i++) tp.push(arr[i]);
      tp.unshift(tier2[6]);
      strip(tp, tp.map(() => CH_W), PASTEL.mint);
    }

    // ───────── 슈트(옆 틈 지름길) ─────────
    const chuteSlab = (xs: number, hx: number, zA: number, yA: number, zB: number, yB: number, color: number) => {
      // 보이지 않는 받침 슬랩(표면보다 0.25 아래)
      const D = V(0, yB - yA, zB - zA);
      const len = D.length();
      D.normalize();
      const n = V(0, D.z, -D.y);
      const Z = new THREE.Vector3().crossVectors(D, n);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(D, n, Z));
      const mid = V(xs, (yA + yB) / 2, (zA + zB) / 2).addScaledVector(n, -0.3 - 0.25);
      kit.box(len / 2 + 0.25, 0.3, hx, mid, q, color, BACK);
    };
    /** 슈트 표면: x 방향 열 × z 방향 행의 쌍선형 한 덩어리 trimesh */
    const chutePatch = (xa: number, xb: number, zA: number, zB: number, yA: (x: number) => number, yB: (x: number) => number, color: number) => {
      const nx = Math.max(2, Math.round((xb - xa) / 0.8));
      const nz = 4;
      const pos: number[] = [];
      const idx: number[] = [];
      for (let j = 0; j <= nz; j++) {
        const u = j / nz;
        for (let i = 0; i <= nx; i++) {
          const x = xa + ((xb - xa) * i) / nx;
          pos.push(x, yA(x) + (yB(x) - yA(x)) * u, zA + (zB - zA) * u);
        }
      }
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const a = j * (nx + 1) + i;
          const b = a + 1;
          const c = a + nx + 1;
          const d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      kit.trimesh(g, color, FLOOR);
    };
    const chuteEnds = (xa: number, xb: number, zA: number, zB: number, yTop: number, yBot: number, topCap: number) => {
      const top = Math.min(yTop + 1.5, topCap);
      const bot = yBot - 0.3;
      for (const x of [xa - 0.25, xb + 0.25]) {
        glassify(kit.box(0.25, (top - bot) / 2, (zB - zA) / 2 - 0.1, V(x, (top + bot) / 2, (zA + zB) / 2), undefined, PASTEL.wall, WALL), WALL);
      }
    };
    const chute = (
      xa: number,
      xb: number,
      zA: number,
      zB: number,
      yA: (x: number) => number,
      yB: (x: number) => number,
      color: number,
      endCap = Infinity,
    ) => {
      chutePatch(xa, xb, zA, zB, yA, yB, color);
      const n = Math.max(1, Math.round((xb - xa) / 0.8));
      const w = (xb - xa) / n;
      let hi = -Infinity;
      let lo = Infinity;
      for (let i = 0; i < n; i++) {
        const xs = xa + w * (i + 0.5);
        chuteSlab(xs, w / 2 + 0.15, zA, yA(xs), zB, yB(xs), color);
        hi = Math.max(hi, yA(xs));
        lo = Math.min(lo, yB(xs));
      }
      chuteEnds(xa, xb, zA, zB, hi, lo, endCap);
    };

    // 쓸개 바 구간 슈트: 1단 +z 가장자리 → 2단 -z 가장자리 (x 12.75~18)
    const sx0 = E.x + 10;
    const sx1 = E.x + X_RIGHT;
    chute(sx0, sx1, z1 + HW, z2 - HW, (x) => yAt(tier1, x), (x) => yAt(tier2, x), PASTEL.yellow);

    // 함정문 구간 슈트: 2단 구멍 아래 → 3단 -z 가장자리 (x -5.3 ~ 5.5 근방)
    const tx0 = tier3[0].x;
    const tx1 = tier3[2].x;
    const trapLowY = (x: number) => yAt(tier2, x) - 2.4; // 판 날(바닥 아래 0.7)에 구슬이 끼지 않도록 슈트를 충분히 낮춘다
    chute(tx0, tx1, z2 - HW - 0.3, z3 - HW, trapLowY, (x) => yAt(tier3, x), PASTEL.yellow, Math.min(yAt(tier2, tx0), yAt(tier2, tx1)) - 0.85);

    // ───────── 회전 쓸개 바 ─────────
    const hubX = E.x + 12;
    const hub = V(hubX, yAt(tier1, hubX), z1 - 1.2);
    const sf = makeFrame(1, 0, TH_STRAIGHT);
    const barPos = hub.clone().addScaledVector(sf.N, 0.9);
    const bar = kit.kinBox(0.9, 0.5, 0.25, barPos, sf.q, PASTEL.coral);
    kit.deco(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 24), hub.clone().addScaledVector(sf.N, 0.8), sf.q, PASTEL.violet);
    const qSpin = new THREE.Quaternion();
    const qTmp = new THREE.Quaternion();
    const AXIS_Y = V(0, 1, 0);

    // ───────── 함정문 ─────────
    const trapA = tier2[4];
    const trapB = tier2[6];
    const trapPlates: { body: ReturnType<typeof kit.kinBox>['body']; mesh: THREE.Mesh | null; rest: V3 }[] = [];
    for (const [a, b] of [
      [tier2[4], tier2[5]],
      [tier2[5], tier2[6]],
    ] as [V3, V3][]) {
      const h = Math.hypot(b.x - a.x, b.z - a.z);
      const fr = makeFrame((b.x - a.x) / h, (b.z - a.z) / h, Math.atan2(a.y - b.y, h));
      const len = Math.hypot(h, a.y - b.y);
      const rest = a.clone().addScaledVector(fr.T, len / 2).addScaledVector(fr.N, -FLOOR_HT);
      const p = kit.kinBox(len / 2 + 0.1, FLOOR_HT, HW + 0.5, rest, fr.q, PASTEL.yellow);
      trapPlates.push({ body: p.body, mesh: p.mesh, rest });
    }
    const TRAP_CYCLE = 7.2;
    const TRAP_SLIDE = 5.6;
    const trapPos = V(0, 0, 0);

    const update = (t: number) => {
      // 쓸개 바
      qSpin.setFromAxisAngle(AXIS_Y, t * 2.6);
      qTmp.copy(sf.q).multiply(qSpin);
      kit.drive(bar.body, bar.mesh, null, qTmp);
      // 함정문(7.2초 주기): 닫힘 2.4초 → 빠르게 열림 0.8 → 개방 1.4 → 천천히 닫힘 2.6.
      // 닫힘 속도 <= 2.2 m/s: 구멍 위를 지나는 구슬이 판 모서리에 맞아 튕겨 나가지 않게.
      const ph = (t + 1.5) % TRAP_CYCLE;
      let open = 0;
      if (ph < 2.4) open = 0;
      else if (ph < 3.2) open = (ph - 2.4) / 0.8;
      else if (ph < 4.6) open = 1;
      else open = 1 - (ph - 4.6) / 2.6;
      for (const p of trapPlates) {
        trapPos.copy(p.rest);
        trapPos.z += TRAP_SLIDE * open;
        kit.drive(p.body, p.mesh, trapPos, null);
      }
    };

    // ───────── 원뿔 배수구 ─────────
    const yh = yrC - (R_OUT - R_IN) * Math.tan(CONE);
    const NC = 24;
    const rc = (R_OUT + R_IN) / 2;
    const coneLen = (R_OUT - R_IN) / Math.cos(CONE);
    kit.funnel(V(Cb.x, yrC, Cb.z), R_OUT, R_IN, yrC - yh, PASTEL.lilac, FLOOR);
    for (let i = 0; i < NC; i++) {
      // 보이지 않는 받침(깔때기 표면보다 0.08 아래 접평면)
      const phi = (i / NC) * Math.PI * 2;
      const u = V(Math.cos(phi), 0, Math.sin(phi));
      const X = V(Math.cos(CONE) * u.x, Math.sin(CONE), Math.cos(CONE) * u.z);
      const Y = V(-Math.sin(CONE) * u.x, Math.cos(CONE), -Math.sin(CONE) * u.z);
      const Z = new THREE.Vector3().crossVectors(X, Y);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
      const topMid = V(Cb.x + u.x * rc, yh + (rc - R_IN) * Math.tan(CONE), Cb.z + u.z * rc);
      const c = topMid.addScaledVector(Y, -FLOOR_HT - 0.08);
      kit.box(coneLen / 2 + 0.15, FLOOR_HT, R_OUT * Math.sin(Math.PI / NC) + 0.12, c, q, PASTEL.lilac, BACK);
    }
    const phiE = Math.atan2(z3 - Cb.z, xr - Cb.x);
    // 고정 날개(vane): 공전하는 구슬의 접선 속도를 깎아 구멍으로 유도
    for (const off of [90, 200, 310]) {
      const phi = phiE + off * D2R;
      const u = V(Math.cos(phi), 0, Math.sin(phi));
      const X = V(Math.cos(CONE) * u.x, Math.sin(CONE), Math.cos(CONE) * u.z);
      const Y = V(-Math.sin(CONE) * u.x, Math.cos(CONE), -Math.sin(CONE) * u.z);
      const Z = new THREE.Vector3().crossVectors(X, Y);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
      const r0 = 2.3;
      const r1 = R_OUT - 0.1;
      const rm = (r0 + r1) / 2;
      const c = V(Cb.x + u.x * rm, yh + (rm - R_IN) * Math.tan(CONE), Cb.z + u.z * rm).addScaledVector(Y, 0.6);
      kit.box(((r1 - r0) / Math.cos(CONE)) / 2, 0.6, 0.25, c, q, PASTEL.coral);
    }
    {
      // 림 가드: 채널 입구 개구부(±0.55 rad)만 비운 호 리본(바깥쪽 side=-1)
      const arcPts: V3[] = [];
      const nA = 40;
      for (let i = 0; i <= nA; i++) {
        const phi = phiE + 0.7 + ((Math.PI * 2 - 1.4) * i) / nA;
        arcPts.push(V(Cb.x + Math.cos(phi) * R_OUT, yrC, Cb.z + Math.sin(phi) * R_OUT));
      }
      kit.wallRibbon(arcPts, WALL_UP, -1, PASTEL.wall, WALL_PHYS);
    }
    {
      // 초승달 메움 판(한 덩어리 trimesh) + -z 쪽 가장자리 벽
      const rows = 6;
      const pos: number[] = [];
      const idx: number[] = [];
      for (let k = 0; k <= rows; k++) {
        const z = z3 - HW + ((HW) * k) / rows; // z3-HW → z3(+2.5 오프셋 쪽 중앙까지만)
        const zc = Math.min(z, Cb.z - 0.001);
        const xc = xcAt(zc);
        pos.push(xr, yr, z, xc, yr - (xc - xr) * th3, z);
        if (k > 0) {
          const a = (k - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      kit.trimesh(g, PASTEL.peach, FLOOR);
      const xe = xcAt(z3 - HW);
      kit.wallRibbon([V(xr, yr, z3 - HW), V(xe, yr - (xe - xr) * th3, z3 - HW)], WALL_UP, -1, PASTEL.wall, WALL_PHYS);
    }
    const exit = V(Cb.x, yh - 0.5, Cb.z);

    // ───────── 중심선 ─────────
    const lift = (p: V3) => V(p.x, p.y + 0.6, p.z);
    const raw: V3[] = [E.clone(), V(E.x, O.y - (E.x - O.x) * Math.tan(PLATE_TH) + 0.6, E.z)];
    for (const arr of [tier1, arc1, tier2, arc2, tier3]) for (const p of arr) raw.push(lift(p));
    {
      const nS = 30;
      for (let i = 1; i <= nS; i++) {
        const u = i / nS;
        const phi = phiE + u * Math.PI * 1.3;
        const r = 4.7 - u * (4.7 - 2.1);
        raw.push(V(Cb.x + Math.cos(phi) * r, yh + (r - R_IN) * Math.tan(CONE) + 0.6, Cb.z + Math.sin(phi) * r));
      }
      raw.push(V(Cb.x, yh + 0.2, Cb.z));
      raw.push(exit.clone());
    }
    // 중복 점 제거 후 재샘플
    const dedup = raw.filter((p, i) => i === 0 || p.distanceTo(raw[i - 1]) > 0.05);
    const centerline = resample(dedup, 1.8);
    const cum = [0];
    for (let i = 1; i < centerline.length; i++) cum.push(cum[i - 1] + centerline[i].distanceTo(centerline[i - 1]));
    const total = cum[cum.length - 1];
    const fracNear = (p: V3) => {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < centerline.length; i++) {
        const d = centerline[i].distanceTo(p);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      return cum[bi] / total;
    };

    // ───────── 갈래 경로 ─────────
    const hubL = lift(V(sx0 + 1.2, yAt(tier1, sx0 + 1.2), z1));
    const spillMid = V(sx0 + 1.2, (yAt(tier1, sx0 + 1.2) + yAt(tier2, sx0 + 1.2)) / 2 + 0.6, (z1 + z2) / 2);
    const spillEnd = lift(V(sx0 - 2.0, yAt(tier2, sx0 - 2.0), z2));
    const spillLand = lift(V(sx0 + 1.2, yAt(tier2, sx0 + 1.2), z2));
    const tIn = lift(tier2[4]);
    const tMid = V(tier3[1].x, (yAt(tier2, tier3[1].x) + yAt(tier3, tier3[1].x)) / 2 + 0.6, (z2 + z3) / 2);
    const tLand = lift(V(tier3[1].x, yAt(tier3, tier3[1].x), z3));
    const tOut = lift(tier3[2]);
    const routes = [
      { name: 'spill-chute', points: [hubL, spillMid, spillLand, spillEnd], fromFrac: fracNear(hubL), toFrac: fracNear(spillEnd) },
      { name: 'trap-chute', points: [tIn, tMid, tLand, tOut], fromFrac: fracNear(tIn), toFrac: fracNear(tOut) },
    ].filter((r) => r.toFrac > r.fromFrac + 0.01);

    // ───────── 핫스팟 ─────────
    const hotspots: Hotspot[] = [
      {
        name: 'channel-sweeper',
        center: hub.clone().add(V(0, 1.5, 3.6)),
        radius: 8,
        shot: { name: 'channel-sweeper', position: V(hub.x + 2, hub.y + 8, z1 - 17), target: hub.clone().add(V(0, 0, 3.6)) },
      },
      {
        name: 'channel-trap',
        center: V((trapA.x + trapB.x) / 2, trapA.y, z2 + 2.5),
        radius: 8,
        shot: {
          name: 'channel-trap',
          position: V((trapA.x + trapB.x) / 2 + 2, trapA.y + 7, z1 - 17),
          target: V((trapA.x + trapB.x) / 2, trapA.y - 1.5, z2 + 2.5),
        },
      },
    ];

    return { exit, centerline, routes, hotspots, update };
  },
};
