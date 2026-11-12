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
  /**
   * 낙하 시 복귀할 체크포인트 진행도 목록(오름차순, 0 포함). 보통 각 장애물 구간 입구.
   * 코어는 isOut이면 '지나온 마지막 체크포인트'의 respawnPoint로 되돌리고 진행도도 그 값으로 낮춘다.
   * 없으면 [0, 0.25, 0.5, 0.75]를 쓴다.
   */
  checkpoints?: number[];
  /** 움직이는 장애물 갱신. 매 물리 스텝 전에 호출. t = 레이스 시작 후 누적 초(로비 중에도 증가) */
  update(t: number, dt: number): void;
  hotspots: Hotspot[];
  /** 전체 조망 샷(로비·결과 화면용) */
  overviewShot: CameraShot;
}
export type BuildCourse = (R: Rapier, world: World, scene: THREE.Scene) => Course;

// ───────── 구간(section) 계약 — src/course/sections/<이름>.ts 하나 = 구간 하나 ─────────
// 각 파일은 `export const section: SectionDef` 하나를 내보낸다. 조립기(src/course/assemble.ts, PM 소유)가
// import.meta.glob으로 자동 수집해 order 오름차순으로 이어 붙인다. 공유 레지스트리 파일은 없다.
//
// 탑 구조(캡틴 2026-11-12): 구간들을 위에서 아래로 쌓는다. 구간끼리 맞붙지 않고, 출구에서 떨어진 구슬을
// 다음 구간이 입구의 받침(깔때기·접시·넓은 판)으로 받는다.
//  - entry: 위에서 떨어지는 구슬이 들어오는 지점. 입구 받침은 entry 높이에 테두리 상단을 두고, entry의 xz를 중심으로
//    반경 CATCH_RADIUS 안에 떨어지는 구슬을 전부 받아야 한다.
//  - exit: 구슬이 아래로 떨어져 나가는 지점(구멍·끝단). 수평 속도가 크지 않게(<= 6 m/s) 내보낸다.
//    다음 구간 입구 = exit 바로 아래 DROP_GAP.
//  - 구간 높이(entry.y - exit.y) 15~35, 평면 범위는 entry xz 기준 반경 FOOTPRINT 이내(탑이 퍼지지 않게).
//  - 구간 안 구멍·함정문으로 떨어진 구슬은 아래 구간에 착지할 수 있다 → 진행도가 그곳 기준이 되어 '낙하 역전'이 된다.
//    허공으로 빠지면(어느 중심선에서도 30 이상) 코어가 체크포인트로 복귀시킨다.
//  - 충돌체 두께 >= 0.5 (터널링 방지). trimesh(두께 0)는 빠른 구간을 피하거나 뒷면에 얇은 cuboid를 덧댄다.
export const TOWER_TOP = 140;
export const DROP_GAP = 5;
export const CATCH_RADIUS = 7;
export const FOOTPRINT = 30;
/** @deprecated 탑 구조로 바뀌며 미사용 */
export const TRACK_WIDTH = 10;

export interface SectionCtx {
  R: Rapier;
  world: World;
  scene: THREE.Scene;
  /** 입구 받침 중심(월드). 위에서 구슬이 이 xz 주변(반경 CATCH_RADIUS)으로 떨어진다 */
  entry: THREE.Vector3;
}
export interface SectionBuilt {
  /** 출구(구슬이 아래로 떨어져 나가는 점). exit.y < entry.y */
  exit: THREE.Vector3;
  /** 입구→출구 중심선(바닥 위 약 0.6). 첫 점 ≈ entry, 끝 점 ≈ exit. 점 간격 <= 2. 진행도·리스폰에 쓰인다 */
  centerline: THREE.Vector3[];
  /**
   * 갈래 경로(선택). 구간 안에서 갈라졌다가 출구 전에 다시 합류하는 대체 루트들 — 지름길, 함정문 아래 낮은 트랙 등.
   * 각 루트는 중심선 점 배열이며, 루트 위 위치는 '루트 내 길이 비율'만큼 이 구간 진행도 범위에 선형 대응된다.
   * 즉 짧은 지름길은 같은 진행도를 빨리 지나간다. 루트 끝점은 본선 중심선 위 합류 지점 근처여야 한다.
   * 루트는 본선 시작 비율(fromFrac)·합류 비율(toFrac)을 지정한다(본선 길이 기준 0..1).
   * 구슬이 어떤 루트·본선에서도 30 이상 멀어지면 낙하로 보고 체크포인트 복귀.
   */
  routes?: { name: string; points: THREE.Vector3[]; fromFrac: number; toFrac: number }[];
  hotspots: Hotspot[];
  /** 움직이는 장애물 구동(kinematic). 없으면 생략 */
  update?(t: number, dt: number): void;
  /** 출발 구간만: 구슬 출발 위치(20개 이상) */
  spawnPoints?: THREE.Vector3[];
}
export interface SectionDef {
  name: string;
  /** 배치 순서. 0 출발, 90 결승. 같은 숫자 금지 */
  order: number;
  build(ctx: SectionCtx): SectionBuilt;
}

