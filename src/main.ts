// 코어(PM 소유): 렌더 루프, 물리 스텝, 구슬 생성, 순위·당첨 판정, 끼임·낙하 처리.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { buildCourse as buildLegacy } from './legacy-linear-course';
import { allSections, assembleCourse } from './course/registry';
import { createCameraDirector } from './camera';
import { createUI } from './ui';
import { startPartyHost } from './party/host';
import { createMusic } from './audio';
import type { EntryMode, PartyHost } from './types';
import { MARBLE_RADIUS, type Marble, type Phase, type RaceSnapshot, type WinMode } from './types';

const STEP = 1 / 60;
const STUCK_SPEED = 0.25;
const STUCK_TIME = 3; // 초. 이만큼 거의 정지하면 '끼임' → 낙하와 같이 체크포인트 복귀(캡틴 2026-11-12, 시간 제한 없음)
const SAME_CP_LIMIT = 3; // 같은 체크포인트로 연속 복귀 횟수 상한 → 넘으면 다음 체크포인트로(무한 레이스 방지)
const MAX_SPEED = 22; // m/s. 반지름 0.5 구슬이 한 스텝(1/60s)에 0.37m 이동 → 두께 0.5 충돌체를 못 뚫는 수준

await RAPIER.init();

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
// 해상도(캡틴: 사양 부담 → 낮춤). 기본 상한 1.25, ?quality=high면 2. 느리면 아래 자동 하향 단계로 내려간다.
const QUALITY_HIGH = new URLSearchParams(location.search).get('quality') === 'high';
const PR_STEPS = QUALITY_HIGH ? [2, 1.5, 1.25, 1] : [1.25, 1, 0.8];
let prStep = 0;
renderer.setPixelRatio(Math.min(devicePixelRatio, PR_STEPS[0]));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

// 구슬 이름표(캡틴 요청): CSS2D 라벨. 카메라에서 멀면 숨긴다(카메라가 따라가는 구슬은 예외)
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
Object.assign(labelRenderer.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
labelRenderer.domElement.setAttribute('aria-hidden', 'true');
app.appendChild(labelRenderer.domElement);
{
  const st = document.createElement('style');
  // 접근성(캡틴 지적 3): 글자는 항상 흰 배경 위 진한 색(대비 9.5:1). 구슬 색은 테두리(장식)로만 쓴다.
  // 완주는 색이나 투명도가 아니라 텍스트로도 구분한다(1.4.1). 선두 '주인공' 강조는 캡틴 요청으로 없앴다(라벨 크기 통일).
  // 위치: 구슬 꼭대기 위 LABEL_LIFT 지점에 라벨 중심, margin-top으로 살짝 더 띄운다.
  // 캡틴 요청: 알약 배경 없이 검은 글씨 + 하얀 외곽선. 대비는 외곽선(흰) 위 검정 21:1로 배경과 무관하게 확보.
  st.textContent = `.orb-label{font:800 14px/1.1 system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;color:#111;white-space:nowrap;margin-top:-12px;-webkit-text-stroke:3.5px #fff;paint-order:stroke fill;text-shadow:0 0 3px #fff}
.orb-label .tag{font-size:11px;margin-left:4px;color:#333}`;
  document.head.appendChild(st);
}
const LABEL_FAR = 45;
const LABEL_LIFT = MARBLE_RADIUS + 0.55; // 구슬 꼭대기 위로 띄우는 높이(월드 단위)
const labels = new Map<number, CSS2DObject>();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ff);
scene.fog = new THREE.Fog(0xbfe3ff, 120, 320);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);

