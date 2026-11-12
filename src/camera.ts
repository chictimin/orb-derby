// 워커 B: 자동 카메라 연출 디렉터 (방송 중계풍 샷 전환).
// 샷: overview(선회) / chase(추적) / pack(무리) / hotspot(고정 컷) / finish(결승 접전).
// 같은 샷 안에서는 지수 평활로 이동, 샷이 바뀌는 컷에서는 즉시 전환한다.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraDirector, Course, CreateCameraDirector, Marble, RaceSnapshot } from './types';

export type ShotKind = 'overview' | 'chase' | 'pack' | 'hotspot' | 'finish';

const MIN_HOLD = 2.5; // 샷 최소 유지(초). 이보다 잦은 컷 금지
const CHASE_MAX_HOLD = 10; // 추적샷이 이보다 길어지면 무리샷으로 환기
const PACK_MAX_HOLD = 8; // 무리샷이 이보다 길어지면 추적샷으로 복귀
const MIN_FOCUS_DIST = 3.5; // 구슬 최소 거리
const PACK_N = 5; // 무리샷에 담는 상위권 수
const FINISH_PROGRESS = 0.78; // 선두가 이 진행도를 넘으면 결승 컷 후보

// 코스 형태가 바뀌어도 동작하도록 고정된 월드 좌표가 아닌 상대 오프셋 위주로 둔다.
const PACK_DIR = new THREE.Vector3(0.55, 0.5, 0.85).normalize();
const FINISH_DIR = new THREE.Vector3(0.55, 0.45, 0.72).normalize();

function hotspotAt(course: Course, p: THREE.Vector3) {
  const hs = course.hotspots ?? [];
  let best: (typeof hs)[number] | null = null;
  let bestD = Infinity;
  for (const h of hs) {
    if (!h || !h.center || typeof h.radius !== 'number' || !h.shot) continue;
    const d = p.distanceTo(h.center);
    if (d <= h.radius && d < bestD) {
      best = h;
      bestD = d;
    }
  }
  return best;
}

