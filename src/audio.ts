// 배경음악(PM 소유). CC0 곡 3개(public/audio/CREDITS.md). 장면별 교차 페이드.
// 접근성 1.4.2: 첫 사용자 입력 전에는 재생하지 않고, 음소거·볼륨을 UI에서 제어한다(설정은 localStorage).
import type { AudioState, Phase, WinMode } from './types';

type Track = 'lobby' | 'race' | 'climax';
const SRC: Record<Track, string> = {
  lobby: 'audio/lobby.mp3',
  race: 'audio/race.mp3',
  climax: 'audio/climax.mp3',
};
const FADE = 0.9; // 초
const LS = 'orb-derby:audio';

export function createMusic() {
  let state: AudioState = { muted: false, volume: 0.5 };
  try {
    const raw = localStorage.getItem(LS);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch {
    /* 저장 실패해도 동작 */
  }
  const els = {} as Record<Track, HTMLAudioElement>;
  const gain: Record<Track, number> = { lobby: 0, race: 0, climax: 0 };
  for (const k of Object.keys(SRC) as Track[]) {
    const a = new Audio(SRC[k]);
    a.loop = true;
    a.preload = k === 'lobby' ? 'auto' : 'none';
    els[k] = a;
  }
  let unlocked = false;
  let want: Track | null = 'lobby';

  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    for (const a of Object.values(els)) a.preload = 'auto';
    removeEventListener('pointerdown', unlock);
    removeEventListener('keydown', unlock);
  };
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);

  const save = () => {
    try {
      localStorage.setItem(LS, JSON.stringify(state));
    } catch {
      /* noop */
    }
  };

  return {
    getState: (): AudioState => ({ ...state }),
    setMuted(m: boolean) {
      state.muted = m;
      save();
    },
    setVolume(v: number) {
      state.volume = Math.min(1, Math.max(0, v));
      save();
    },
    /** 매 프레임: 장면 판단 → 목표 곡으로 교차 페이드 */
    update(dt: number, phase: Phase, mode: WinMode, leaderProgress: number, unfinished: number, decided: boolean) {
      if (phase === 'lobby') want = 'lobby';
      else if (phase === 'countdown') want = 'race';
      else {
        const late = mode === 'first' ? leaderProgress >= 0.85 || decided : unfinished <= 3;
        want = late || phase === 'done' ? 'climax' : 'race';
      }
      const master = state.muted || !unlocked ? 0 : state.volume;
      for (const k of Object.keys(els) as Track[]) {
        const target = k === want ? 1 : 0;
        const step = dt / FADE;
        gain[k] = target > gain[k] ? Math.min(target, gain[k] + step) : Math.max(target, gain[k] - step);
        const a = els[k];
        a.volume = gain[k] * master;
        if (gain[k] > 0 && master > 0) {
          if (a.paused) {
            if (k !== 'lobby' && gain[k] < step * 2) a.currentTime = 0; // 새로 들어오는 곡은 처음부터
            a.play().catch(() => {});
          }
        } else if (!a.paused) a.pause();
      }
    },
  };
}
