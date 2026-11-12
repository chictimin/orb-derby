// 워커 B: 파티 게임풍 한국어 UI (파스텔·둥근 모서리·두꺼운 글자).
// 이름은 전부 textContent로 넣어 HTML 주입을 방지한다. CSS는 <style>로 주입.
import { getLang, onLangChange, setLang, t, type Lang } from './i18n';
import type { AudioState, CreateUI, EntryMode, JoinInfo, Marble, PartyStatus, RaceSnapshot, WinMode } from './types';

const LS_KEY = 'orb-derby:names';
const HUD_N = 8;
const HUD_THROTTLE_MS = 150;
const MAX_NAMES = 40;

const CSS = `
.odb-panel,.odb-panel *{box-sizing:border-box}
.odb-panel{position:absolute;font-family:system-ui,-apple-system,"Pretendard","Apple SD Gothic Neo",sans-serif;color:#4a3f55}
.odb-lobby{top:50%;left:50%;transform:translate(-50%,-50%);background:#fff7fb;border:4px solid #ffd1e3;border-radius:28px;padding:28px 30px;width:min(420px,calc(100vw - 32px));box-shadow:0 12px 40px rgba(255,143,178,.35);text-align:center}
.odb-eyebrow{font-size:13px;font-weight:800;letter-spacing:2px;color:#c23375;margin:0 0 6px}
.odb-headline{font-size:40px;font-weight:900;letter-spacing:1px;margin:0 0 4px;color:#e0508a}
.odb-sub{font-size:14px;font-weight:700;color:#6b5c78;margin:0 0 14px}
.odb-label{display:block;font-size:13px;font-weight:800;color:#7a6a85;text-align:left;margin:10px 0 6px}
.odb-names{width:100%;min-height:130px;resize:vertical;border:3px solid #ffe0ec;border-radius:16px;padding:10px 12px;font-size:15px;font-weight:700;color:#4a3f55;background:#fffdfd;outline:none}
.odb-names:focus{border-color:#ff9ec4;outline:3px solid #6a4fd8;outline-offset:1px}
.odb-modes{display:flex;gap:8px;margin:12px 0 4px}
.odb-firstwin{margin:12px 0 4px;text-align:left}
.odb-fwrow{display:flex;align-items:center;gap:10px;cursor:pointer}
.odb-fwrow input{position:absolute;opacity:0;width:1px;height:1px}
.odb-track{flex:0 0 auto;width:52px;height:30px;border-radius:999px;background:#e5ddff;position:relative;transition:background .15s}
.odb-track::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.2);transition:left .15s}
.odb-fwrow input:checked+.odb-track{background:#ff9ec4}
.odb-fwrow input:checked+.odb-track::after{left:25px}
.odb-fwrow input:focus-visible+.odb-track{outline:3px solid #6a4fd8;outline-offset:2px}
.odb-fwtext{font-size:15px;font-weight:900;color:#5a4f66}
.odb-fwsub{font-size:12px;font-weight:800;color:#a8245e;margin:6px 0 0 62px}
.odb-countline{font-size:12px;font-weight:800;color:#6b5c78;margin:6px 0 0;min-height:18px}
.odb-err{font-size:13px;font-weight:800;color:#d32f2f;margin:4px 0 0;min-height:20px}
.odb-start{margin-top:10px;width:100%;padding:13px 0;border:none;border-radius:999px;background:#e0508a;color:#fff;font-size:19px;font-weight:900;letter-spacing:1px;cursor:pointer;box-shadow:0 6px 0 #a8245e}
.odb-start:active{transform:translateY(3px);box-shadow:0 3px 0 #a8245e}
.odb-start:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
.odb-tabs{display:flex;gap:8px;margin:14px 0 4px}
.odb-tab{flex:1;padding:10px 0;border:3px solid transparent;border-radius:999px;background:#f3efff;color:#6b5c78;font-size:15px;font-weight:900;cursor:pointer}
.odb-tab.on{background:#ffe3ef;color:#a8245e;border-color:#ff9ec4}
.odb-chip{display:inline-flex;align-items:center;gap:6px;background:#fff;border:2px solid #e5ddff;border-radius:999px;padding:4px 6px 4px 12px;font-size:13px;font-weight:800;color:#4a3f55;margin:0 6px 6px 0}
.odb-chipx{border:none;background:#f3efff;color:#6b5c78;border-radius:50%;width:22px;height:22px;font-size:13px;font-weight:900;cursor:pointer;line-height:1}
.odb-chips{margin-top:8px}
.odb-qrclear{margin-top:4px;padding:7px 14px;border:2px solid #e5ddff;border-radius:999px;background:#fff;color:#6b5c78;font-size:12px;font-weight:900;cursor:pointer}
.odb-qrhint{font-size:13px;font-weight:800;color:#a8245e;margin:8px 0 0}
.odb-qrcount{font-size:12px;font-weight:800;color:#6b5c78;margin:10px 0 0}
.odb-audio{display:flex;align-items:center;gap:8px}
.odb-amute{border:2px solid #e5ddff;background:#fff;color:#6b5c78;border-radius:50%;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;padding:0}
.odb-avol{flex:1;accent-color:#6a4fd8;min-width:0}
.odb-avexpand{display:none;border:2px solid #e5ddff;background:#fff;color:#6b5c78;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
.odb-lobbyaudio{justify-content:center;margin-top:12px}
.odb-hudaudio{margin-top:10px}
.odb-lang{position:absolute;top:12px;right:14px;display:flex;border:2px solid #a8245e;border-radius:999px;overflow:hidden;background:#fff}
.odb-langbtn{border:none;background:#fff;color:#a8245e;font-size:12px;font-weight:900;padding:4px 10px;cursor:pointer;letter-spacing:.5px;line-height:1.2}
.odb-langbtn[aria-pressed=true]{background:#a8245e;color:#fff}
.odb-lobby .odb-eyebrow{margin-top:14px}
.odb-credit{font-size:11px;font-weight:700;color:#6b5c78;margin:8px 0 0;text-align:center}
.odb-credit a{color:#6a4fd8}
@media (max-width:640px){
.odb-audio .odb-avol{display:none}
.odb-audio.open .odb-avol{display:block}
.odb-audio .odb-avexpand{display:inline-block}}
.odb-count{top:38%;left:50%;transform:translate(-50%,-50%);font-size:min(120px,22vw);font-weight:900;color:#fff;text-shadow:0 6px 0 #e0508a,0 12px 32px rgba(224,80,138,.5);-webkit-text-stroke:3px #a8245e;paint-order:stroke fill}
.odb-hud{top:12px;left:12px;background:rgba(255,247,251,.94);border:3px solid #ffd1e3;border-radius:20px;padding:12px 14px;width:248px;box-shadow:0 6px 24px rgba(255,143,178,.3)}
.odb-hudhead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.odb-time{font-size:16px;font-weight:900;color:#c23375;font-variant-numeric:tabular-nums}
.odb-modelabel{min-width:0;font-size:11px;font-weight:900;color:#fff;background:#6a4fd8;border-radius:999px;padding:3px 10px;white-space:nowrap}
.odb-board{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;max-height:44vh;overflow:auto}
.odb-row{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;color:#5a4f66;background:#fff;border-radius:12px;padding:4px 9px;border:2px solid transparent;overflow:hidden}
.odb-row .odb-rank{flex:0 0 auto;min-width:34px;white-space:nowrap;font-variant-numeric:tabular-nums;color:#6b5c78}
.odb-row .odb-dot{flex:0 0 auto;width:13px;height:13px;border-radius:50%;box-shadow:inset -2px -2px 0 rgba(0,0,0,.18)}
.odb-row .odb-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.odb-row .odb-tag{flex:0 0 auto;font-size:10px;font-weight:900;border-radius:999px;padding:2px 7px}
.odb-tag-done{background:#d9f7e5;color:#13703c}
.odb-tag-focus{background:#ffe3ef;color:#a8245e}
.odb-row.odb-focus{border-color:#ff9ec4;background:#fff0f6}
.odb-row.odb-following{border-color:#c23375;background:#fff}
.odb-rowbtn{display:flex;align-items:center;gap:7px;width:100%;border:none;background:transparent;padding:0;font:inherit;color:inherit;cursor:pointer;text-align:left}
.odb-followchip{display:block;width:100%;margin-bottom:8px;padding:7px 10px;border:2px solid #c23375;border-radius:999px;background:#fff0f6;color:#a8245e;font-size:13px;font-weight:900;cursor:pointer}
.odb-panel summary:focus-visible{outline:3px solid #6a4fd8;outline-offset:2px}
.odb-panel input:focus-visible{outline:3px solid #6a4fd8;outline-offset:1px}
.odb-side{top:12px;right:12px;width:300px;z-index:40}
.odb-sidetoggle{display:none}
.odb-sidelist{list-style:none;margin:0;padding:0;display:grid;gap:0;max-height:calc(100vh - 80px)}
.odb-sidelist.cols2{grid-auto-flow:column;column-gap:14px}
.odb-siderowbtn{display:flex;align-items:center;gap:6px;width:100%;min-height:24px;border:none;background:transparent;padding:3px 4px 3px 7px;font-size:13px;font-weight:800;line-height:1.35;color:#111;cursor:pointer;text-align:left;-webkit-text-stroke:3px #fff;paint-order:stroke fill}
.odb-siderowbtn .odb-sidedot{flex:0 0 auto;width:10px;height:10px;border-radius:50%}
.odb-siderowbtn .odb-sidename{flex:0 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.odb-siderow.odb-mark > .odb-siderowbtn{box-shadow:inset 3px 0 0 #a8245e}
.odb-siderow.odb-mark .odb-sidename{text-decoration:underline;text-decoration-thickness:2px}
@media (max-width:760px){
.odb-side{width:min(260px,calc(100vw - 24px))}
.odb-sidetoggle{display:block;border:none;background:rgba(255,255,255,.92);color:#111;font-size:13px;font-weight:800;border-radius:999px;padding:8px 14px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25);white-space:nowrap}
.odb-sidelist{display:none}
.odb-side.open .odb-sidelist{display:block}
.odb-side.open .odb-sidelist{margin-top:4px}
}
.odb-cambtn{margin-top:10px;width:100%;padding:9px 0;border:none;border-radius:999px;background:#6a4fd8;color:#fff;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 4px 0 #5740b8}
.odb-cambtn:active{transform:translateY(2px);box-shadow:0 2px 0 #5740b8}
.odb-speeds{display:flex;gap:6px;margin-top:10px}
.odb-speed{flex:1;padding:7px 0;border:2px solid #e5ddff;border-radius:999px;background:#f3efff;color:#6b5c78;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;min-width:0}
.odb-speed-pause{flex:1.6 1 0}
.odb-speed.on{background:#6a4fd8;border-color:#6a4fd8;color:#fff}
.odb-winbanner{font-size:14px;font-weight:900;color:#fff;background:#c23375;border-radius:12px;padding:6px 10px;margin-bottom:8px;text-align:center;word-break:break-word}
.odb-rectime{flex:0 0 auto;font-size:12px;font-weight:800;color:#6b5c78;font-variant-numeric:tabular-nums}
.odb-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.odb-panel button:focus-visible{outline:3px solid #6a4fd8;outline-offset:2px}
.odb-result{top:50%;left:50%;transform:translate(-50%,-50%);background:#fff7fb;border:4px solid #ffd1e3;border-radius:28px;padding:28px 30px;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;box-shadow:0 12px 40px rgba(255,143,178,.35);text-align:center}
.odb-rlabel{font-size:15px;font-weight:900;color:#fff;background:#c23375;border-radius:999px;padding:5px 16px;display:inline-block;margin-bottom:10px}
.odb-winner{font-size:44px;font-weight:900;letter-spacing:-1px;margin:0 0 4px;word-break:break-word;color:#2a2230;text-decoration:underline;text-decoration-thickness:5px;text-underline-offset:6px}
.odb-winswatch{width:46px;height:46px;border-radius:50%;margin:0 auto 10px;box-shadow:inset -5px -5px 0 rgba(0,0,0,.18)}
.odb-rsub{font-size:14px;font-weight:800;color:#6b5c78;margin:0 0 14px}
.odb-rlist{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:4px;text-align:left;max-height:38vh;overflow:auto}
.odb-restart{width:100%;padding:13px 0;border:none;border-radius:999px;background:#1f7a4a;color:#fff;font-size:18px;font-weight:900;cursor:pointer;box-shadow:0 6px 0 #145c36}
.odb-restart:active{transform:translateY(3px);box-shadow:0 3px 0 #145c36}
.odb-qr{background:#fff;border:3px solid #c9b8ff;border-radius:20px;padding:12px;width:200px;text-align:center}
.odb-qrstatus{font-size:13px;font-weight:800;color:#6b5c78}
.odb-qrimg{width:100%;height:auto;background:#fff;border-radius:8px;display:block}
.odb-qrguide{font-size:13px;font-weight:900;color:#5a4f66;margin-top:8px}
.odb-qrcode{font-size:13px;font-weight:900;color:#c23375;margin-top:4px;font-variant-numeric:tabular-nums}
.odb-qrurl{font-size:10.5px;font-weight:700;color:#6b5c78;margin-top:6px;word-break:break-all;max-height:44px;overflow:hidden}
.odb-qrcopy{margin-top:8px;padding:7px 14px;border:none;border-radius:999px;background:#6a4fd8;color:#fff;font-size:12px;font-weight:900;cursor:pointer}
.odb-qrwarn{font-size:11.5px;font-weight:800;color:#d32f2f;margin-top:8px}
.odb-toast{top:14px;left:50%;transform:translateX(-50%);background:rgba(74,63,85,.95);color:#fff;font-size:14px;font-weight:900;padding:10px 20px;border-radius:999px;white-space:nowrap;max-width:calc(100vw - 32px);overflow:hidden;text-overflow:ellipsis;z-index:50}
.odb-winalert{top:34%;left:50%;transform:translate(-50%,-50%);background:#fff7fb;border:4px solid #ff9ec4;border-radius:24px;padding:20px 34px;text-align:center;box-shadow:0 16px 48px rgba(224,80,138,.4);animation:odb-winpop .3s ease-out;z-index:60;cursor:pointer;max-width:calc(100vw - 48px)}
.odb-winalertxt{font-size:30px;font-weight:900;color:#2a2230;margin:8px 0 0;word-break:break-word}
.odb-winalswatch{width:40px;height:40px;border-radius:50%;margin:0 auto;box-shadow:inset -4px -4px 0 rgba(0,0,0,.18)}
@keyframes odb-winpop{from{opacity:0;transform:translate(-50%,-50%) scale(.7)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@media (prefers-reduced-motion:reduce){.odb-winalert{animation:none}}
@media (min-width:920px){.odb-qr{position:absolute;left:calc(100% + 16px);top:0}}
@media (max-width:640px){
.odb-hud{width:200px;padding:9px 10px;top:8px;left:8px}
.odb-row{font-size:12px;padding:3px 7px}
.odb-winalertxt{font-size:24px}
.odb-speed{font-size:10px}
.odb-time{font-size:14px}
.odb-speed{font-size:11px}
.odb-lobby,.odb-result{padding:20px 18px}
.odb-headline{font-size:32px}
.odb-winner{font-size:34px}
}
@media (max-width:919px){
.odb-lobby{max-height:calc(100vh - 24px);overflow-y:auto}
.odb-qr{margin:14px auto 0}
}
`;

