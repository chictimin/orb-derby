// 구간 'pipe' (order 30): 필터 깔때기 → 분기 접시 → [둥근 파이프 나선 | 지름길 슈트] → 합류 깔때기 → 출구.
// 좌표는 모두 entry 기준 상대(rel) → 월드는 E.add(rel).
import * as THREE from 'three';
import type { Hotspot, SectionDef } from '../../types';
import { PASTEL, makeKit } from '../kit';

const DEG = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);

// ── 파라미터 ──
const F1 = { rTop: 8, rBot: 1.8, yTop: -1, yBot: -5 }; // 입구 깔때기
const PLATE_DEG = 15;
const PLATE_Y0 = -9; // 접시 표면 높이 @x=0
const TAN_P = Math.tan(PLATE_DEG * DEG);
const surf = (x: number) => PLATE_Y0 - x * TAN_P;
const TUBE_R = 1.8; // 파이프 내경
const HELIX_R = 5.5; // 나선 중심 반경
const C0X = 5.5;
const LANE_Z = -1.8;
const FUN2_Y = -22.7; // 합류 깔때기 구멍 높이
const F2 = { rTop: 10, rBot: 1.8 };
const CHUTE = { y0: -12.2, y1: -17.9, z0: 0.5, z1: 8.6, hw: 1.5 };