scene.add(new THREE.HemisphereLight(0xffffff, 0xb0c4de, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(40, 80, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(QUALITY_HIGH ? 2048 : 1024, QUALITY_HIGH ? 2048 : 1024);
Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, far: 400 });
scene.add(sun);

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;
const qs = new URLSearchParams(location.search);
// 구간 파일이 하나라도 있으면 탑 조립, 없으면 예전 일자 코스. ?sections=a,b 로 일부 구간만 시험
const only = qs.get('sections')?.split(',').filter(Boolean);
const course = allSections().length ? assembleCourse(RAPIER, world, scene, only) : buildLegacy(RAPIER, world, scene);
const checkpoints = [...(course.checkpoints ?? [0, 0.25, 0.5, 0.75])].sort((a, b) => a - b);
const director = createCameraDirector(camera, renderer.domElement, course);
const ui = createUI(document.getElementById('ui')!);

let phase: Phase = 'lobby';
let mode: WinMode = 'first';
let marbles: Marble[] = [];
let raceT = 0;
let worldT = 0;
let countdownLeft = 0;
let finishCount = 0;
let doneTimer = 0;
/** 당첨 확정 구슬. 선착순은 1등 도착 즉시 확정되고 레이스는 전원 완주까지 계속된다(캡틴: 끝나면 전체 순위) */
let winnerM: Marble | null = null;
const stuckFor = new Map<number, number>();
const cpStreak = new Map<number, { cp: number; n: number }>();

const palette = (i: number, n: number) => {
  const c = new THREE.Color().setHSL((i / n + 0.03) % 1, 0.75, 0.58);
  return '#' + c.getHexString();
};

function clearMarbles() {
  for (const m of marbles) {
    world.removeRigidBody(m.body);
    scene.remove(m.mesh);
    const lb = labels.get(m.id);
    if (lb) {
      scene.remove(lb);
      lb.element.remove();
    }
    m.mesh.geometry.dispose();
    (m.mesh.material as THREE.Material).dispose();
  }
  marbles = [];
  labels.clear();
  stuckFor.clear();
  cpStreak.clear();
}

function spawn(names: string[]) {
  clearMarbles();
  const order = names.map((n, i) => ({ n, i })).sort(() => Math.random() - 0.5);
  order.forEach(({ n }, k) => {
    const base = course.spawnPoints[k % course.spawnPoints.length];
    const lap = Math.floor(k / course.spawnPoints.length);
    const pos = base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, lap * MARBLE_RADIUS * 2.4, (Math.random() - 0.5) * 0.3));
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCcdEnabled(true).setAngularDamping(0.2),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(MARBLE_RADIUS).setRestitution(0.45).setFriction(0.2).setDensity(1),
      body,
    );
    const color = palette(k, order.length);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(MARBLE_RADIUS, 24, 16),
      new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.1 }),
    );
    mesh.castShadow = true;
    mesh.position.copy(pos);
    scene.add(mesh);
    marbles.push({ id: k, name: n, color, body, mesh, progress: 0, finishedAt: null, place: null });
    const el = document.createElement('div');
    el.className = 'orb-label';
    el.setAttribute('aria-hidden', 'true'); // 움직이는 시각 장식 — 스크린리더 정보는 HUD 리더보드가 담당
    const nm = document.createElement('span');
    nm.textContent = n;
    const tag = document.createElement('span');
    tag.className = 'tag';
    el.append(nm, tag);
    const lb = new CSS2DObject(el);
    lb.position.copy(pos);
    scene.add(lb);
    labels.set(k, lb);
  });
}

function ranked(): Marble[] {
  return [...marbles].sort((a, b) => {
    if (a.place !== null || b.place !== null) return (a.place ?? Infinity) - (b.place ?? Infinity);
    return b.progress - a.progress;
  });
}

function snapshot(): RaceSnapshot {
  const r = ranked();
  let focus: Marble | null = null;
  // 선착순: 당첨 확정 뒤엔 아직 달리는 선두를 비춘다. 꼴등: 꼴찌 쪽 미완주자
  if (mode === 'first') focus = r.find((m) => m.place === null) ?? r[0] ?? null;
  else focus = [...r].reverse().find((m) => m.place === null) ?? r[r.length - 1] ?? null;
  return { phase, mode, t: raceT, ranked: r, focus, winner: winnerM };
}


const tmp = new THREE.Vector3();

/** 낙하·끼임 공통: 지나온 마지막 체크포인트로 복귀하고 진행도도 그 값으로 낮춘다(캡틴 결정). */
function returnToCheckpoint(m: Marble) {
  let i = -1;
  for (let k = 0; k < checkpoints.length; k++) if (checkpoints[k] <= m.progress) i = k;
  i = Math.max(0, i);
  const st = cpStreak.get(m.id);
  const n = st && st.cp === i ? st.n + 1 : 1;
  // 같은 체크포인트로 SAME_CP_LIMIT번 넘게 돌아오면 다음 체크포인트로 넘겨 준다
  if (n > SAME_CP_LIMIT && i + 1 < checkpoints.length) i++;
  cpStreak.set(m.id, { cp: i, n: n > SAME_CP_LIMIT ? 0 : n });
  const cp = checkpoints[i];
  const rp = course.respawnPoint(cp);
  m.body.setTranslation({ x: rp.x + (Math.random() - 0.5), y: rp.y, z: rp.z }, true);
  m.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  m.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  m.progress = cp;
  stuckFor.set(m.id, 0);
}

