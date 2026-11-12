// 탑 구간 'seesaw': 입구 깔때기 → 회전 막대 경사판(P1, 18°) → 시소 판 + 왕복 푸셔 경사판(P2, 20°, 반대 방향) → 슬롯 → 출구 깔때기.
// 좌표는 entry 기준 상대값(dx, dy, dz)을 P()로 월드로 옮긴다. funnel()의 rimY/반환값만 월드 절대 y다.
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
  name: 'seesaw',
  order: 50,
  build(ctx: SectionCtx) {
    const kit = makeKit(ctx);
    const { entry } = ctx;
    const ex = entry.x, ey = entry.y, ez = entry.z;
    const P = (x: number, dy: number, z: number) => new THREE.Vector3(ex + x, ey + dy, ez + z);
    const deg = THREE.MathUtils.degToRad;

    // ── 입구 깔때기: 림 dy=0, 반경 8.5(받침 반경 7 + 여유), 구멍 반경 2.6, 벽 35° ──
    const yHoleF0 = funnel(kit, ex, ey, ez, 8.5, 2.6, 35, 24, PASTEL.mint, 2.0);

    // ── P1: 18° 경사판(+x 흐름). 회전 막대(스위퍼) ──
    const T1 = deg(18), tan1 = Math.tan(T1);
    const y1 = (x: number) => -9.4 - x * tan1;
    const HW = 5.5;
    tile(kit, ex - 8, ey + y1(-8), ex + 9, ey + y1(9), ez, HW, PASTEL.lilac);
    for (const s of [1, -1]) rail(kit, ex - 8, ey + y1(-8), ex + 9, ey + y1(9), ez + s * (HW + 0.25), 2.6);
    kit.box(0.25, 2.5, HW + 0.5, P(-8.4, y1(-8) + 1.8, 0), new THREE.Quaternion(), PASTEL.wall, GLASS);
    const qP1 = new THREE.Quaternion().setFromAxisAngle(Zax, -T1);
    const nP1 = new THREE.Vector3(Math.sin(T1), Math.cos(T1), 0);
    const sw = { x: 3.0 };
    const swSurf = P(sw.x, y1(sw.x), 0);
    kit.cylinder(0.45, 0.7, swSurf.clone().addScaledVector(nP1, 0.45), qP1.clone(), PASTEL.violet, { friction: 0.3, restitution: 0.4 });
    const bar = kit.kinBox(3.6, 0.3, 0.3, swSurf.clone().addScaledVector(nP1, 0.85), qP1.clone(), PASTEL.coral, { friction: 0.3, restitution: 0.5 });

    // ── P2: 20° 경사판(-x 흐름). 위: 푸셔 → 시소 판 → 아래판 → 슬롯 ──
    const T2 = deg(20), tan2 = Math.tan(T2);
    const y2 = (x: number) => -15.9 - (10.9 - x) * tan2;
    const XUP = 4.0, XLO = -2.4, XEND = -9.0, XSLOT = -11.2;
    tile(kit, ex + XUP, ey + y2(XUP), ex + 10.9, ey + y2(10.9), ez, HW, PASTEL.sky); // 윗판
    const lowOff = 1.3;
    tile(kit, ex + XEND, ey + y2(XEND) - lowOff, ex + XLO, ey + y2(XLO) - lowOff, ez, HW, PASTEL.peach); // 아랫판
    for (const s of [1, -1]) {
      const z = ez + s * (HW + 0.25);
      rail(kit, ex + XLO, ey + y2(XLO), ex + 10.9, ey + y2(10.9), z, 3.3);
      rail(kit, ex + XEND, ey + y2(XEND) - lowOff, ex + XLO, ey + y2(XLO) - lowOff, z, 3.0);
    }
    // 윗판 뒷벽(P1 끝에서 날아온 구슬을 받는다)
    kit.box(0.25, 3.85, HW + 0.5, P(11.25, -12.65, 0), new THREE.Quaternion(), PASTEL.wall, GLASS);

    // 시소 판(kinematic): 평균 면은 선 아래 0.6, 흔들림 ±7° → 경사 13~27° (항상 12° 이상), 양 끝은 내려가는 턱만
    const xpc = 0.6;
    const nP2 = new THREE.Vector3(-Math.sin(T2), Math.cos(T2), 0);
    const plankSurf = P(xpc, y2(xpc) - 0.6, 0);
    const plankC = plankSurf.clone().addScaledVector(nP2, -0.3);
    const plank = kit.kinBox(3.2, 0.3, HW, plankC, new THREE.Quaternion().setFromAxisAngle(Zax, T2), PASTEL.teal, { friction: 0.6, restitution: 0.1 });
    // 받침 장식(충돌 없음)
    kit.deco(new THREE.CylinderGeometry(0.35, 0.35, 2 * HW + 0.6, 20), plankC.clone().add(new THREE.Vector3(0, -0.2, 0)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), PASTEL.pink);

    // 왕복 푸셔(윗판): z로 ±2.4 왕복(벽과 간격 0.6 < 구슬 지름이라 끼지 않음)
    const pushX = 8.0;
    const pushBase = P(pushX, y2(pushX), 0).addScaledVector(nP2, 0.65);
    const qP2 = new THREE.Quaternion().setFromAxisAngle(Zax, T2);
    const pusher = kit.kinBox(0.35, 0.6, 2.4, pushBase, qP2.clone(), PASTEL.orange, { friction: 0.2, restitution: 0.6 });

    // 슬롯 + 끝벽 + 출구 깔때기
    const floorEnd = y2(XEND) - lowOff;
    const xc = (XEND + XSLOT) / 2;
    kit.box(0.25, 3.5, HW + 0.5, P(XSLOT - 0.25, floorEnd + 1.0, 0), new THREE.Quaternion(), PASTEL.wall, GLASS);
    for (const s of [1, -1]) kit.box(1.2, 2.4, 0.25, P(xc, floorEnd + 0.4, s * (HW + 0.25)), new THREE.Quaternion(), PASTEL.wall, GLASS);
    const rimF1 = floorEnd - 3.1;
    const yHoleF1 = funnel(kit, ex + xc, ey + rimF1, ez, 8, 2.4, 35, 24, PASTEL.sky, 1.2);
    const exit = P(xc, yHoleF1 - ey - 0.2, 0);

    // ── 중심선 ──
    const line = resample([
      P(0, 0, 0),
      P(0, yHoleF0 - ey, 0),
      P(0, y1(0) + 0.6, 0),
      P(8.8, y1(8.8) + 0.6, 0),
      P(10.3, y2(10.3) + 0.6, 0),
      P(XUP, y2(XUP) + 0.6, 0),
      P(xpc, y2(xpc), 0),
      P(-2.6, y2(-2.6), 0),
      P(-3.0, y2(-3.0) - lowOff + 0.6, 0),
      P(XEND, y2(XEND) - lowOff + 0.6, 0),
      P(xc, floorEnd - 1.0, 0),
      P(xc, yHoleF1 - ey + 0.6, 0),
      exit.clone(),
    ]);

    const hotspots: Hotspot[] = [
      { name: 'sweeper', center: P(3, y1(3) + 1, 0), radius: 10, shot: { name: 'sweeper', position: P(3, y1(3) + 5, 22), target: P(3, y1(3) + 0.5, 0) } },
      { name: 'seesaw', center: P(1, y2(1), 0), radius: 10, shot: { name: 'seesaw', position: P(1, y2(1) + 6, 22), target: P(1, y2(1) - 0.5, 0) } },
    ];

    const q = new THREE.Quaternion();
    const qa = new THREE.Quaternion();
    return {
      exit,
      centerline: line,
      hotspots,
      update(t: number) {
        qa.setFromAxisAngle(Yax, 1.5 * t);
        q.copy(qP1).multiply(qa);
        kit.drive(bar.body, bar.mesh, null, q);
        q.setFromAxisAngle(Zax, T2 + deg(7) * Math.sin(1.3 * t));
        kit.drive(plank.body, plank.mesh, null, q);
        const z = 2.4 * Math.sin((2 * Math.PI * t) / 3.4);
        kit.drive(pusher.body, pusher.mesh, new THREE.Vector3(pushBase.x, pushBase.y, ez + z), null);
      },
    };
  },
};