export const createCameraDirector: CreateCameraDirector = (camera, dom, course) => {
  const controls = new OrbitControls(camera, dom);
  controls.enabled = false;
  controls.enableDamping = true;

  let manual = false;
  const curTarget = course.overviewShot.target.clone();
  camera.position.copy(course.overviewShot.position);
  camera.lookAt(curTarget);

  let shot: ShotKind = 'overview';
  let shotTime = 0;
  let orbitA = Math.atan2(
    camera.position.z - curTarget.z,
    camera.position.x - curTarget.x,
  );
  // 수동에서 자동 복귀 직후 1회는 스냅 대신 평활로 잇는다(점프 방지).
  let blendOnce = false;

  // 추적 방향(평활화된 focus 진행 방향)
  const dirS = new THREE.Vector3(0, 0, -1);
  const prevFocus = new THREE.Vector3();
  let lastFocusId: number | null = null;

  const desiredPos = new THREE.Vector3();
  const desiredTgt = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function trackDirection(dt: number, focus: Marble): void {
    const fp = focus.mesh.position;
    if (lastFocusId !== focus.id) {
      prevFocus.copy(fp);
      lastFocusId = focus.id;
      return;
    }
    if (dt <= 0) return;
    tmp.copy(fp).sub(prevFocus).divideScalar(dt);
    prevFocus.copy(fp);
    // 타워 코스 구간 사이 자유낙하 대응: 방향 추정은 수평 성분만으로 갱신한다.
    // 낙하 중(수평 속도 ≈ 0)에는 마지막 수평 방향을 유지해 카메라가 머리 위로 솟구치지 않고,
    // 카메라 높이(fp.y + 5.2 직접 추종)도 평활 없이 따라가 위아래 출렁임이 없다.
    tmp.y = 0;
    const spH = tmp.length();
    if (spH > 0.8) {
      tmp.divideScalar(spH);
      const k = 1 - Math.exp(-dt * 1.8);
      dirS.lerp(tmp, k);
      if (dirS.lengthSq() < 1e-6) dirS.set(0, 0, -1);
      dirS.normalize();
    }
  }

  function wantShot(snap: RaceSnapshot): ShotKind {
    if (snap.phase !== 'racing') return 'overview';
    const focus = snap.focus;
    if (!focus) return 'overview';
    const fp = focus.mesh.position;

    // 1) hotspot 컷: focus가 hotspot 반경 안에 들어오면 최우선
    if (hotspotAt(course, fp)) return 'hotspot';

    // 2) 결승 접전 컷: 선두가 결승 근처 + 2위와 박빙이면
    const r = snap.ranked;
    if (r.length > 0 && r[0].progress >= FINISH_PROGRESS) {
      if (r.length === 1) return 'finish';
      const gap = r[0].progress - r[1].progress;
      const dist = r[0].mesh.position.distanceTo(r[1].mesh.position);
      if (gap < 0.08 || dist < 14) return 'finish';
    }

    // 3) 환기: 한 샷을 너무 오래 유지하면 다른 샷으로
    if (shot === 'chase' && shotTime >= CHASE_MAX_HOLD) return 'pack';
    if (shot === 'pack' && shotTime >= PACK_MAX_HOLD) return 'chase';

    // 4) 무리샷: 상위권이 뭉쳐 있으면 함께 담기, 흩어져 있으면 추적샷
    const n = Math.min(PACK_N, r.length);
    if (n >= 2) {
      tmp.set(0, 0, 0);
      for (let i = 0; i < n; i++) tmp.add(r[i].mesh.position);
      tmp.divideScalar(n);
      let rad = 0;
      for (let i = 0; i < n; i++) rad = Math.max(rad, r[i].mesh.position.distanceTo(tmp));
      if (rad < 12) return 'pack';
    }
    return 'chase';
  }

  function computeDesired(dt: number, snap: RaceSnapshot): void {
    const focus = snap.focus;
    const fp = focus ? focus.mesh.position : null;

    if (shot === 'chase' && focus && fp) {
      desiredTgt.copy(fp);
      desiredTgt.y += 0.6;
      desiredPos.copy(fp).addScaledVector(dirS, -9.5);
      desiredPos.y = fp.y + 5.2;
    } else if (shot === 'pack' && snap.ranked.length > 0) {
      const n = Math.min(PACK_N, snap.ranked.length);
      desiredTgt.set(0, 0, 0);
      for (let i = 0; i < n; i++) desiredTgt.add(snap.ranked[i].mesh.position);
      desiredTgt.divideScalar(n);
      let rad = 0;
      for (let i = 0; i < n; i++) {
        rad = Math.max(rad, snap.ranked[i].mesh.position.distanceTo(desiredTgt));
      }
      const dist = THREE.MathUtils.clamp(7 + rad * 2.2, 11, 42);
      desiredPos.copy(desiredTgt).addScaledVector(PACK_DIR, dist);
    } else if (shot === 'hotspot' && focus && fp) {
      const h = hotspotAt(course, fp);
      if (h) {
        desiredPos.copy(h.shot.position);
        desiredTgt.copy(fp);
      } else {
        // 진입과 동시에 hotspot을 벗어난 경우 등: 무리샷 형태로 폴백
        desiredTgt.copy(fp);
        desiredPos.copy(fp).addScaledVector(PACK_DIR, 14);
      }
    } else if (shot === 'finish' && snap.ranked.length > 0) {
      const a = snap.ranked[0].mesh.position;
      const b = (snap.ranked[1] ?? snap.ranked[0]).mesh.position;
      desiredTgt.copy(a).lerp(tmp2.copy(b), 0.35);
      desiredTgt.y += 0.5;
      const sep = a.distanceTo(b);
      const s = THREE.MathUtils.clamp(8 + sep * 0.9, 9, 26);
      desiredPos.copy(desiredTgt).addScaledVector(FINISH_DIR, s);
    } else {
      // overview: overviewShot 주위를 천천히 선회
      const ov = course.overviewShot;
      orbitA += dt * 0.09;
      tmp.copy(ov.position).sub(ov.target);
      const R = Math.max(Math.hypot(tmp.x, tmp.z), 1);
      const H = Math.max(tmp.y, 2);
      desiredTgt.copy(ov.target);
      desiredPos.set(
        ov.target.x + Math.cos(orbitA) * R,
        ov.target.y + H,
        ov.target.z + Math.sin(orbitA) * R,
      );
    }
  }

  function clampCamera(snap: RaceSnapshot): void {
    // 바닥 아래로 내려가지 않게(타깃보다 최소 1 위, 월드 최소 높이)
    if (camera.position.y < curTarget.y + 1) camera.position.y = curTarget.y + 1;
    if (camera.position.y < 0.8) camera.position.y = 0.8;
    // 구슬에 너무 붙지 않게
    const fp = snap.focus ? snap.focus.mesh.position : null;
    if (fp) {
      const d = camera.position.distanceTo(fp);
      if (d < MIN_FOCUS_DIST && d > 1e-4) {
        tmp.copy(camera.position).sub(fp).normalize();
        camera.position.copy(fp).addScaledVector(tmp, MIN_FOCUS_DIST);
      }
    }
  }

  function update(dt: number, snap: RaceSnapshot): void {
    if (manual) {
      controls.update();
      curTarget.copy(controls.target);
      return;
    }
    if (dt < 0) dt = 0;

    if (snap.phase === 'racing' && snap.focus) trackDirection(dt, snap.focus);
    else {
      lastFocusId = null;
    }

    shotTime += dt;
    if (shotTime >= MIN_HOLD) {
      const w = wantShot(snap);
      if (w !== shot) {
        shot = w;
        shotTime = 0;
      }
    }

    computeDesired(dt, snap);

    const cut = shotTime === 0 && !blendOnce;
    if (cut) {
      // 컷: 즉시 전환
      camera.position.copy(desiredPos);
      curTarget.copy(desiredTgt);
    } else {
      // 같은 샷 안(또는 수동 복귀 직후): 지수 평활
      const kp = 1 - Math.exp(-dt * 3.2);
      const kt = 1 - Math.exp(-dt * 4.2);
      camera.position.lerp(desiredPos, kp);
      curTarget.lerp(desiredTgt, kt);
    }
    blendOnce = false;

    clampCamera(snap);
    camera.lookAt(curTarget);
  }

  function setManual(on: boolean): void {
    manual = on;
    controls.enabled = on;
    if (on) {
      controls.target.copy(curTarget);
    } else {
      // 자동 복귀: 현재 위치에서 부드럽게 이어가고 다음 프레임에 샷 재평가
      blendOnce = true;
      shotTime = MIN_HOLD;
    }
  }

  const director: CameraDirector = {
    update,
    setManual,
    isManual: () => manual,
  };
  // 현재 샷 이름 외부 노출(계약 외 부가 정보 — UI 표시용으로 읽을 수 있다)
  Object.defineProperty(director, 'shotName', {
    enumerable: true,
    get: () => (manual ? 'manual' : shot),
  });
  return director;
};
