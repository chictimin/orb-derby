// 출발 구간 'start' (탑 최상단): 큰 깔때기(교반 막대) → 못판 경사판 → 슬롯 → 출구 깔때기.
// 로컬 규칙: 흐름 방향 +x, 경사판 z폭 ±7. 좌표는 entry 기준 상대값(dy)을 월드로 옮겨 쓴다.
import * as THREE from 'three';
import { makeKit, PASTEL } from '../kit';
import type { Hotspot, SectionCtx, SectionDef } from '../../types';

type Kit = ReturnType<typeof makeKit>;
const Zax = new THREE.Vector3(0, 0, 1);
const Yax = new THREE.Vector3(0, 1, 0);
const GLASS = { opacity: 0.35, cast: false, friction: 0.05, restitution: 0.4 } as const;

/** 다각 깔때기. 표면이 (rimY, Rout) → (yHole, rHole). 벽 경사 deg. 위쪽에 반투명 테두리 가드 */
function funnel(kit: Kit, cx: number, rimY: number, cz: number, Rout: number, rHole: number, deg: number, n: number, color: number, rimH: number) {
  const s = THREE.MathUtils.degToRad(deg);
  const tanS = Math.tan(s), cosS = Math.cos(s), sinS = Math.sin(s);
  const yHole = rimY - (Rout - rHole) * tanS;
  const L = (Rout - rHole) / cosS;
  const hy = 0.3;
  const hz = L / 2 + 0.15;
  const hx = Math.tan(Math.PI / n) * Rout + 0.25;
  const rMid = (Rout + rHole) / 2;
  const rm = rMid + 0.15 * cosS + hy * sinS;
  const ym = yHole + (rMid - rHole) * tanS + 0.15 * sinS - hy * cosS - 0.14;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    m.makeBasis(new THREE.Vector3(-sa, 0, ca), new THREE.Vector3(-sinS * ca, cosS, -sinS * sa), new THREE.Vector3(-cosS * ca, -sinS, -cosS * sa));
    q.setFromRotationMatrix(m);
    kit.box(hx, hy, hz, new THREE.Vector3(cx + rm * ca, ym, cz + rm * sa), q.clone(), color, { friction: 0.35, restitution: 0.2, invisible: true });
    if (rimH > 0) {
      const R2 = Rout + 0.25;
      kit.box(
        0.25,
        rimH / 2,
        Math.tan(Math.PI / n) * R2 + 0.1,
        new THREE.Vector3(cx + R2 * ca, rimY + rimH / 2 - 0.3, cz + R2 * sa),
        new THREE.Quaternion().setFromAxisAngle(Yax, -a),
        PASTEL.wall,
        GLASS,
      );
    }
  }
  kit.funnel(new THREE.Vector3(cx, rimY, cz), Rout, rHole, rimY - yHole, color, { friction: 0.35, restitution: 0.2 });
  return yHole;
}

/** 윗면이 (x0,y0)→(x1,y1)을 지나는 경사 타일(흐름 +x/-x, z 중심 zc, 반폭 halfW) */
function tile(kit: Kit, x0: number, y0: number, x1: number, y1: number, zc: number, halfW: number, color: number, ext = 0.2) {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const dx = Math.cos(ang), dy = Math.sin(ang);
  // 매끈한 표면: 한 덩어리 ramp(trimesh) + 0.12 아래 보이지 않는 cuboid 받침(터널링 방지)
  const total = len + ext * 2;
  const n = Math.max(2, Math.ceil(total / 1.2));
  const path: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const u = -ext + (total * i) / n;
    path.push(new THREE.Vector3(x0 + dx * u, y0 + dy * u, zc));
  }
  kit.ramp(path, halfW * 2, color, { friction: 0.5, restitution: 0.15 });
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const th = 0.6;
  const off = th / 2 + 0.12;
  const c = new THREE.Vector3((x0 + x1) / 2 - nx * off, (y0 + y1) / 2 - ny * off, zc);
  kit.box(len / 2 + ext, th / 2, halfW, c, new THREE.Quaternion().setFromAxisAngle(Zax, ang), color, { friction: 0.5, restitution: 0.15, invisible: true });
}

/** 경사 타일 옆 반투명 가드레일 */
function rail(kit: Kit, x0: number, y0: number, x1: number, y1: number, z: number, h: number, ext = 0.2) {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const c = new THREE.Vector3((x0 + x1) / 2 + nx * (h / 2 - 0.2), (y0 + y1) / 2 + ny * (h / 2 - 0.2), z);
  kit.box(len / 2 + ext, h / 2, 0.25, c, new THREE.Quaternion().setFromAxisAngle(Zax, ang), PASTEL.wall, GLASS);
}

function resample(pts: THREE.Vector3[], step = 1.8): THREE.Vector3[] {
  const out: THREE.Vector3[] = [pts[0].clone()];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const k = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let j = 1; j <= k; j++) out.push(a.clone().lerp(b, j / k));
  }
  return out;
}

