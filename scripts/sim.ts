// 헤드리스 시뮬레이터(PM 소유). 브라우저 없이 구슬을 굴려 완주·낙하·끼임·구간별 시간을 잰다.
// 사용: npx tsx scripts/sim.ts [--sections a,b] [--n 20] [--runs 3] [--timeout 150]
//  --legacy: src/legacy-linear-course.ts를 쓴다. 기본은 src/course/sections/*.ts 조립.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { assembleFrom } from '../src/course/assemble';
import { MARBLE_RADIUS, type Course, type SectionDef } from '../src/types';

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const N = Number(arg('n', '20'));
const RUNS = Number(arg('runs', '3'));
const TIMEOUT = Number(arg('timeout', '150'));
const ONLY = arg('sections', '').split(',').filter(Boolean);
const LEGACY = process.argv.includes('--legacy');
const STEP = 1 / 60;
const MAX_SPEED = 22;

await RAPIER.init();

async function loadSections(): Promise<SectionDef[]> {
  const dir = join(import.meta.dirname, '../src/course/sections');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  const out: SectionDef[] = [];
  for (const f of files) {
    const m = await import(pathToFileURL(join(dir, f)).href);
    if (m.section) out.push(m.section);
  }
  return out;
}

async function run(seed: number) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  const scene = new THREE.Scene();
  let course: Course;
  if (LEGACY) course = (await import('../src/legacy-linear-course')).buildCourse(RAPIER, world, scene);
  else course = assembleFrom(await loadSections(), RAPIER, world, scene, ONLY);
  const cps = [...(course.checkpoints ?? [0, 0.25, 0.5, 0.75])].sort((a, b) => a - b);

  let rnd = seed * 9301 + 49297;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);

  const ms = Array.from({ length: N }, (_, k) => {
    const b = course.spawnPoints[k % course.spawnPoints.length];
    const lap = Math.floor(k / course.spawnPoints.length);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(b.x + (rand() - 0.5) * 0.3, b.y + lap * 1.2, b.z + (rand() - 0.5) * 0.3)
        .setCcdEnabled(true)
        .setAngularDamping(0.2),
    );
    world.createCollider(RAPIER.ColliderDesc.ball(MARBLE_RADIUS).setRestitution(0.45).setFriction(0.2), body);
    return { k, body, progress: 0, fin: null as number | null, outs: 0, kicks: 0, stuck: 0, early: 0 };
  });

  const p = new THREE.Vector3();
  let t = 0;
  let wt = 0;
  while (t < TIMEOUT && ms.some((m) => m.fin === null)) {
    course.update(wt, STEP);
    wt += STEP;
    world.step();
    t += STEP;
    for (const m of ms) {
      if (m.fin !== null) continue;
      const q = m.body.translation();
      p.set(q.x, q.y, q.z);
      if (course.isOut(p)) {
        const cp = cps.filter((c) => c <= m.progress).pop() ?? 0;
        m.body.setTranslation(course.respawnPoint(cp), true);
        m.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        m.progress = cp;
        m.outs++;
        continue;
      }
      const v = m.body.linvel();
      const sp = Math.hypot(v.x, v.y, v.z);
      if (sp > MAX_SPEED) m.body.setLinvel({ x: (v.x * MAX_SPEED) / sp, y: (v.y * MAX_SPEED) / sp, z: (v.z * MAX_SPEED) / sp }, true);
      m.progress = Math.max(m.progress, course.progressOf(p));
      if (t < 5.01 && t > 4.99) m.early = m.progress;
      if (course.isFinished(p)) {
        m.fin = t;
        continue;
      }
      m.stuck = sp < 0.25 ? m.stuck + STEP : 0;
      if (m.stuck > 3) {
        const mass = m.body.mass();
        m.body.applyImpulse({ x: (rand() - 0.5) * 4 * mass, y: 4 * mass, z: (rand() - 0.5) * 4 * mass }, true);
        m.stuck = 0;
        m.kicks++;
      }
    }
  }
  // 5초 시점 순위 vs 최종 순위 스피어만 상관(역전 지표: 낮을수록 운 요소 큼)
  const finalRank = [...ms].sort((a, b) => (a.fin ?? 1e9) - (b.fin ?? 1e9) || b.progress - a.progress).map((m) => m.k);
  const earlyRank = [...ms].sort((a, b) => b.early - a.early).map((m) => m.k);
  const r1 = new Map(finalRank.map((k, i) => [k, i]));
  const d2 = earlyRank.reduce((s, k, i) => s + (i - r1.get(k)!) ** 2, 0);
  const rho = 1 - (6 * d2) / (N * (N * N - 1));
  const fins = ms.filter((m) => m.fin !== null).map((m) => m.fin!) as number[];
  return {
    finished: `${fins.length}/${N}`,
    first: fins.length ? Math.min(...fins).toFixed(1) : '-',
    last: fins.length === N ? Math.max(...fins).toFixed(1) : `미완주(${N - fins.length}, 진행도 ${ms.filter((m) => m.fin === null).map((m) => m.progress.toFixed(2)).join(',')})`,
    outs: ms.reduce((s, m) => s + m.outs, 0),
    kicks: ms.reduce((s, m) => s + m.kicks, 0),
    rho: rho.toFixed(2),
  };
}

for (let i = 0; i < RUNS; i++) console.log(`run${i + 1}`, JSON.stringify(await run(i + 1)));
