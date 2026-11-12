// 공유 계약(contract). 이 파일은 PM(코어) 소유다 — 워커는 수정하지 말고, 필요한 필드가 있으면 PM에게 요청한다.
import type RAPIER from '@dimforge/rapier3d-compat';
import type * as THREE from 'three';

export type Rapier = typeof RAPIER;
export type World = RAPIER.World;
export type WinMode = 'first' | 'last';
export type Phase = 'lobby' | 'countdown' | 'racing' | 'done';

export const MARBLE_RADIUS = 0.5;

export interface Marble {
  id: number;
  name: string;
  color: string; // css hex, 예: '#ff6b6b'
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  /** 코스 진행도 0..1 (course.progressOf 결과, 단조 증가로 보정됨) */
  progress: number;
  /** 결승 통과 시각(레이스 시작 기준 초). 미통과면 null */
  finishedAt: number | null;
  /** 결승 순서 1부터. 미통과면 null */
  place: number | null;
}

export interface CameraShot {
  name: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface Hotspot {
  /** 장애물 구간 이름(예: 'spinner') — 카메라 컷 전환용 */
  name: string;
  center: THREE.Vector3;
  radius: number;
  /** 이 구간을 잘 보여주는 고정 카메라 위치 */
  shot: CameraShot;
}

// ───────── course.ts (워커 A) ─────────
export interface Course {
  /** 출발 지점 후보. 구슬 수보다 적으면 코어가 지터를 줘서 재사용한다 */
  spawnPoints: THREE.Vector3[];
  /** 월드 좌표 → 진행도 0..1. 결승선 = 1 */
  progressOf(p: THREE.Vector3): number;
  /** 결승 판정 */
  isFinished(p: THREE.Vector3): boolean;
  /** 코스 이탈(낙하) 판정. true면 코어가 respawnPoint(progress)로 되돌린다 */
  isOut(p: THREE.Vector3): boolean;
  /** 진행도에 해당하는 코스 중심선 위 리스폰 위치 */
  respawnPoint(progress: number): THREE.Vector3;
  /** 움직이는 장애물 갱신. 매 물리 스텝 전에 호출. t = 레이스 시작 후 누적 초(로비 중에도 증가) */
  update(t: number, dt: number): void;
  hotspots: Hotspot[];
  /** 전체 조망 샷(로비·결과 화면용) */
  overviewShot: CameraShot;
}
export type BuildCourse = (R: Rapier, world: World, scene: THREE.Scene) => Course;

// ───────── camera.ts (워커 B) ─────────
export interface RaceSnapshot {
  phase: Phase;
  mode: WinMode;
  /** 레이스 경과 초 */
  t: number;
  /** 진행도 내림차순 정렬(결승 통과자는 place 순으로 맨 앞) */
  ranked: Marble[];
  /** 현재 판정상 '당첨 후보' — first 모드면 선두, last 모드면 꼴찌 쪽 미완주자 */
  focus: Marble | null;
}
export interface CameraDirector {
  update(dt: number, snap: RaceSnapshot): void;
  /** true면 자동 연출 정지, OrbitControls로 자유 조작 */
  setManual(on: boolean): void;
  isManual(): boolean;
}
export type CreateCameraDirector = (
  camera: THREE.PerspectiveCamera,
  dom: HTMLElement,
  course: Course,
) => CameraDirector;

// ───────── ui.ts (워커 B) ─────────
export interface UI {
  /** 로비 표시. 시작 버튼 누르면 cb(이름 목록, 모드) */
  showLobby(onStart: (names: string[], mode: WinMode) => void): void;
  showCountdown(n: number): void; // 3,2,1,0(=GO). 0 다음엔 사라짐
  updateHud(snap: RaceSnapshot, manual: boolean): void;
  showResult(winner: Marble, ranked: Marble[], mode: WinMode, onRestart: () => void): void;
  /** HUD의 수동 카메라 토글 버튼 콜백 등록 */
  onToggleManual(cb: () => void): void;
}
export type CreateUI = (root: HTMLElement) => UI;