function physicsStep() {
  course.update(worldT, STEP);
  worldT += STEP;
  if (phase !== 'racing' && phase !== 'done') return; // 로비·카운트다운 중엔 구슬 정지
  world.step();
  raceT += STEP;

  for (const m of marbles) {
    const p = m.body.translation();
    tmp.set(p.x, p.y, p.z);
    if (m.place !== null) continue;
    if (course.isOut(tmp)) {
      returnToCheckpoint(m);
      continue;
    }
    // 터널링 방지: 속도 상한
    {
      const v = m.body.linvel();
      const sp = Math.hypot(v.x, v.y, v.z);
      if (sp > MAX_SPEED) {
        const k = MAX_SPEED / sp;
        m.body.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
      }
    }
    m.progress = Math.max(m.progress, course.progressOf(tmp));
    if (course.isFinished(tmp)) {
      m.place = ++finishCount;
      m.finishedAt = raceT;
      m.progress = 1;
      continue;
    }
    // 끼임: 느린 상태가 STUCK_TIME 이어지면 낙하와 똑같이 체크포인트 복귀
    const v = m.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    const s = speed < STUCK_SPEED ? (stuckFor.get(m.id) ?? 0) + STEP : 0;
    stuckFor.set(m.id, s);
    if (s > STUCK_TIME) returnToCheckpoint(m);
  }

  if (phase === 'racing') {
    const left = marbles.filter((m) => m.place === null);
    if (mode === 'first' && !winnerM && finishCount >= 1) winnerM = marbles.find((m) => m.place === 1) ?? null;
    if (mode === 'last' && left.length === 1) {
      // 마지막 한 명 = 꼴등 확정. 순위표를 완성하기 위해 꼴찌 순위를 부여한다
      const m = left[0];
      m.place = ++finishCount;
      m.finishedAt = null; // 실제 완주는 아님
      winnerM = m;
    }
    if (marbles.every((m) => m.place !== null)) {
      phase = 'done';
      doneTimer = 2.5; // 결과 띄우기 전 잠깐 여운
    }
  }
}

function startRace(names: string[], m: WinMode) {
  mode = m;
  raceT = 0;
  finishCount = 0;
  winnerM = null;
  spawn(names);
  phase = 'countdown';
  countdownLeft = 3.999;
  ui.showCountdown(3);
}

function toLobby() {
  director.follow?.(null);
  clearMarbles();
  phase = 'lobby';
  ui.showLobby(startRace);
}

ui.onToggleManual(() => director.setManual(!director.isManual()));
ui.onFollow?.((id) => director.follow?.(id));
const music = createMusic();
ui.onAudio?.((st) => {
  music.setMuted(st.muted);
  music.setVolume(st.volume);
  ui.setAudioState?.(music.getState());
});
ui.setAudioState?.(music.getState());
toLobby();

// QR 참가(P2P): 로비에서 'QR 참가' 탭일 때만 방을 연다(캡틴: 직접 입력 / QR 따로). 레이스 중에도 방은 유지되고
// 들어온 이름은 다음 판 명단에 들어간다. '직접 입력'으로 돌아오면 닫아 외부 시그널링 연결을 남기지 않는다.
let party: PartyHost | null = null;
let partyOpening: Promise<void> | null = null;
let entryMode: EntryMode = 'manual';
function openParty() {
  if (party || partyOpening) return;
  partyOpening = startPartyHost(
    (name) => ui.addParticipant?.(name) ?? { ok: false, reason: '진행자 화면이 참가를 받을 수 없습니다' },
    (st, msg) => ui.setJoinInfo?.(party?.info ?? null, st, msg),
  )
    .then((h) => {
      if (entryMode !== 'qr') return h.close(); // 여는 사이 탭이 바뀌었으면 닫는다
      party = h;
      ui.setJoinInfo?.(h.info, 'ready');
    })
    .catch((e) => {
      console.warn('[party]', e);
      ui.setJoinInfo?.(null, 'error', 'QR 방을 열지 못했어요. 잠시 뒤 다시 시도하세요');
    })
    .finally(() => (partyOpening = null));
}
function closeParty() {
  party?.close();
  party = null;
  ui.setJoinInfo?.(null, 'connecting');
}
ui.onEntryMode?.((m) => {
  entryMode = m;
  if (m === 'qr') openParty();
  else closeParty();
});

