// 구간 finale(order 90): 큰 깔때기(반경 15.5)가 위 구간의 구슬을 받아 중앙 구멍으로 모으고,
// 그 아래 기울어진 회전 원판(턴테이블+말뚝)이 마지막 순위를 섞는다. 원판에서 나온 구슬은 조립기의 결승 접시로 떨어진다.
// 결승 접시 둘레에는 화려한 결승 아치 장식(deco).
import * as THREE from 'three';
import type { SectionDef } from '../../types';
import { glassMat, makeKit, PASTEL } from '../kit';

const R_OUT = 15.5;
const R_IN = 3;
const FUN = (35 * Math.PI) / 180;
const N_SEG = 28;
const DISC_R = 6;
const DISC_TILT = (14 * Math.PI) / 180;
const DISC_HH = 0.4;

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
  name: 'finale',
  order: 90,
  build(ctx) {
    const kit = makeKit(ctx);
    const E = ctx.entry;
    const Y = new THREE.Vector3(0, 1, 0);

    // ── 깔때기: 경사 35°, 바깥 가장자리 상단 = entry 높이 ──
    const rm = (R_OUT + R_IN) / 2;
    const slant = (R_OUT - R_IN) / Math.cos(FUN);
    const midY = E.y - (R_OUT - rm) * Math.tan(FUN);
    const chord = R_OUT * Math.sin(Math.PI / N_SEG) + 0.12;
    // 한 덩어리 회전체 깔때기(trimesh) + 표면 0.1 아래 보이지 않는 상자 받침(터널링 방지)
    kit.funnel(E.clone(), R_OUT, R_IN, (R_OUT - R_IN) * Math.tan(FUN), PASTEL.lilac, { friction: 0.3, restitution: 0.2 });
    for (let i = 0; i < N_SEG; i++) {
      const a = (i / N_SEG) * Math.PI * 2;
      const o = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const d = o.clone().multiplyScalar(Math.cos(FUN)).addScaledVector(Y, Math.sin(FUN));
      const n = o.clone().multiplyScalar(-Math.sin(FUN)).addScaledVector(Y, Math.cos(FUN));
      const t = new THREE.Vector3().crossVectors(d, n);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(d, n, t));
      const pos = new THREE.Vector3(E.x + o.x * rm, midY, E.z + o.z * rm).addScaledVector(n, -0.45);
      kit.box(slant / 2 + 0.05, 0.3, chord, pos, q, PASTEL.lilac, { friction: 0.3, restitution: 0.2, invisible: true });
    }
    // 바깥 가드(반투명): 원통 옆면 1장 + 보이지 않는 상자 링
    kit.rimWall(new THREE.Vector3(E.x, E.y - 0.1, E.z), R_OUT + 0.15, 3.0, PASTEL.wall, { opacity: 0.35 });
    const holeY = E.y - (R_OUT - R_IN) * Math.tan(FUN);

    // ── 회전 원판 ──
    const D = new THREE.Vector3(E.x, holeY - 4.5, E.z); // 원판 윗면 중심
    const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), DISC_TILT); // +z 쪽이 낮다
    const nDisc = new THREE.Vector3(0, 1, 0).applyQuaternion(qTilt);
    const discPos = D.clone().addScaledVector(nDisc, -DISC_HH);
    const disc = kit.kinCylinder(DISC_HH, DISC_R, discPos, qTilt, PASTEL.peach, { friction: 0.4, restitution: 0.25 });
    const pegs = [0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const local = new THREE.Vector3(Math.cos(a) * 3.6, DISC_HH + 0.45, Math.sin(a) * 3.6);
      const peg = kit.kinCylinder(0.45, 0.4, D.clone(), qTilt, PASTEL.coral, { restitution: 0.8, friction: 0.2 });
      return { peg, local };
    });
    // 원판 아래 받침 기둥(장식)
    kit.deco(new THREE.CylinderGeometry(0.8, 1.4, 5, 16), D.clone().add(new THREE.Vector3(0, -4.2, 0)), undefined, PASTEL.pink);

    // 원판 둘레 가드(반투명): 뒤·옆만 막고 앞쪽(+z) 호는 연다. 원판은 항상 +z가 낮아 구슬은 앞으로 나간다
    const GR = DISC_R + 0.8;
    const GN = 24;
    // 뒤·옆 호(+z 앞쪽 약 140°는 열림): 완만한 원호라 리본 1장
    {
      const arc: THREE.Vector3[] = [];
      const a0 = Math.PI - Math.asin(0.35);
      const a1 = 2 * Math.PI + Math.asin(0.35);
      const n = 30;
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        arc.push(new THREE.Vector3(D.x + Math.cos(a) * (GR - 0.25), D.y - 1.8, D.z + Math.sin(a) * (GR - 0.25)));
      }
      kit.wallRibbon(arc, 5.8, -1, PASTEL.wall, { opacity: 0.35 });
    }

    // 앞쪽 열린 호 바깥으로 모이는 V자 가이드: 원판에서 옆으로 크게 튕겨 나가 결승 접시를 벗어나는 것을 막는다
    for (const sgn of [-1, 1]) {
      const x0 = D.x + sgn * 6.5, z0 = D.z + 2.2, x1 = D.x + sgn * 3.0, z1 = D.z + 9.5;
      const path = [new THREE.Vector3(x0, D.y - 5.4, z0), new THREE.Vector3(x1, D.y - 5.4, z1)];
      const f = path[1].clone().sub(path[0]).normalize();
      const outSide = new THREE.Vector3().crossVectors(f, Y).x * sgn > 0 ? 1 : -1; // 중심에서 먼 쪽
      kit.wallRibbon(path, 6.4, outSide, PASTEL.wall, { opacity: 0.35 });
    }

    // 원판 위 반투명 지붕(고리): 말뚝·충돌로 튀어 오른 구슬이 가드를 넘어 날아가지 않게 한다. 깔때기 구멍(반경 3)은 비워 둔다
    for (let i = 0; i < GN; i++) {
      const a = (i / GN) * Math.PI * 2;
      const rq = new THREE.Quaternion().setFromAxisAngle(Y, -a);
      const rp = new THREE.Vector3(D.x + Math.cos(a) * 5.7, D.y + 4.0, D.z + Math.sin(a) * 5.7);
      kit.box(2.05, 0.25, 1.1, rp, rq, PASTEL.wall, { invisible: true });
    }
    {
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.65, 7.75, 48).rotateX(-Math.PI / 2), glassMat(PASTEL.wall, 0.35));
      ring.position.set(D.x, D.y + 4.0, D.z);
      ring.renderOrder = 2;
      ctx.scene.add(ring);
    }

    // ── 출구 / 결승 접시 ──
    const rimLow = D.y - DISC_R * Math.sin(DISC_TILT);
    const exit = new THREE.Vector3(E.x, rimLow - 0.9, E.z + GR);
    const pad = exit.clone().add(new THREE.Vector3(0, -5, 0));

    // ── 결승 아치 장식(양쪽) ──
    const colors = [PASTEL.coral, PASTEL.yellow, PASTEL.teal, PASTEL.blue, PASTEL.violet, PASTEL.orange];
    for (const sgn of [1, -1]) {
      const z = pad.z + sgn * 11.4;
      kit.deco(new THREE.TorusGeometry(9, 0.55, 12, 48, Math.PI), new THREE.Vector3(pad.x, pad.y, z), undefined, sgn > 0 ? PASTEL.pink : PASTEL.lemon);
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI;
        kit.deco(new THREE.SphereGeometry(0.8, 16, 12), new THREE.Vector3(pad.x + Math.cos(a) * 9, pad.y + Math.sin(a) * 9, z), undefined, colors[(i + (sgn > 0 ? 0 : 3)) % colors.length]);
      }
      for (const sx of [-9, 9]) {
        kit.deco(new THREE.CylinderGeometry(0.9, 1.1, 1.2, 16), new THREE.Vector3(pad.x + sx, pad.y + 0.6, z), undefined, PASTEL.violet);
      }
    }
    // 아치 사이를 잇는 깃발 줄(공 장식)
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      kit.deco(new THREE.SphereGeometry(0.5, 12, 10), new THREE.Vector3(pad.x + Math.cos(a) * 13, pad.y + 4.5, pad.z + Math.sin(a) * 13), undefined, colors[i % colors.length]);
    }

    // ── 중심선 ──
    const cl: THREE.Vector3[] = [E.clone()];
    const coneAt = (r: number) => new THREE.Vector3(E.x, E.y - (R_OUT - r) * Math.tan(FUN) + 0.6, E.z + r);
    cl.push(coneAt(7), coneAt(R_IN + 0.5));
    cl.push(D.clone().add(new THREE.Vector3(0, 0.6, 0)));
    const rimPt = D.clone().add(new THREE.Vector3(0, -DISC_R * Math.sin(DISC_TILT) + 0.6, DISC_R * Math.cos(DISC_TILT)));
    cl.push(rimPt, exit.clone());
    const centerline = densify(cl);

    const dc = D.clone();
    const hotspots = [
      {
        name: 'turntable',
        center: dc,
        radius: 12,
        shot: { name: 'turntable', position: dc.clone().add(new THREE.Vector3(26, 3, 12)), target: dc.clone().add(new THREE.Vector3(0, 0, 3)) },
      },
      {
        name: 'finish-arch',
        center: pad.clone(),
        radius: 14,
        shot: { name: 'finish-arch', position: pad.clone().add(new THREE.Vector3(-30, 8, 0)), target: pad.clone().add(new THREE.Vector3(0, 3, 0)) },
      },
    ];

    const q = new THREE.Quaternion();
    const qSpin = new THREE.Quaternion();
    const tmp = new THREE.Vector3();
    return {
      exit,
      centerline,
      hotspots,
      update(t) {
        // 각속도 0.15~0.75 rad/s로 느릿하게 변하는 회전(림 최대 약 4.5 m/s)
        qSpin.setFromAxisAngle(Y, 0.45 * t + 0.5 * Math.sin(0.6 * t));
        q.copy(qTilt).multiply(qSpin);
        kit.drive(disc.body, disc.mesh, discPos, q);
        for (const { peg, local } of pegs) {
          tmp.copy(local).applyQuaternion(q).add(D);
          kit.drive(peg.body, peg.mesh, tmp.clone(), q);
        }
      },
    };
  },
};
