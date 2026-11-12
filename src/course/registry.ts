/// <reference types="vite/client" />
// 구간 자동 수집(PM 소유). sections/*.ts 각 파일의 `export const section`을 모은다.
import type * as THREE from 'three';
import type { Course, Rapier, SectionDef, World } from '../types';
import { assembleFrom } from './assemble';

const mods = import.meta.glob<{ section: SectionDef }>('./sections/*.ts', { eager: true });

export function allSections(): SectionDef[] {
  return Object.values(mods)
    .map((m) => m.section)
    .filter(Boolean);
}

export function assembleCourse(R: Rapier, world: World, scene: THREE.Scene, only?: string[]): Course {
  return assembleFrom(allSections(), R, world, scene, only);
}