export const section: SectionDef = {
  name: 'pipe',
  order: 30,
  build(ctx) {
    const kit = makeKit(ctx);
    const E = ctx.entry.clone();
    const W = (x: number, y: number, z: number) => new THREE.Vector3(E.x + x, E.y + y, E.z + z);

    // ── 깔때기(슬랩 N장 + 라테 시각 메시) ──
    function funnel(cx: number, cz: number, rTop: number, rBot: number, yTop: number, yBot: number, N: number, color: number, rimH: number) {
      const phi = Math.atan2(yTop - yBot, rTop - rBot);
      const len = Math.hypot(rTop - rBot, yTop - yBot);
      const hz = Math.PI * rTop / N * 1.12;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const u = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const s = new THREE.Vector3().copy(u).multiplyScalar(Math.cos(phi)).add(new THREE.Vector3(0, Math.sin(phi), 0));
        const n = new THREE.Vector3().copy(u).multiplyScalar(-Math.sin(phi)).add(new THREE.Vector3(0, Math.cos(phi), 0));
        const t = s.clone().cross(n);
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(s, n, t));
        // 받침: 윗면이 trimesh 표면보다 0.25 아래(이음매 재발 방지), 다각 근사 오차(<0.15)보다 깊다
        const mid = W(cx, (yTop + yBot) / 2, cz).addScaledVector(u, (rTop + rBot) / 2).addScaledVector(n, -0.55);
        kit.box(len / 2, 0.3, hz, mid, q, color, { invisible: true });
      }
      // 한 덩어리 매끈한 회전체(충돌+시각)
      kit.funnel(W(cx, yTop, cz), rTop, rBot, yTop - yBot, color, { friction: 0.5 });
      // 테두리 벽(반투명)
      const M = 28;
      for (let i = 0; i < M; i++) {
        const a = (i / M) * Math.PI * 2;
        const r = rTop + 0.2;
        const pos = W(cx + Math.cos(a) * r, yTop + rimH / 2, cz + Math.sin(a) * r);
        const q = new THREE.Quaternion().setFromAxisAngle(Y, -a);
        kit.box(0.25, rimH / 2, (Math.PI * r) / M + 0.08, pos, q, PASTEL.wall, { opacity: 0.38, cast: false });
      }
    }

    funnel(0, 0, F1.rTop, F1.rBot, F1.yTop, F1.yBot, 16, PASTEL.mint, -F1.yTop);

    // ── 분기 접시(15°, +x 내리막) ──
    const qPlate = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -PLATE_DEG * DEG);
    const nP = new THREE.Vector3(Math.sin(PLATE_DEG * DEG), Math.cos(PLATE_DEG * DEG), 0);
    const cosP = Math.cos(PLATE_DEG * DEG);
    /** 접시 표면 위 점(x,z)에서 법선으로 h만큼 띄운 월드 좌표 */
    const onPlate = (x: number, z: number, h: number) => W(x, surf(x), z).addScaledVector(nP, h);
    const plateBox = (x0: number, x1: number, z0: number, z1: number, color: number, drop = 0) => {
      const xc = (x0 + x1) / 2;
      const hx = ((x1 - x0) / 2) / cosP;
      kit.box(hx, 0.25, (z1 - z0) / 2, onPlate(xc, (z0 + z1) / 2, -0.25 + drop), qPlate, color, { invisible: true });
    };
    const plateWall = (x0: number, x1: number, z: number, h = 1.0) => {
      const xc = (x0 + x1) / 2;
      kit.box(((x1 - x0) / 2) / cosP, h / 2, 0.2, onPlate(xc, z, h / 2), qPlate, PASTEL.wall, { opacity: 0.38, cast: false });
    };
    // 받침(보이지 않음, 윗면이 표면보다 0.1 아래) + 한 덩어리 L자 바닥 trimesh
    plateBox(-3.5, 3.0, -3.4, 3.6, PASTEL.peach, -0.35);
    plateBox(3.0, 5.2, -3.4, -0.3, PASTEL.peach, -0.35);
    {
      const xs = [-3.5, 3.0, 5.2];
      const zs = [-3.4, -0.3, 3.6];
      const pos: number[] = [];
      for (const z of zs) for (const x of xs) {
        const p = W(x, surf(x), z);
        pos.push(p.x, p.y, p.z);
      }
      const idx: number[] = [];
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 2; c++) {
          if (r === 1 && c === 1) continue; // x>3, z>-0.3 은 지름길 구멍
          const a = r * 3 + c;
          idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      kit.trimesh(g, PASTEL.peach, { receive: true, cast: false });
    }
    plateWall(-3.6, 3.0, -3.55);
    plateWall(-3.6, 3.0, 3.75);
    plateWall(3.0, 5.2, -3.55);
    plateWall(2.2, 4.6, -0.5); // 레인 분리 능선
    kit.box(0.2, 2.2, 3.8, W(-3.75, -7.2, 0.1), new THREE.Quaternion(), PASTEL.wall, { opacity: 0.38, cast: false });

    // 회전 막대(접시 법선 축으로 회전, 접시와 평행)
    const hub = onPlate(-0.6, 0.2, 0);
    const armPos = hub.clone().addScaledVector(nP, 0.55);
    const arm = kit.kinBox(2.0, 0.5, 0.2, armPos, qPlate, PASTEL.coral, {});
    kit.cylinder(0.3, 0.45, hub.clone().addScaledVector(nP, 0.3), qPlate.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0)), PASTEL.yellow, {});
    const qAx = new THREE.Quaternion();
    const OMEGA = 2.1;

    // ── 파이프 나선 ──
    const betaT = Math.tan(PLATE_DEG * DEG);
    const T0 = new THREE.Vector3(Math.cos(PLATE_DEG * DEG), -Math.sin(PLATE_DEG * DEG), 0);
    const V0 = new THREE.Vector3(Math.sin(PLATE_DEG * DEG), Math.cos(PLATE_DEG * DEG), 0);
    const floorX = C0X - TUBE_R * V0.x;
    const c0y = surf(floorX) + TUBE_R * V0.y;
    const C0 = new THREE.Vector3(C0X, c0y, LANE_Z); // rel
    const A = new THREE.Vector3(C0X, 0, LANE_Z + HELIX_R); // 나선 축(=합류 깔때기 중심) rel xz
    const TURN_END = Math.PI * 2 + 0.28;
    // 중심선 스테이션(rel)
    const stations: { c: THREE.Vector3; t: THREE.Vector3 }[] = [];
    const LEAD = 1.5;
    for (let s = LEAD; s > 0.01; s -= 0.75) stations.push({ c: C0.clone().addScaledVector(T0, -s), t: T0.clone() });
    const dTh = 0.2;
    for (let th = 0; th <= TURN_END + 1e-6; th += dTh) {
      const c = new THREE.Vector3(A.x + HELIX_R * Math.sin(th), C0.y - HELIX_R * th * betaT, A.z - HELIX_R * Math.cos(th));
      const t = new THREE.Vector3(Math.cos(th), -betaT, Math.sin(th)).normalize();
      stations.push({ c, t });
    }
    // 프레임: S = t × Y(수평 옆), V = S × t (단면 내 위)
    const frames = stations.map(({ c, t }) => {
      const S = new THREE.Vector3().crossVectors(t, Y).normalize();
      const V = new THREE.Vector3().crossVectors(S, t).normalize();
      return { c, t, S, V };
    });
    // 충돌: 단면 둘레 10장 평판(안쪽 면이 반경 TUBE_R에 접함)
    const NP = 10;
    const APO = TUBE_R + 0.15; // 받침 평판 안쪽 면 반경(원통 표면보다 바깥)
    const pw = APO * Math.tan(Math.PI / NP) + 0.1;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const next = frames[i + 1];
      const segLen = next ? next.c.distanceTo(f.c) : 0.8;
      const hx = segLen / 2 + 0.12;
      const mid = next ? f.c.clone().add(next.c).multiplyScalar(0.5) : f.c.clone().addScaledVector(f.t, 0.4);
      const tt = next ? next.c.clone().sub(f.c).normalize() : f.t;
      const Sm = new THREE.Vector3().crossVectors(tt, Y).normalize();
      const Vm = new THREE.Vector3().crossVectors(Sm, tt).normalize();
      for (let k = 0; k < NP; k++) {
        const ph = (k / NP) * Math.PI * 2 - Math.PI / 2; // k=0 → 바닥
        const u = new THREE.Vector3().copy(Sm).multiplyScalar(Math.cos(ph)).addScaledVector(Vm, Math.sin(ph));
        const w = tt.clone().cross(u);
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tt, u, w));
        // 평판 안쪽 면 = 반경 TUBE_R → 중심은 TUBE_R + 0.25 (u는 바깥쪽 방향, 평판 y축 = u)
        const pos = W(mid.x, mid.y, mid.z).addScaledVector(u, APO + 0.25);
        kit.box(hx, 0.25, pw, pos, q, PASTEL.sky, { invisible: true });
      }
    }
    // 시각 메시(반투명 튜브)
    {
      const M = 28;
      const pos: number[] = [];
      const idx: number[] = [];
      frames.forEach((f) => {
        for (let j = 0; j < M; j++) {
          const ph = (j / M) * Math.PI * 2;
          const p = W(f.c.x, f.c.y, f.c.z)
            .addScaledVector(f.S, Math.cos(ph) * TUBE_R)
            .addScaledVector(f.V, Math.sin(ph) * TUBE_R);
          pos.push(p.x, p.y, p.z);
        }
      });
      for (let i = 0; i < frames.length - 1; i++)
        for (let j = 0; j < M; j++) {
          const a = i * M + j;
          const b = i * M + ((j + 1) % M);
          const c = (i + 1) * M + j;
          const d = (i + 1) * M + ((j + 1) % M);
          idx.push(a, b, c, b, d, c);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      kit.trimesh(g, PASTEL.sky, { opacity: 0.42, cast: false, receive: false, friction: 0.4 });
    }

    // ── 지름길 슈트(+z 방향 내리막) ──
    {
      const { y0, y1, z0, z1, hw } = CHUTE;
      const dz = z1 - z0;
      const dy = y0 - y1;
      const psi = Math.atan2(dy, dz);
      const len = Math.hypot(dz, dy);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), psi);
      const nC = new THREE.Vector3(0, Math.cos(psi), Math.sin(psi) * -1).normalize(); // 법선(위쪽)
      nC.set(0, Math.cos(psi), Math.sin(psi)); // 회전 후 +y 축
      const midTop = W(C0X, (y0 + y1) / 2, (z0 + z1) / 2);
      kit.box(hw + 0.2, 0.25, len / 2, midTop.clone().addScaledVector(nC, -0.25), q, PASTEL.lemon, {});
      for (const sx of [-1, 1]) kit.box(0.2, 0.6, len / 2, midTop.clone().addScaledVector(nC, 0.6).add(new THREE.Vector3(sx * (hw + 0.4), 0, 0)), q, PASTEL.wall, { opacity: 0.38, cast: false });
      kit.box(hw + 0.6, 1.2, 0.2, W(C0X, y0 + 0.9, z0 - 0.3), new THREE.Quaternion(), PASTEL.wall, { opacity: 0.38, cast: false });
    }

    // ── 합류 깔때기 ──
    funnel(A.x, A.z, F2.rTop, F2.rBot, FUN2_Y + (F2.rTop - F2.rBot) * 0.65, FUN2_Y, 20, PASTEL.pink, 2.6);

    // ── 중심선/루트 ──
    const exit = W(A.x, FUN2_Y - 0.5, A.z);
    const main: THREE.Vector3[] = [];
    const push = (arr: THREE.Vector3[], p: THREE.Vector3) => arr.push(p);
    const sub = (arr: THREE.Vector3[], to: THREE.Vector3, step = 1.6) => {
      const from = arr[arr.length - 1];
      const n = Math.max(1, Math.ceil(from.distanceTo(to) / step));
      for (let i = 1; i <= n; i++) arr.push(from.clone().lerp(to, i / n));
    };
    push(main, W(0, 0, 0));
    sub(main, W(0, F1.yBot - 0.3, 0));
    sub(main, onPlate(0.6, -0.1, 0.65));
    sub(main, onPlate(4.0, LANE_Z, 0.65));
    for (const f of frames) {
      const p = W(f.c.x, f.c.y, f.c.z).addScaledVector(f.V, -TUBE_R + 0.6);
      sub(main, p, 1.5);
    }
    const idxHole0 = main.length;
    sub(main, W(A.x, FUN2_Y + 0.9, A.z), 1.5);
    sub(main, exit, 1.5);

    // 길이 누적으로 루트 분기/합류 비율 산출
    const cum = [0];
    for (let i = 1; i < main.length; i++) cum.push(cum[i - 1] + main[i].distanceTo(main[i - 1]));
    const totalLen = cum[cum.length - 1];
    const fracAt = (x: number) => {
      let best = 0;
      let bd = Infinity;
      main.forEach((p, i) => {
        const d = Math.abs(p.x - E.x - x) + Math.abs(p.z - E.z) * 0.1 + Math.abs(p.y - (E.y + surf(x))) * 1;
        if (d < bd) (bd = d), (best = i);
      });
      return cum[best] / totalLen;
    };
    const route: THREE.Vector3[] = [];
    push(route, onPlate(1.0, 0.4, 0.65));
    sub(route, onPlate(3.0, 0.8, 0.65), 1.5);
    sub(route, W(C0X - 0.5, CHUTE.y0 + 0.65, CHUTE.z0 + 0.6), 1.5);
    sub(route, W(C0X, CHUTE.y1 + 0.65, CHUTE.z1 - 0.2), 1.5);
    sub(route, W(A.x, FUN2_Y + 0.9, A.z), 1.5);
    const fromFrac = fracAt(1.0);
    const toFrac = cum[idxHole0 + Math.min(1, main.length - idxHole0 - 1)] / totalLen;

    // ── 핫스팟 ──
    const hotspots: Hotspot[] = [
      {
        name: 'pipe-helix',
        center: W(A.x, -14, A.z),
        radius: 9,
        shot: { name: 'pipe-helix', position: W(A.x + 24, -11, A.z - 6), target: W(A.x, -15, A.z) },
      },
      {
        name: 'pipe-fork',
        center: W(1, -10, 0),
        radius: 6,
        shot: { name: 'pipe-fork', position: W(-14, -6, -12), target: W(2, -10.5, 0.5) },
      },
    ];

    return {
      exit,
      centerline: main,
      routes: [{ name: 'shortcut', points: route, fromFrac, toFrac }],
      hotspots,
      update(t) {
        const ang = t * OMEGA;
        const q = qPlate.clone().multiply(qAx.setFromAxisAngle(Y, ang));
        kit.drive(arm.body, arm.mesh, null, q);
      },
    };
  },
};
