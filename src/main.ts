// 코어(PM 소유): 렌더 루프, 물리 스텝, 구슬 생성, 순위·당첨 판정, 끼임·낙하 처리.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { buildCourse } from './course';
import { createCameraDirector } from './camera';
import { createUI } from './ui';
import { MARBLE_RADIUS, type Marble, type Phase, type RaceSnapshot, type WinMode } from './types';

const STEP = 1 / 60;
const RACE_TIMEOUT = 150; // 초. 꼴등 모드에서 끝까지 안 들어오는 구슬 대비
const STUCK_SPEED = 0.25;
const STUCK_TIME = 3;

await RAPIER.init();

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ff);
scene.fog = new THREE.Fog(0xbfe3ff, 120, 320);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);

scene.add(new THREE.HemisphereLight(0xffffff, 0xb0c4de, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(40, 80, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, far: 400 });
scene.add(sun);

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;
const course = buildCourse(RAPIER, world, scene);
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
const stuckFor = new Map<number, number>();

const palette = (i: number, n: number) => {
  const c = new THREE.Color().setHSL((i / n + 0.03) % 1, 0.75, 0.58);
  return '#' + c.getHexString();
};

function clearMarbles() {
  for (const m of marbles) {
    world.removeRigidBody(m.body);
    scene.remove(m.mesh);
    m.mesh.geometry.dispose();
    (m.mesh.material as THREE.Material).dispose();
  }
  marbles = [];
  stuckFor.clear();
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
  if (mode === 'first') focus = r[0] ?? null;
  else focus = [...r].reverse().find((m) => m.place === null) ?? r[r.length - 1] ?? null;
  return { phase, mode, t: raceT, ranked: r, focus };
}

function winner(r: Marble[]): Marble {
  if (mode === 'first') return r[0];
  return r[r.length - 1];
}

const tmp = new THREE.Vector3();
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
      const rp = course.respawnPoint(Math.max(0, m.progress - 0.02));
      m.body.setTranslation(rp, true);
      m.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      m.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      continue;
    }
    m.progress = Math.max(m.progress, course.progressOf(tmp));
    if (course.isFinished(tmp)) {
      m.place = ++finishCount;
      m.finishedAt = raceT;
      m.progress = 1;
      continue;
    }
    // 끼임 방지: 느린 상태가 STUCK_TIME 이어지면 무작위 충격
    const v = m.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    const s = speed < STUCK_SPEED ? (stuckFor.get(m.id) ?? 0) + STEP : 0;
    stuckFor.set(m.id, s);
    if (s > STUCK_TIME) {
      const mass = m.body.mass();
      m.body.applyImpulse({ x: (Math.random() - 0.5) * 4 * mass, y: 4 * mass, z: (Math.random() - 0.5) * 4 * mass }, true);
      stuckFor.set(m.id, 0);
    }
  }

  if (phase === 'racing') {
    const unfinished = marbles.filter((m) => m.place === null).length;
    const decided =
      (mode === 'first' && finishCount >= 1) ||
      (mode === 'last' && unfinished <= 1) ||
      raceT > RACE_TIMEOUT;
    if (decided) {
      phase = 'done';
      doneTimer = 2.5; // 결과 띄우기 전 잠깐 여운
    }
  }
}

function startRace(names: string[], m: WinMode) {
  mode = m;
  raceT = 0;
  finishCount = 0;
  spawn(names);
  phase = 'countdown';
  countdownLeft = 3.999;
  ui.showCountdown(3);
}

function toLobby() {
  clearMarbles();
  phase = 'lobby';
  ui.showLobby(startRace);
}

ui.onToggleManual(() => director.setManual(!director.isManual()));
toLobby();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let acc = 0;
let last = performance.now();
let lastShownCount = 3;
let resultShown = false;
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
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

  acc += dt;
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
  if (phase === 'racing') ui.updateHud(snap, director.isManual());
  if (phase === 'done' && !resultShown) {
    doneTimer -= dt;
    ui.updateHud(snap, director.isManual());
    if (doneTimer <= 0) {
      resultShown = true;
      ui.showResult(winner(snap.ranked), snap.ranked, mode, toLobby);
    }
  }
  director.update(dt, snap);
  renderer.render(scene, camera);
});