export const section: SectionDef = {
  name: 'start',
  order: 0,
  build(ctx: SectionCtx) {
    const kit = makeKit(ctx);
    const { entry } = ctx;
    const ex = entry.x, ey = entry.y, ez = entry.z;
    const P = (x: number, dy: number, z: number) => new THREE.Vector3(ex + x, ey + dy, ez + z);

    // ── A. 큰 출발 깔때기: 림 dy=0, 반경 13, 구멍 반경 2.8(구슬 4~5개 동시), 벽 33° ──
    const yHoleA = funnel(kit, ex, ey, ez, 13, 2.8, 33, 24, PASTEL.mint, 3.2);

    // 교반 막대(구멍 위): 아치 막힘 방지 + 순위 섞기
    const barY = yHoleA + 1.55;
    // 둥근 막대(가로 원기둥): 윗면이 평평하면 중심에 구슬이 얹혀 정지하므로 곡면으로
    const qLay = new THREE.Quaternion().setFromAxisAngle(Zax, Math.PI / 2);
    const bar = kit.kinCylinder(3.6, 0.3, new THREE.Vector3(ex, barY, ez), qLay.clone(), PASTEL.coral, { friction: 0.2, restitution: 0.5 });

    // ── B. 못판 경사판(15°): 구멍에서 약 5 낙하해 받는다 ──
    const TH = THREE.MathUtils.degToRad(17);
    const tanTH = Math.tan(TH);
    const X0 = -6, XF = 10.5, XW = 13.15;
    const Y0 = -10 + 0; // 판 시작(dy)
    const yp = (x: number) => Y0 - (x - X0) * tanTH; // dy 기준 표면
    const HW = 7;
    tile(kit, ex + X0, ey + yp(X0), ex + XF, ey + yp(XF), ez, HW, PASTEL.peach);
    for (const s of [1, -1]) {
      rail(kit, ex + X0, ey + yp(X0), ex + XF, ey + yp(XF), ez + s * (HW + 0.25), 2.6);
      // 슬롯 구간 옆 가드
      kit.box(1.5, 2.75, 0.25, new THREE.Vector3(ex + (XF + XW) / 2 + 0.1, ey + yp(XF) - 0.4 + 0.75, ez + s * (HW + 0.25)), new THREE.Quaternion(), PASTEL.wall, GLASS);
    }
    // 뒷벽(위끝)·끝벽(슬롯 뒤)
    kit.box(0.25, 2.5, HW + 0.5, new THREE.Vector3(ex + X0 - 0.35, ey + yp(X0) + 1.8, ez), new THREE.Quaternion(), PASTEL.wall, GLASS);
    kit.box(0.25, 3.6, HW + 0.5, new THREE.Vector3(ex + XW + 0.25, ey + yp(XF) + 0.1, ez), new THREE.Quaternion(), PASTEL.wall, GLASS);

    // 못(경사판 법선 방향 원기둥). 지그재그 배치
    const qPlate = new THREE.Quaternion().setFromAxisAngle(Zax, -TH);
    const nrm = new THREE.Vector3(Math.sin(TH), Math.cos(TH), 0);
    const rows = [3.0, 5.8, 8.6];
    rows.forEach((x, ri) => {
      const zs = ri % 2 === 0 ? [-4.2, 0, 4.2] : [-2.1, 2.1];
      for (const z of zs) {
        const base = P(x, yp(x), z).addScaledVector(nrm, 0.5);
        kit.cylinder(0.6, 0.5, base, qPlate.clone(), PASTEL.yellow, { friction: 0.1, restitution: 0.6 });
      }
    });

    // ── C. 출구 깔때기: 슬롯 아래, 림 반경 10, 구멍 반경 3.0 ──
    const xc = (XF + XW) / 2;
    const rimC = yp(XF) - 3.6;
    const yHoleC = funnel(kit, ex + xc, ey + rimC, ez, 10, 3.0, 33, 24, PASTEL.sky, 1.2);
    const exit = P(xc, yHoleC - ey - 0.2, 0);

    // ── 중심선 ──
    const line = resample([
      P(0, 0, 0),
      P(0, yHoleA - ey, 0),
      P(0, yp(0) + 0.6, 0),
      P(XF - 0.3, yp(XF - 0.3) + 0.6, 0),
      P(xc, yp(XF) - 1.0, 0),
      P(xc, yHoleC - ey + 0.6, 0),
      exit.clone().sub(new THREE.Vector3(ex, ey, ez)).add(new THREE.Vector3(ex, ey, ez)),
    ]);

    // ── 스폰: 깔때기 위 공중 2층 격자 40개 ──
    const spawn: THREE.Vector3[] = [];
    const ring = (r: number, k: number, dy: number, phase: number) => {
      for (let i = 0; i < k; i++) {
        const a = phase + (i / k) * Math.PI * 2;
        spawn.push(P(Math.cos(a) * r, dy, Math.sin(a) * r));
      }
    };
    ring(2.5, 8, 2.0, 0);
    ring(5.0, 14, 2.0, 0.2);
    ring(2.5, 8, 4.6, 0.4);
    ring(5.0, 10, 4.6, 0.1);

    const hotspots: Hotspot[] = [
      {
        name: 'start-funnel',
        center: P(0, -4, 0),
        radius: 14,
        shot: { name: 'start-funnel', position: P(26, 6, 12), target: P(0, -4, 0) },
      },
      {
        name: 'pegboard',
        center: P(4, yp(4) + 1, 0),
        radius: 11,
        shot: { name: 'pegboard', position: P(4, yp(4) + 7, -24), target: P(4, yp(4) + 0.5, 0) },
      },
    ];

    const q = new THREE.Quaternion();
    return {
      exit,
      centerline: line,
      hotspots,
      spawnPoints: spawn,
      update(t: number) {
        q.setFromAxisAngle(Yax, 1.35 * t).multiply(qLay);
        kit.drive(bar.body, bar.mesh, null, q);
      },
    };
  },
};
