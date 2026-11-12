// PM 진단용: 각 구간 entry/exit 좌표 출력
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DROP_GAP, TOWER_TOP, type SectionDef } from '../src/types';
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const scene = new THREE.Scene();
const dir = join(import.meta.dirname, '../src/course/sections');
const defs: SectionDef[] = [];
for (const f of readdirSync(dir)) defs.push((await import(pathToFileURL(join(dir, f)).href)).section);
defs.sort((a, b) => a.order - b.order);
let entry = new THREE.Vector3(0, TOWER_TOP, 0);
for (const d of defs) {
  const b = d.build({ R: RAPIER, world, scene, entry: entry.clone() });
  const f = (v: THREE.Vector3) => `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`;
  console.log(d.name.padEnd(8), 'entry', f(entry), 'exit', f(b.exit));
  entry = b.exit.clone().add(new THREE.Vector3(0, -DROP_GAP, 0));
}
console.log('finish pad', `(${entry.x.toFixed(1)}, ${entry.y.toFixed(1)}, ${entry.z.toFixed(1)}) r=10`);