// ───────── 디버그 훅(검증용): ?auto=20&mode=last&speed=6 ─────────
let speed = Math.max(0.25, Number(qs.get('speed')) || 1);
ui.onSpeed?.((x) => (speed = Math.max(0, x))); // 0 = 일시정지(접근성 2.2.2)
const autoN = Number(qs.get('auto')) || 0;
if (autoN >= 2) startRace(Array.from({ length: autoN }, (_, i) => `P${i + 1}`), qs.get('mode') === 'last' ? 'last' : 'first');
(window as unknown as { __orb: unknown }).__orb = {
  gfx: () => ({ ...renderer.info.render, meshes: (() => { let n = 0, t = 0; scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { n++; const m = (o as THREE.Mesh).material as THREE.Material; if (m.transparent) t++; } }); return { n, transparent: t }; })() }),
  state: () => ({
    phase,
    t: raceT,
    ranked: ranked().map((m) => ({ name: m.name, place: m.place, progress: m.progress })),
  }),
  start: startRace,
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});

let acc = 0;
let last = performance.now();
let lastShownCount = 3;
let resultShown = false;
// 자동 품질 하향: 2초 평균 프레임이 22ms(약 45fps)를 넘으면 해상도를 한 단계 내리고, 마지막 단계에선 그림자를 끈다
let perfAcc = 0;
let perfN = 0;
function autoQuality(frameMs: number) {
  perfAcc += frameMs;
  if (++perfN < 120) return;
  const avg = perfAcc / perfN;
  perfAcc = 0;
  perfN = 0;
  if (avg <= 22) return;
  if (prStep < PR_STEPS.length - 1) {
    prStep++;
    renderer.setPixelRatio(Math.min(devicePixelRatio, PR_STEPS[prStep]));
    console.info(`[quality] 평균 ${avg.toFixed(1)}ms → pixelRatio ${PR_STEPS[prStep]}`);
  } else if (renderer.shadowMap.enabled) {
    renderer.shadowMap.enabled = false;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
    console.info(`[quality] 평균 ${avg.toFixed(1)}ms → 그림자 끔`);
  }
}

renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
  if (!document.hidden) autoQuality(now - last);
  last = now;

  if (phase === 'countdown') {
    countdownLeft -= dt;
    const n = Math.max(0, Math.ceil(countdownLeft));
    if (n !== lastShownCount) {
      ui.showCountdown(n);
      lastShownCount = n;
    }
    if (countdownLeft <= 0) {
      phase = 'racing';
      lastShownCount = 3;
      resultShown = false;
    }
  }

  acc += dt * (phase === 'racing' || phase === 'done' ? speed : 1);
  while (acc >= STEP) {
    physicsStep();
    acc -= STEP;
  }

  for (const m of marbles) {
    const p = m.body.translation();
    const r = m.body.rotation();
    m.mesh.position.set(p.x, p.y, p.z);
    m.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }

  const snap = snapshot();
  if (phase === 'racing') ui.updateHud(snap, director.isManual(), speed, director.following?.() ?? null);
  if (phase === 'done' && !resultShown) {
    doneTimer -= dt;
    ui.updateHud(snap, director.isManual(), speed, director.following?.() ?? null);
    if (doneTimer <= 0) {
      resultShown = true;
      ui.showResult(winnerM ?? snap.ranked[0], snap.ranked, mode, toLobby);
    }
  }
  director.update(dt, snap);
  music.update(dt, phase, mode, snap.ranked.find((m) => m.place === null)?.progress ?? 1, snap.ranked.filter((m) => m.place === null).length, winnerM !== null);
  for (const m of marbles) {
    const lb = labels.get(m.id);
    if (!lb) continue;
    lb.position.copy(m.mesh.position);
    lb.position.y += LABEL_LIFT;
    const isFocus = snap.focus?.id === m.id;
    // 카메라가 따라가는 구슬은 멀어도 이름을 보이게만 한다(모양은 다른 라벨과 같음)
    lb.visible = isFocus || m.mesh.position.distanceTo(camera.position) < LABEL_FAR;
    lb.element.classList.toggle('done', m.place !== null);
    const tagText = m.place !== null ? `${m.place}위 완주` : '';
    const tagEl = lb.element.lastElementChild as HTMLElement;
    if (tagEl.textContent !== tagText) tagEl.textContent = tagText;
  }
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});