function el(tag: string, cls: string, parent: HTMLElement): HTMLElement {
  const d = document.createElement(tag);
  d.className = cls;
  parent.appendChild(d);
  return d;
}

function parseNames(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function loadSaved(): string {
  try {
    return localStorage.getItem(LS_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveNames(names: string[]): void {
  try {
    localStorage.setItem(LS_KEY, names.join('\n'));
  } catch {
    // 저장 실패해도 레이스는 동작한다
  }
}

const LS_MODE_KEY = 'orb-derby:firstwin';

function loadFirstWin(): boolean {
  try {
    const v = localStorage.getItem(LS_MODE_KEY);
    return v === null ? true : v !== '0';
  } catch {
    return true;
  }
}

function saveFirstWin(on: boolean): void {
  try {
    localStorage.setItem(LS_MODE_KEY, on ? '1' : '0');
  } catch {
    // 저장 실패해도 레이스는 동작한다
  }
}

const LS_QR_KEY = 'orb-derby:qr-names';
const LS_ENTRY_KEY = 'orb-derby:entry';

function loadQrNames(): string[] {
  try {
    const raw = localStorage.getItem(LS_QR_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is string => typeof v === 'string').map((s) => s.trim()).filter(Boolean).slice(0, MAX_NAMES);
  } catch {
    return [];
  }
}

function saveQrNames(names: string[]): void {
  try {
    localStorage.setItem(LS_QR_KEY, JSON.stringify(names));
  } catch {
    // 저장 실패해도 레이스는 동작한다
  }
}

function loadEntry(): EntryMode {
  try {
    return localStorage.getItem(LS_ENTRY_KEY) === 'qr' ? 'qr' : 'manual';
  } catch {
    return 'manual';
  }
}

function saveEntry(m: EntryMode): void {
  try {
    localStorage.setItem(LS_ENTRY_KEY, m);
  } catch {
    // 저장 실패해도 레이스는 동작한다
  }
}

export const createUI: CreateUI = (root) => {
  if (!document.getElementById('odb-style')) {
    const style = document.createElement('style');
    style.id = 'odb-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  let toggleCb: () => void = () => {};
  let speedCb: (x: number) => void = () => {};
  let followCb: (id: number | null) => void = () => {};
  let audioCb: (s: AudioState) => void = () => {};
  let audioMuted = false;
  let audioVolume = 0.5;
  // 언어 전환 시 다시 그릴 라벨 함수 목록. bind는 즉시 1회 실행하고 목록에 등록한다.
  const relabels: (() => void)[] = [];
  function bind(fn: () => void): void {
    fn();
    relabels.push(fn);
  }
  const audioSyncs: ((s: AudioState) => void)[] = [];
  function syncAudioControls(): void {
    const s = { muted: audioMuted, volume: audioVolume };
    audioSyncs.forEach((fn) => fn(s));
  }
  function pushAudio(s: AudioState): void {
    audioMuted = !!s.muted;
    audioVolume = Math.max(0, Math.min(1, s.volume));
    syncAudioControls();
    audioCb({ muted: audioMuted, volume: audioVolume });
  }

  // 음악 컨트롤(음소거 토글 + 볼륨 슬라이더). 로비·HUD에 각 1개씩 두어 같은 상태를 공유한다.
  const SVG_SND_ON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  const SVG_SND_OFF =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none"/><line x1="16" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="16" y2="15"/></svg>';
  function makeAudioControl(): { el: HTMLElement; sync: (s: AudioState) => void } {
    const box = document.createElement('div');
    box.className = 'odb-audio';
    const mute = document.createElement('button');
    mute.className = 'odb-amute';
    mute.setAttribute('aria-pressed', 'false');
    const iconOn = document.createElement('span');
    iconOn.innerHTML = SVG_SND_ON;
    iconOn.setAttribute('aria-hidden', 'true');
    const iconOff = document.createElement('span');
    iconOff.innerHTML = SVG_SND_OFF;
    iconOff.setAttribute('aria-hidden', 'true');
    iconOff.style.display = 'none';
    mute.appendChild(iconOn);
    mute.appendChild(iconOff);
    mute.onclick = () => pushAudio({ muted: !audioMuted, volume: audioVolume });
    const vol = document.createElement('input');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '100';
    vol.step = '1';
    vol.className = 'odb-avol';
    bind(() => vol.setAttribute('aria-label', t('audio.volume')));
    vol.oninput = () => {
      const v = Number(vol.value) / 100;
      pushAudio({ muted: v <= 0 ? audioMuted : false, volume: v });
    };
    const expand = document.createElement('button');
    expand.className = 'odb-avexpand';
    expand.setAttribute('aria-expanded', 'false');
    bind(() => {
      expand.textContent = t('audio.expandLabel');
      expand.setAttribute('aria-label', t('audio.expandAria'));
    });
    expand.onclick = () => {
      const open = box.classList.toggle('open');
      expand.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    box.appendChild(mute);
    box.appendChild(vol);
    box.appendChild(expand);
    function sync(s: AudioState): void {
      iconOn.style.display = s.muted ? 'none' : '';
      iconOff.style.display = s.muted ? '' : 'none';
      const label = s.muted ? t('audio.unmute') : t('audio.mute');
      mute.setAttribute('aria-label', label);
      mute.title = label;
      mute.setAttribute('aria-pressed', s.muted ? 'true' : 'false');
      vol.value = String(Math.round(Math.max(0, Math.min(1, s.volume)) * 100));
    }
    audioSyncs.push(sync);
    bind(() => sync({ muted: audioMuted, volume: audioVolume }));
    return { el: box, sync };
  }
  let shownFollowing: number | null = null;
  const SPEEDS = [0.5, 1, 2, 4];
  // 화면에 보이는 현재 배속(키보드 P/Space 일시정지·재개용). renderHud에서 갱신.
  let shownSpeed = 1;
  let lastNonZero = 1;
  const SPEED_BTNS: { x: number }[] = [{ x: 0 }, { x: 0.5 }, { x: 1 }, { x: 2 }, { x: 4 }];

  const lobbyEl = el('div', 'odb-panel odb-lobby', root);
  const countEl = el('div', 'odb-panel odb-count', root);
  const hudEl = el('div', 'odb-panel odb-hud', root);
  const resultEl = el('div', 'odb-panel odb-result', root);
  const toastEl = el('div', 'odb-panel odb-toast', root);
  toastEl.style.display = 'none';

  // 우승 순간 알림 카드(3초 뒤 자동 사라짐, 클릭·Esc로 즉시 닫기).
  // 스크린리더 안내는 기존 당첨 live 안내 1회로 충분하므로 카드는 aria-hidden이다.
  const winAlert = el('div', 'odb-panel odb-winalert', root);
  winAlert.style.display = 'none';
  winAlert.setAttribute('aria-hidden', 'true');
  bind(() => {
    winAlert.title = t('hud.alertTitle');
  });
  const winAlertSwatch = el('div', 'odb-winalswatch', winAlert);
  const winAlertText = el('p', 'odb-winalertxt', winAlert);
  let winAlertTimer = 0;
  function hideWinAlert(): void {
    window.clearTimeout(winAlertTimer);
    winAlert.style.display = 'none';
  }
  let alertState: { name: string; mode: WinMode } | null = null;
  function paintWinAlert(): void {
    if (!alertState) return;
    winAlertText.textContent = t(alertState.mode === 'first' ? 'alert.first' : 'alert.last', { name: alertState.name });
  }
  bind(paintWinAlert);
  function showWinAlert(m: Marble, mode: WinMode): void {
    winAlertSwatch.style.background = m.color;
    alertState = { name: m.name, mode };
    paintWinAlert();
    winAlert.style.display = '';
    window.clearTimeout(winAlertTimer);
    winAlertTimer = window.setTimeout(hideWinAlert, 3000);
  }
  winAlert.onclick = hideWinAlert;

  let toastTimer = 0;
  function showToast(text: string): void {
    toastEl.textContent = text;
    toastEl.style.display = '';
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.style.display = 'none';
    }, 2000);
  }

  // 스크린리더 안내 영역(시각적으로 숨김). 상태 변화가 있을 때만 알린다.
  const liveEl = el('div', 'odb-live', root);
  liveEl.setAttribute('role', 'status');
  liveEl.setAttribute('aria-live', 'polite');
  function announce(text: string): void {
    liveEl.textContent = '';
    window.setTimeout(() => {
      liveEl.textContent = text;
    }, 30);
  }

  // 레이스당 1회성 안내 추적
  let announcedWinnerId: number | null = null;
  const announcedPlaces = new Set<number>();
  function resetAnnounce(): void {
    announcedWinnerId = null;
    announcedPlaces.clear();
    hideWinAlert();
  }

  // ── 로비 ──
  // index.html은 PM 소유라 직접 고치지 않고 런타임에 문서 제목을 지정한다
  bind(() => {
    document.title = t('doc.title');
  });
  // 언어 토글 [KO | EN]
  const langBox = el('div', 'odb-lang', lobbyEl);
  langBox.setAttribute('role', 'group');
  const langBtns: [Lang, HTMLButtonElement][] = (['ko', 'en'] as Lang[]).map((l) => {
    const b = document.createElement('button');
    b.className = 'odb-langbtn';
    b.type = 'button';
    b.lang = l;
    b.textContent = l.toUpperCase();
    b.onclick = () => setLang(l);
    langBox.appendChild(b);
    return [l, b];
  });
  bind(() => {
    langBox.setAttribute('aria-label', t('lang.label'));
    for (const [l, b] of langBtns) {
      b.setAttribute('aria-pressed', getLang() === l ? 'true' : 'false');
      b.setAttribute('aria-label', t('lang.' + l));
    }
  });
  const eyebrow = el('p', 'odb-eyebrow', lobbyEl);
  bind(() => {
    eyebrow.textContent = t('lobby.eyebrow');
  });
  const headline = el('h1', 'odb-headline', lobbyEl);
  headline.textContent = 'ORB DERBY';
  const sub = el('p', 'odb-sub', lobbyEl);
  bind(() => {
    sub.textContent = t('lobby.sub');
  });

  const nameLabel = el('label', 'odb-label', lobbyEl) as HTMLLabelElement;
  bind(() => {
    nameLabel.textContent = t('lobby.namesLabel');
  });
  const area = document.createElement('textarea');
  area.className = 'odb-names';
  nameLabel.htmlFor = 'odb-names';
  area.id = 'odb-names';
  const saved = loadSaved();
  let curDefault = t('lobby.defaultNames');
  area.value = saved || curDefault;
  lobbyEl.appendChild(area);

  const modes = el('div', 'odb-firstwin', lobbyEl);
  const fwRow = document.createElement('label');
  fwRow.className = 'odb-fwrow';
  const fwCheck = document.createElement('input');
  fwCheck.type = 'checkbox';
  fwCheck.id = 'odb-firstwin';
  fwCheck.checked = loadFirstWin();
  fwCheck.setAttribute('role', 'switch');
  const fwTrack = document.createElement('span');
  fwTrack.className = 'odb-track';
  fwTrack.setAttribute('aria-hidden', 'true');
  const fwText = document.createElement('span');
  fwText.className = 'odb-fwtext';
  bind(() => {
    fwText.textContent = t('mode.first');
  });
  fwRow.appendChild(fwCheck);
  fwRow.appendChild(fwTrack);
  fwRow.appendChild(fwText);
  const fwSub = document.createElement('p');
  fwSub.className = 'odb-fwsub';
  bind(() => {
    fwSub.textContent = t('mode.last');
  });
  modes.appendChild(fwRow);
  modes.appendChild(fwSub);
  const refreshFwSub = () => {
    fwSub.style.display = fwCheck.checked ? 'none' : '';
  };
  fwCheck.addEventListener('change', refreshFwSub);
  refreshFwSub();

  const countLine = el('p', 'odb-countline', lobbyEl);
  const err = el('p', 'odb-err', lobbyEl);
  const refreshCount = () => {
    const n = parseNames(area.value).length;
    countLine.textContent = t('lobby.count', { n });
  };
  area.addEventListener('input', () => {
    err.textContent = '';
    refreshCount();
  });
  bind(refreshCount);
  bind(() => {
    if (err.textContent) err.textContent = t('lobby.minError');
  });

  const startBtn = document.createElement('button');
  startBtn.className = 'odb-start';
  bind(() => {
    startBtn.textContent = t('lobby.start');
  });
  lobbyEl.appendChild(startBtn);

  let startCb: (names: string[], mode: WinMode) => void = () => {};
  startBtn.onclick = () => {
    const firstWin = fwCheck.checked;
    saveFirstWin(firstWin);
    const mode: WinMode = firstWin ? 'first' : 'last';
    if (entryMode === 'qr') {
      // 버튼 비활성화로 이미 막혀 있으나 이중으로 확인
      if (qrNames.length < 2) return;
      const use = qrNames.slice(0, MAX_NAMES);
      saveQrNames(use);
      startCb(use, mode);
      return;
    }
    const names = parseNames(area.value);
    if (names.length < 2) {
      err.textContent = t('lobby.minError');
      return;
    }
    const use = names.slice(0, MAX_NAMES);
    // 기본 명단 그대로면 저장하지 않아 다음에도 언어를 따라가게 한다
    saveNames(use.join('\n') === t('lobby.defaultNames') ? [] : use);
    startCb(use, mode);
  };

  // ── QR 참가 패널 (넓은 화면: 로비 카드 오른쪽, 좁은 화면: 카드 안 아래) ──
  const qrEl = el('div', 'odb-qr', lobbyEl);
  qrEl.style.display = 'none';
  const qrStatus = el('div', 'odb-qrstatus', qrEl);
  const qrBody = el('div', 'odb-qrbody', qrEl);
  const qrImg = document.createElement('img');
  qrImg.className = 'odb-qrimg';
  bind(() => {
    qrImg.alt = t('qr.alt');
  });
  qrBody.appendChild(qrImg);
  const qrGuide = el('div', 'odb-qrguide', qrBody);
  bind(() => {
    qrGuide.textContent = t('qr.guide');
  });
  const qrCode = el('div', 'odb-qrcode', qrBody);
  const qrUrl = el('div', 'odb-qrurl', qrBody);
  const copyBtn = document.createElement('button');
  copyBtn.className = 'odb-qrcopy';
  let copyKey = 'qr.copy';
  bind(() => {
    copyBtn.textContent = t(copyKey);
  });
  copyBtn.onclick = () => {
    const txt = qrUrl.textContent ?? '';
    (async () => {
      try {
        await navigator.clipboard.writeText(txt);
        copyKey = 'qr.copied';
      } catch {
        copyKey = 'qr.copyFail';
      }
      copyBtn.textContent = t(copyKey);
      window.setTimeout(() => {
        copyKey = 'qr.copy';
        copyBtn.textContent = t(copyKey);
      }, 1500);
    })();
  };
  qrBody.appendChild(copyBtn);
  const qrWarn = el('div', 'odb-qrwarn', qrEl);
  bind(() => {
    qrWarn.textContent = t('qr.warn');
  });
  qrWarn.style.display = 'none';

  // ── 참가 방식 탭 [직접 입력 | QR 참가] ──
  let entryMode: EntryMode = loadEntry();
  let qrNames: string[] = loadQrNames();
  let entryCb: (m: EntryMode) => void = () => {};

  const tabsEl = document.createElement('div');
  tabsEl.className = 'odb-tabs';
  tabsEl.setAttribute('role', 'tablist');
  bind(() => tabsEl.setAttribute('aria-label', t('tabs.label')));
  const tabManual = document.createElement('button');
  tabManual.className = 'odb-tab';
  tabManual.setAttribute('role', 'tab');
  tabManual.setAttribute('aria-controls', 'odb-panel-manual');
  bind(() => {
    tabManual.textContent = t('tabs.manual');
  });
  const tabQr = document.createElement('button');
  tabQr.className = 'odb-tab';
  tabQr.setAttribute('role', 'tab');
  tabQr.setAttribute('aria-controls', 'odb-panel-qr');
  bind(() => {
    tabQr.textContent = t('tabs.qr');
  });
  tabsEl.appendChild(tabManual);
  tabsEl.appendChild(tabQr);
  lobbyEl.insertBefore(tabsEl, nameLabel);

  const manualPanel = document.createElement('div');
  manualPanel.id = 'odb-panel-manual';
  manualPanel.setAttribute('role', 'tabpanel');
  bind(() => manualPanel.setAttribute('aria-label', t('tabs.manual')));
  lobbyEl.insertBefore(manualPanel, nameLabel);
  manualPanel.appendChild(nameLabel);
  manualPanel.appendChild(area);
  manualPanel.appendChild(countLine);
  manualPanel.appendChild(err);

  const qrPanel = document.createElement('div');
  qrPanel.id = 'odb-panel-qr';
  qrPanel.setAttribute('role', 'tabpanel');
  bind(() => qrPanel.setAttribute('aria-label', t('tabs.qr')));
  lobbyEl.insertBefore(qrPanel, modes);
  qrPanel.appendChild(qrEl);
  const qrRosterLabel = el('div', 'odb-label', qrPanel);
  bind(() => {
    qrRosterLabel.textContent = t('qr.rosterLabel');
  });
  const qrCount = el('p', 'odb-qrcount', qrPanel);
  const qrChips = el('div', 'odb-chips', qrPanel);
  const qrClear = document.createElement('button');
  qrClear.className = 'odb-qrclear';
  bind(() => {
    qrClear.textContent = t('qr.clear');
  });
  qrPanel.appendChild(qrClear);
  const qrHint = el('p', 'odb-qrhint', qrPanel);
  bind(() => {
    qrHint.textContent = t('qr.hint');
  });

  function refreshStartState(): void {
    if (entryMode === 'qr') {
      const ok = qrNames.length >= 2;
      startBtn.disabled = !ok;
      qrHint.style.display = ok ? 'none' : '';
    } else {
      startBtn.disabled = false;
    }
  }

  function renderQrRoster(): void {
    qrChips.replaceChildren();
    qrNames.forEach((n, idx) => {
      const chip = document.createElement('span');
      chip.className = 'odb-chip';
      const lab = document.createElement('span');
      lab.textContent = n;
      const x = document.createElement('button');
      x.className = 'odb-chipx';
      x.textContent = '×';
      x.setAttribute('aria-label', t('qr.remove', { name: n }));
      x.onclick = () => {
        qrNames.splice(idx, 1);
        saveQrNames(qrNames);
        renderQrRoster();
      };
      chip.appendChild(lab);
      chip.appendChild(x);
      qrChips.appendChild(chip);
    });
    qrCount.textContent = t('lobby.count', { n: qrNames.length });
    refreshStartState();
  }

  qrClear.onclick = () => {
    qrNames = [];
    saveQrNames(qrNames);
    renderQrRoster();
  };

  // QR 패널은 QR 탭에서만 보인다. setJoinInfo가 저장한 마지막 상태를 탭 기준으로 다시 그린다.
  let lastJoin: { info: JoinInfo | null; status: PartyStatus; msg?: string } | null = null;
  function renderJoin(): void {
    const j = lastJoin;
    const show = !!j && (j.status === 'connecting' || j.status === 'error' || !!j.info);
    if (!show || entryMode !== 'qr') {
      qrEl.style.display = 'none';
      return;
    }
    qrEl.style.display = '';
    if (j.status === 'connecting') {
      qrStatus.style.display = '';
      qrStatus.textContent = t('qr.connecting');
      qrBody.style.display = 'none';
      qrWarn.style.display = 'none';
    } else if (j.status === 'error') {
      qrStatus.style.display = '';
      qrStatus.textContent = j.msg ? t(j.msg) : t('qr.failed');
      qrBody.style.display = 'none';
      qrWarn.style.display = 'none';
    } else if (j.info) {
      qrStatus.style.display = 'none';
      qrBody.style.display = '';
      qrImg.src = j.info.qrDataUrl;
      qrCode.textContent = t('qr.roomCode', { code: j.info.roomId.slice(-6) });
      qrUrl.textContent = j.info.url;
      qrWarn.style.display = j.info.unreachable ? '' : 'none';
    } else {
      qrBody.style.display = 'none';
      qrWarn.style.display = 'none';
    }
  }

  bind(renderQrRoster);
  bind(renderJoin);

  function paintTab(): void {
    const isManual = entryMode === 'manual';
    tabManual.classList.toggle('on', isManual);
    tabQr.classList.toggle('on', !isManual);
    tabManual.setAttribute('aria-selected', isManual ? 'true' : 'false');
    tabQr.setAttribute('aria-selected', !isManual ? 'true' : 'false');
    tabManual.tabIndex = isManual ? 0 : -1;
    tabQr.tabIndex = !isManual ? 0 : -1;
    manualPanel.style.display = isManual ? '' : 'none';
    qrPanel.style.display = !isManual ? '' : 'none';
  }

  function selectTab(m: EntryMode, focusTab = false): void {
    if (m === entryMode) {
      if (focusTab) (m === 'manual' ? tabManual : tabQr).focus();
      return;
    }
    entryMode = m;
    saveEntry(m);
    paintTab();
    renderJoin();
    refreshStartState();
    entryCb(m);
    if (focusTab) (m === 'manual' ? tabManual : tabQr).focus();
  }

  tabManual.onclick = () => selectTab('manual');
  tabQr.onclick = () => selectTab('qr');
  tabsEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    selectTab(entryMode === 'manual' ? 'qr' : 'manual', true);
  });

  // 로비 음악 컨트롤 + 크레딧
  const lobbyAudio = makeAudioControl();
  lobbyAudio.el.classList.add('odb-lobbyaudio');
  lobbyEl.appendChild(lobbyAudio.el);
  const credit = el('div', 'odb-credit', lobbyEl);
  const creditText = document.createTextNode('');
  credit.appendChild(creditText);
  bind(() => {
    creditText.data = t('audio.credit');
  });
  const creditLink = document.createElement('a');
  creditLink.href = 'audio/CREDITS.md';
  creditLink.target = '_blank';
  creditLink.rel = 'noopener';
  creditLink.textContent = 'CREDITS';
  credit.appendChild(creditLink);

  // ── 카운트다운 ──
  let countTimer = 0;
  function hideAll(): void {
    lobbyEl.style.display = 'none';
    countEl.style.display = 'none';
    hudEl.style.display = 'none';
    resultEl.style.display = 'none';
    sideEl.style.display = 'none';
  }

  // ── HUD (DOM은 한 번만 만들고 updateHud에서 내용만 갱신) ──
  const winBanner = el('div', 'odb-winbanner', hudEl);
  winBanner.style.display = 'none';
  const hudHead = el('div', 'odb-hudhead', hudEl);
  const timeEl = el('div', 'odb-time', hudHead);
  const modeEl = el('div', 'odb-modelabel', hudHead);
  const board = document.createElement('ol');
  board.className = 'odb-board';
  hudEl.appendChild(board);
  const rowEls: HTMLElement[] = [];
  for (let i = 0; i < HUD_N; i++) {
    const li = document.createElement('li');
    li.className = 'odb-row';
    const btn = document.createElement('button');
    btn.className = 'odb-rowbtn';
    btn.setAttribute('aria-pressed', 'false');
    const rank = document.createElement('span');
    rank.className = 'odb-rank';
    const dot = document.createElement('span');
    dot.className = 'odb-dot';
    dot.setAttribute('aria-hidden', 'true');
    const nm = document.createElement('span');
    nm.className = 'odb-name';
    btn.appendChild(rank);
    btn.appendChild(dot);
    btn.appendChild(nm);
    li.appendChild(btn);
    board.appendChild(li);
    rowEls.push(li);
  }
  let lastHudArgs: { snap: RaceSnapshot; manual: boolean; speed: number; following: number | null } | null = null;
  const camBtn = document.createElement('button');
  camBtn.className = 'odb-cambtn';
  camBtn.onclick = () => toggleCb();

  const speedsBox = document.createElement('div');
  speedsBox.className = 'odb-speeds';
  const speedBtns: HTMLButtonElement[] = SPEED_BTNS.map((s) => {
    const b = document.createElement('button');
    b.className = s.x === 0 ? 'odb-speed odb-speed-pause' : 'odb-speed';
    b.setAttribute('aria-pressed', 'false');
    b.onclick = () => speedCb(s.x);
    speedsBox.appendChild(b);
    return b;
  });
  bind(() =>
    speedBtns.forEach((b, i) => {
      const x = SPEED_BTNS[i].x;
      b.textContent = x === 0 ? t('hud.pause') : `${x}x`;
      b.setAttribute('aria-label', x === 0 ? t('hud.pauseAria') : t('hud.speedAria', { x }));
    }),
  );

  // 키보드 1~4 배속 전환, P/Space 일시정지·재개. 입력란 타이핑 중이거나 HUD가 닫혀 있으면 무시.
  // 포커스가 버튼 위일 때 Space는 네이티브 버튼 동작에 맡긴다.
  window.addEventListener('keydown', (e) => {
    // 우승 알림이 떠 있으면 Esc로 즉시 닫기
    if (e.key === 'Escape' && winAlert.style.display !== 'none') {
      hideWinAlert();
      return;
    }
    const ae = document.activeElement;
    const typing =
      !!ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT' || (ae as HTMLElement).isContentEditable);
    // M = 음소거 토글. 로비·HUD 어디서든 된다(입력란 포커스 중 제외).
    if ((e.key === 'm' || e.key === 'M') && !typing) {
      e.preventDefault();
      pushAudio({ muted: !audioMuted, volume: audioVolume });
      return;
    }
    if (hudEl.style.display === 'none') return;
    if (e.key === 'p' || e.key === 'P' || (e.key === ' ' && !typing)) {
      if (ae && ae.tagName === 'BUTTON') return;
      e.preventDefault();
      speedCb(shownSpeed === 0 ? lastNonZero : 0);
      return;
    }
    if (typing) return;
    const idx = ['1', '2', '3', '4'].indexOf(e.key);
    if (idx < 0) return;
    speedCb(SPEEDS[idx]);
  });

  hudEl.appendChild(camBtn);
  hudEl.appendChild(speedsBox);

  // HUD 음악 컨트롤(로비 것과 상태 공유)
  const hudAudio = makeAudioControl();
  hudAudio.el.classList.add('odb-hudaudio');
  hudEl.appendChild(hudAudio.el);

  // 시점 고정 칩(따라가는 구슬이 있을 때만) — 누르면 자동 연출로
  const followChip = document.createElement('button');
  followChip.className = 'odb-followchip';
  followChip.style.display = 'none';
  followChip.onclick = () => followCb(null);
  hudEl.insertBefore(followChip, board);

  // 우측 참가자 패널(레이스 중에만 표시). 배경·테두리·카드 없이 텍스트만.
  const sideEl = el('div', 'odb-panel odb-side', root);
  sideEl.style.display = 'none';
  const sideToggle = document.createElement('button');
  sideToggle.className = 'odb-sidetoggle';
  sideToggle.setAttribute('aria-expanded', 'false');
  sideToggle.setAttribute('aria-controls', 'odb-sidelist');
  sideEl.appendChild(sideToggle);
  const sideList = document.createElement('ol');
  sideList.className = 'odb-sidelist';
  sideList.id = 'odb-sidelist';
  sideEl.appendChild(sideList);
  sideToggle.onclick = () => {
    const open = sideEl.classList.toggle('open');
    sideToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  let lastSnap: RaceSnapshot | null = null;
  window.addEventListener('resize', () => {
    if (lastSnap && sideEl.style.display !== 'none') renderSideList(lastSnap, shownFollowing);
  });

  let lastHudAt = 0;
  function renderRowTags(btn: HTMLElement, m: Marble, snap: RaceSnapshot): void {
    btn.querySelectorAll('.odb-tag').forEach((x) => x.remove());
    const isWinner = snap.winner !== null && m.id === snap.winner.id;
    if (isWinner) {
      const tag = document.createElement('span');
      tag.className = 'odb-tag odb-tag-focus';
      tag.textContent = t('tag.picked');
      btn.appendChild(tag);
    } else if (m.place !== null) {
      const tag = document.createElement('span');
      tag.className = 'odb-tag odb-tag-done';
      tag.textContent = t('tag.done');
      btn.appendChild(tag);
    }
    // 당첨 확정 구슬에는 유력 태그를 붙이지 않는다
    // (first 모드는 확정 후 focus가 당첨자로 머물러 유력 태그가 사라진다)
    if (!isWinner && snap.focus !== null && m.id === snap.focus.id) {
      const tag = document.createElement('span');
      tag.className = 'odb-tag odb-tag-focus';
      tag.textContent = t(snap.mode === 'first' ? 'tag.likelyFirst' : 'tag.likelyLast');
      btn.appendChild(tag);
    }
  }

  // 행 시각 높이 24px(13px/1.35 + 패딩). 2열 전환 판단용 추정치.
  const SIDE_ROW_H = 24;
  function renderSideList(snap: RaceSnapshot, following: number | null): void {
    // 목록 안에서 탭 이동 중이면 다시 그리지 않는다(포커스 유지)
    if (sideList.contains(document.activeElement)) return;
    sideList.replaceChildren();
    let n = 0;
    snap.ranked.forEach((m, i) => {
      n++;
      const isWinner = snap.winner !== null && m.id === snap.winner.id;
      const st = isWinner
        ? t('tag.picked')
        : m.place !== null
          ? t('tag.done')
          : snap.focus !== null && m.id === snap.focus.id
            ? t(snap.mode === 'first' ? 'tag.likelyFirst' : 'tag.likelyLast')
            : '';
      const li = document.createElement('li');
      li.className = 'odb-siderow';
      if (m.id === following || isWinner) li.classList.add('odb-mark');
      const btn = document.createElement('button');
      btn.className = 'odb-siderowbtn';
      btn.setAttribute('aria-pressed', m.id === following ? 'true' : 'false');
      btn.setAttribute('aria-label', t('sideAria', { n: m.place ?? i + 1, name: m.name, st }));
      const rank = document.createElement('span');
      rank.textContent = t('rank', { n: m.place ?? i + 1 });
      const dot = document.createElement('span');
      dot.className = 'odb-sidedot';
      dot.style.background = m.color;
      dot.setAttribute('aria-hidden', 'true');
      const nm = document.createElement('span');
      nm.className = 'odb-sidename';
      nm.textContent = m.name;
      btn.appendChild(rank);
      btn.appendChild(dot);
      btn.appendChild(nm);
      if (st) {
        const stEl = document.createElement('span');
        stEl.textContent = st;
        btn.appendChild(stEl);
      }
      btn.onclick = () => followCb(m.id === following ? null : m.id);
      li.appendChild(btn);
      sideList.appendChild(li);
    });
    sideToggle.textContent = t('hud.sideToggle', { n: snap.ranked.length });
    // 화면 높이가 모자라면 스크롤 대신 2열로 흐르게
    if (n > 1 && n * SIDE_ROW_H > window.innerHeight - 24) {
      sideList.classList.add('cols2');
      sideList.style.gridTemplateRows = `repeat(${Math.ceil(n / 2)}, ${SIDE_ROW_H}px)`;
    } else {
      sideList.classList.remove('cols2');
      sideList.style.gridTemplateRows = '';
    }
  }

  function renderHud(snap: RaceSnapshot, manual: boolean, speed: number, following: number | null): void {
    timeEl.textContent = t('hud.elapsed', { s: snap.t.toFixed(1) });
    modeEl.textContent = t(snap.mode === 'first' ? 'mode.firstShort' : 'mode.lastShort');
    camBtn.textContent = t(manual ? 'hud.camAuto' : 'hud.camManual');
    shownSpeed = speed;
    if (speed > 0) lastNonZero = speed;
    speedBtns.forEach((b, i) => {
      const on = SPEED_BTNS[i].x === speed;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // 당첨 확정 배너(레이스는 계속된다)
    if (snap.winner) {
      winBanner.style.display = '';
      winBanner.textContent = t(snap.mode === 'first' ? 'hud.banner.first' : 'hud.banner.last', { name: snap.winner.name });
      if (announcedWinnerId !== snap.winner.id) {
        announcedWinnerId = snap.winner.id;
        // aria-live 안내는 여기서 1회만(알림 카드와 중복 안내 금지)
        announce(t(snap.mode === 'first' ? 'announce.winFirst' : 'announce.winLast', { name: snap.winner.name }));
        showWinAlert(snap.winner, snap.mode);
      }
    } else {
      winBanner.style.display = 'none';
    }
    // 상위 3위 완주 안내(실제 완주 기록이 있는 경우만, 순위당 1회)
    for (const m of snap.ranked) {
      if (m.place !== null && m.place >= 1 && m.place <= 3 && m.finishedAt !== null) {
        if (!announcedPlaces.has(m.place)) {
          announcedPlaces.add(m.place);
          announce(t('announce.finish', { n: m.place, name: m.name }));
        }
      }
    }
    const focusId = snap.focus ? snap.focus.id : -1;
    shownFollowing = following;
    // 시점 고정 칩
    const followed = following != null ? (snap.ranked.find((m) => m.id === following) ?? null) : null;
    if (followed) {
      followChip.style.display = '';
      followChip.textContent = t('hud.followChip', { name: followed.name });
      followChip.setAttribute('aria-label', t('hud.followChipAria', { name: followed.name }));
    } else {
      followChip.style.display = 'none';
    }
    for (let i = 0; i < HUD_N; i++) {
      const li = rowEls[i];
      const m: Marble | undefined = snap.ranked[i];
      if (!m) {
        li.style.display = 'none';
        continue;
      }
      li.style.display = '';
      li.classList.toggle('odb-focus', m.id === focusId);
      li.classList.toggle('odb-following', m.id === following);
      const btn = li.children[0] as HTMLButtonElement;
      btn.setAttribute('aria-pressed', m.id === following ? 'true' : 'false');
      btn.setAttribute('aria-label', t('rowAria', { n: m.place ?? i + 1, name: m.name, done: m.place !== null ? 1 : 0 }));
      btn.onclick = () => followCb(m.id === following ? null : m.id);
      const rank = btn.children[0] as HTMLElement;
      rank.textContent = t('rank', { n: m.place ?? i + 1 });
      const dot = btn.children[1] as HTMLElement;
      dot.style.background = m.color;
      const nm = btn.children[2] as HTMLElement;
      nm.textContent = m.name;
      // 기존 태그 제거 후 상태에 맞게 부착
      renderRowTags(btn, m, snap);
    }
    renderSideList(snap, following);
  }

  // ── 결과 ──
  const rLabel = el('div', 'odb-rlabel', resultEl);
  const winSwatch = el('div', 'odb-winswatch', resultEl);
  winSwatch.setAttribute('aria-hidden', 'true');
  const winnerEl = el('p', 'odb-winner', resultEl);
  const rSub = el('p', 'odb-rsub', resultEl);
  const rList = document.createElement('ol');
  rList.className = 'odb-rlist';
  resultEl.appendChild(rList);
  const restartBtn = document.createElement('button');
  restartBtn.className = 'odb-restart';
  bind(() => {
    restartBtn.textContent = t('result.restart');
  });
  resultEl.appendChild(restartBtn);
  let restartCb: () => void = () => {};
  restartBtn.onclick = () => restartCb();

  let lastResult: { winner: Marble; ranked: Marble[]; mode: WinMode } | null = null;
  function paintResult(winner: Marble, ranked: Marble[], mode: WinMode): void {
    rLabel.textContent = t(mode === 'first' ? 'mode.first' : 'mode.last');
    winnerEl.textContent = winner.name;
    // 글자는 진한색 고정, 구슬 색은 스와치+밑줄 장식으로만(대비 확보)
    winSwatch.style.background = winner.color;
    winnerEl.style.textDecorationColor = winner.color;
    rSub.textContent = t(mode === 'first' ? 'result.subFirst' : 'result.subLast');
    rList.replaceChildren();
    ranked.forEach((m, i) => {
      const li = document.createElement('li');
      li.className = 'odb-row';
      const rank = document.createElement('span');
      rank.className = 'odb-rank';
      rank.textContent = t('rank', { n: m.place ?? i + 1 });
      const dot = document.createElement('span');
      dot.className = 'odb-dot';
      dot.style.background = m.color;
      dot.setAttribute('aria-hidden', 'true');
      const nm = document.createElement('span');
      nm.className = 'odb-name';
      nm.textContent = m.name;
      li.appendChild(rank);
      li.appendChild(dot);
      li.appendChild(nm);
      const rec = document.createElement('span');
      rec.className = 'odb-rectime';
      if (m.finishedAt !== null) rec.textContent = t('result.time', { s: m.finishedAt.toFixed(1) });
      else if (m.id === winner.id && mode === 'last') rec.textContent = t('result.lastConfirmed');
      else rec.textContent = '—';
      li.appendChild(rec);
      if (m.id === winner.id) {
        const tag = document.createElement('span');
        tag.className = 'odb-tag odb-tag-focus';
        tag.textContent = t('tag.picked');
        li.appendChild(tag);
      } else if (m.place !== null) {
        const tag = document.createElement('span');
        tag.className = 'odb-tag odb-tag-done';
        tag.textContent = t('tag.done');
        li.appendChild(tag);
      }
      rList.appendChild(li);
    });
  }

  hideAll();
  lobbyEl.style.display = '';

  // 언어 전환: 기본 명단은 새 언어로 바꾸고(입력한 이름은 그대로), 라벨과 열려 있는 화면을 다시 그린다.
  onLangChange(() => {
    const nextDefault = t('lobby.defaultNames');
    if (area.value.trim() === curDefault.trim()) {
      area.value = nextDefault;
      refreshCount();
    }
    curDefault = nextDefault;
    relabels.forEach((f) => f());
    if (lastHudArgs && hudEl.style.display !== 'none') {
      renderHud(lastHudArgs.snap, lastHudArgs.manual, lastHudArgs.speed, lastHudArgs.following);
    }
    if (lastResult && resultEl.style.display !== 'none') paintResult(lastResult.winner, lastResult.ranked, lastResult.mode);
  });

  return {
    showLobby(onStart) {
      startCb = onStart;
      err.textContent = '';
      const s = loadSaved();
      if (s) {
        area.value = s;
        refreshCount();
      }
      fwCheck.checked = loadFirstWin();
      refreshFwSub();
      resetAnnounce();
      // 저장된 탭으로 복원하고 코어에 1회 알린다(QR 탭이면 방을 연다)
      entryMode = loadEntry();
      paintTab();
      renderQrRoster();
      hideAll();
      lobbyEl.style.display = '';
      entryCb(entryMode);
    },
    showCountdown(n: number) {
      if (n === 3) {
        // 새 레이스 시작: 안내 상태 초기화
        resetAnnounce();
        announce(t('announce.start'));
      }
      hideAll();
      countEl.style.display = '';
      countEl.textContent = n > 0 ? String(n) : 'GO';
      window.clearTimeout(countTimer);
      if (n <= 0) {
        // GO를 잠깐 보여주고 사라진다
        countTimer = window.setTimeout(() => {
          if (countEl.textContent === 'GO') countEl.style.display = 'none';
        }, 750);
      }
    },
    updateHud(snap: RaceSnapshot, manual: boolean, speed: number = 1, following: number | null = null) {
      if (lobbyEl.style.display !== 'none' || resultEl.style.display !== 'none') {
        hideAll();
        hudEl.style.display = '';
        sideEl.style.display = '';
        lastHudAt = 0;
      }
      if (countEl.style.display !== 'none' && snap.t > 0.5) countEl.style.display = 'none';
      const now = performance.now();
      if (now - lastHudAt < HUD_THROTTLE_MS) return;
      lastHudAt = now;
      hudEl.style.display = '';
      sideEl.style.display = '';
      lastSnap = snap;
      lastHudArgs = { snap, manual, speed, following };
      renderHud(snap, manual, speed, following);
    },
    showResult(winner: Marble, ranked: Marble[], mode: WinMode, onRestart: () => void) {
      restartCb = onRestart;
      hideWinAlert();
      hideAll();
      resultEl.style.display = '';
      announce(t(mode === 'first' ? 'announce.resultFirst' : 'announce.resultLast', { name: winner.name }));
      lastResult = { winner, ranked, mode };
      paintResult(winner, ranked, mode);
    },
    onToggleManual(cb) {
      toggleCb = cb;
    },
    onFollow(cb) {
      followCb = cb;
    },
    onSpeed(cb) {
      speedCb = cb;
    },
    addParticipant(name: string) {
      // QR 참가는 항상 QR 명단에 쌓인다(레이스 중 포함, 다음 판 명단)
      const clean = name.trim();
      if (!clean) return { ok: false, reason: 'reason.empty' };
      const norm = (s: string) => s.trim().toLowerCase();
      if (qrNames.some((n) => norm(n) === norm(clean))) {
        return { ok: false, reason: 'reason.dup' };
      }
      if (qrNames.length >= MAX_NAMES) {
        return { ok: false, reason: 'reason.full' };
      }
      qrNames.push(clean);
      saveQrNames(qrNames);
      renderQrRoster();
      showToast(t('toast.joined', { name: clean }));
      return { ok: true };
    },
    setJoinInfo(info: JoinInfo | null, status: PartyStatus, msg?: string) {
      lastJoin = { info, status, msg };
      renderJoin();
    },
    onEntryMode(cb: (m: EntryMode) => void) {
      entryCb = cb;
      // 코어가 로비 표시 이후에 등록하므로, 등록 시점에 현재 탭을 바로 알린다
      cb(entryMode);
    },
    onAudio(cb: (s: AudioState) => void) {
      audioCb = cb;
    },
    setAudioState(s: AudioState) {
      audioMuted = !!s.muted;
      audioVolume = Math.max(0, Math.min(1, s.volume));
      syncAudioControls();
    },
  };
};