// ───────── camera.ts (워커 B) ─────────
export interface RaceSnapshot {
  phase: Phase;
  mode: WinMode;
  /** 레이스 경과 초 */
  t: number;
  /** 진행도 내림차순 정렬(결승 통과자는 place 순으로 맨 앞) */
  ranked: Marble[];
  /** 카메라 주인공 — first 모드면 아직 달리는 선두, last 모드면 꼴찌 쪽 미완주자 */
  focus: Marble | null;
  /**
   * 당첨 확정 구슬. first: 1등 도착 즉시 확정되고 레이스는 전원 완주까지 계속(캡틴: 끝나면 전체 순위).
   * last: 한 명 남는 순간 확정(그 구슬 place = N, finishedAt = null). 확정 전 null.
   */
  winner: Marble | null;
}
export interface CameraDirector {
  update(dt: number, snap: RaceSnapshot): void;
  /** true면 자동 연출 정지, OrbitControls로 자유 조작 */
  setManual(on: boolean): void;
  isManual(): boolean;
  /** 참여자 시점(캡틴 요청): id의 구슬을 전용 추적샷으로 따라간다. null이면 자동 연출 복귀. 수동 모드보다 우선순위 낮음 */
  follow?(id: number | null): void;
  following?(): number | null;
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
  /** following: 현재 시점 고정 대상 구슬 id(없으면 null) — 리더보드에서 강조·해제 버튼 표시용 */
  updateHud(snap: RaceSnapshot, manual: boolean, speed?: number, following?: number | null): void;
  showResult(winner: Marble, ranked: Marble[], mode: WinMode, onRestart: () => void): void;
  /** HUD의 수동 카메라 토글 버튼 콜백 등록 */
  onToggleManual(cb: () => void): void;
  /** 참여자 시점 선택 콜백(리더보드 이름 클릭 등). null = 자동 연출 */
  onFollow?(cb: (id: number | null) => void): void;
  /** 배속 조절(캡틴). HUD에 일시정지/0.5x/1x/2x/4x 버튼. cb(배속), 0 = 일시정지. 현재 배속 표시용으로 updateHud의 speed 인자도 본다 */
  onSpeed?(cb: (x: number) => void): void;
}
export type CreateUI = (root: HTMLElement) => UI;

// ───────── QR 참가(P2P, PeerJS) — src/party/* (워커 rone) ─────────
// 진행자(로비)가 방 피어를 열고 QR(join.html?room=<roomId>)을 띄운다. 참가자 휴대폰이 join.html에서 이름을 보내면
// 진행자 UI 명단에 추가된다. 이름은 브라우저 간 DataConnection으로 직접 간다(PeerJS 공개 서버는 연결 중개만).
export interface JoinInfo {
  roomId: string;
  /** 참가 페이지 절대 URL(QR 내용) */
  url: string;
  /** QR 이미지 data URL */
  qrDataUrl: string;
  /** location이 localhost 등이라 휴대폰에서 못 여는 주소면 true(UI가 경고) */
  unreachable: boolean;
}
export type PartyStatus = 'connecting' | 'ready' | 'error';
/** 참가자 → 진행자 */
export type JoinMsg = { type: 'join'; name: string };
/** 진행자 → 참가자 */
export type JoinReply = { type: 'joined'; ok: boolean; reason?: string };
export interface PartyHost {
  info: JoinInfo;
  close(): void;
}
/**
 * 진행자 피어 시작. onJoin(name)이 {ok, reason}을 돌려주면 그대로 참가자에게 회신한다.
 * 방 ID 충돌(unavailable-id)이면 새 ID로 재시도. 서버 연결이 끊기면 재연결.
 */
export type StartPartyHost = (
  onJoin: (name: string) => { ok: boolean; reason?: string },
  onStatus: (s: PartyStatus, msg?: string) => void,
) => Promise<PartyHost>;

// UI(워커 B) 확장 — 선택 메서드
export interface UI {
  /** QR 참가자 추가. 중복 이름·40명 초과·빈 이름이면 ok:false + 사유 */
  addParticipant?(name: string): { ok: boolean; reason?: string };
  /** 로비에 QR·주소·상태 표시. info null이면 숨김 */
  setJoinInfo?(info: JoinInfo | null, status: PartyStatus, msg?: string): void;
  /**
   * 참가 방식 탭(캡틴: 직접 입력 / QR 참가 따로). 'qr' 탭으로 바뀔 때만 코어가 P2P 방을 열고, 'manual'로 돌아오면 닫는다.
   * UI는 로비 표시 시 현재 탭으로 한 번 호출해 초기 상태를 알린다.
   */
  onEntryMode?(cb: (m: EntryMode) => void): void;
}
export type EntryMode = 'manual' | 'qr';
