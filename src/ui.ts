// 워커 B: 파티 게임풍 한국어 UI (파스텔·둥근 모서리·두꺼운 글자).
// 이름은 전부 textContent로 넣어 HTML 주입을 방지한다. CSS는 <style>로 주입.
import type { CreateUI, Marble, RaceSnapshot, WinMode } from './types';

const LS_KEY = 'orb-derby:names';
const DEFAULT_NAMES = ['철수', '영희', '민수', '지영', '태호', '수진'];
const HUD_N = 8;
const HUD_THROTTLE_MS = 150;
const MAX_NAMES = 40;

const CSS = `
.odb-panel,.odb-panel *{box-sizing:border-box}
.odb-panel{position:absolute;font-family:system-ui,-apple-system,"Pretendard","Apple SD Gothic Neo",sans-serif;color:#4a3f55}
.odb-lobby{top:50%;left:50%;transform:translate(-50%,-50%);background:#fff7fb;border:4px solid #ffd1e3;border-radius:28px;padding:28px 30px;width:min(420px,calc(100vw - 32px));box-shadow:0 12px 40px rgba(255,143,178,.35);text-align:center}
.odb-wordmark{font-size:12px;font-weight:900;letter-spacing:4px;color:#b39dff;margin:0 0 2px}
.odb-title{font-size:30px;font-weight:900;letter-spacing:-.5px;margin:0 0 4px;color:#e0508a}
.odb-sub{font-size:14px;font-weight:700;color:#9a8aa5;margin:0 0 14px}
.odb-label{display:block;font-size:13px;font-weight:800;color:#7a6a85;text-align:left;margin:10px 0 6px}
.odb-names{width:100%;min-height:130px;resize:vertical;border:3px solid #ffe0ec;border-radius:16px;padding:10px 12px;font-size:15px;font-weight:700;color:#4a3f55;background:#fffdfd;outline:none}
.odb-names:focus{border-color:#ff9ec4}
.odb-modes{display:flex;gap:8px;margin:12px 0 4px}
.odb-mode{flex:1;display:block;cursor:pointer}
.odb-mode input{position:absolute;opacity:0;pointer-events:none}
.odb-mode span{display:block;padding:10px 0;border-radius:999px;font-size:15px;font-weight:900;background:#f3efff;color:#8a7aa5;border:3px solid transparent}
.odb-mode input:checked+span{background:#ffe3ef;color:#d63f7f;border-color:#ff9ec4}
.odb-mode input:focus-visible+span{outline:3px solid #c9b8ff}
.odb-countline{font-size:12px;font-weight:800;color:#9a8aa5;margin:6px 0 0;min-height:18px}
.odb-err{font-size:13px;font-weight:800;color:#e04444;margin:4px 0 0;min-height:20px}
.odb-start{margin-top:10px;width:100%;padding:13px 0;border:none;border-radius:999px;background:#ff7fb0;color:#fff;font-size:19px;font-weight:900;letter-spacing:1px;cursor:pointer;box-shadow:0 6px 0 #e0508a}
.odb-start:active{transform:translateY(3px);box-shadow:0 3px 0 #e0508a}
.odb-count{top:38%;left:50%;transform:translate(-50%,-50%);font-size:min(120px,22vw);font-weight:900;color:#fff;text-shadow:0 6px 0 #e0508a,0 12px 32px rgba(224,80,138,.5)}
.odb-hud{top:12px;left:12px;background:rgba(255,247,251,.94);border:3px solid #ffd1e3;border-radius:20px;padding:12px 14px;width:248px;box-shadow:0 6px 24px rgba(255,143,178,.3)}
.odb-hudhead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.odb-time{font-size:16px;font-weight:900;color:#e0508a;font-variant-numeric:tabular-nums}
.odb-modelabel{font-size:11px;font-weight:900;color:#fff;background:#b39dff;border-radius:999px;padding:3px 10px;white-space:nowrap}
.odb-board{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;max-height:44vh;overflow:auto}
.odb-row{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;color:#5a4f66;background:#fff;border-radius:12px;padding:4px 9px;border:2px solid transparent;overflow:hidden}
.odb-row .odb-rank{flex:0 0 auto;min-width:34px;white-space:nowrap;font-variant-numeric:tabular-nums;color:#9a8aa5}
.odb-row .odb-dot{flex:0 0 auto;width:13px;height:13px;border-radius:50%;box-shadow:inset -2px -2px 0 rgba(0,0,0,.18)}
.odb-row .odb-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.odb-row .odb-tag{flex:0 0 auto;font-size:10px;font-weight:900;border-radius:999px;padding:2px 7px}
.odb-tag-done{background:#d9f7e5;color:#1d9e57}
.odb-tag-focus{background:#ffe3ef;color:#d63f7f}
.odb-row.odb-focus{border-color:#ff9ec4;background:#fff0f6}
.odb-cambtn{margin-top:10px;width:100%;padding:9px 0;border:none;border-radius:999px;background:#b39dff;color:#fff;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 4px 0 #8a76e0}
.odb-cambtn:active{transform:translateY(2px);box-shadow:0 2px 0 #8a76e0}
.odb-result{top:50%;left:50%;transform:translate(-50%,-50%);background:#fff7fb;border:4px solid #ffd1e3;border-radius:28px;padding:28px 30px;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;box-shadow:0 12px 40px rgba(255,143,178,.35);text-align:center}
.odb-rlabel{font-size:15px;font-weight:900;color:#fff;background:#ff9ec4;border-radius:999px;padding:5px 16px;display:inline-block;margin-bottom:10px}
.odb-winner{font-size:44px;font-weight:900;letter-spacing:-1px;margin:0 0 4px;word-break:break-word;text-shadow:0 3px 0 rgba(255,255,255,.9)}
.odb-rsub{font-size:14px;font-weight:800;color:#9a8aa5;margin:0 0 14px}
.odb-rlist{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:4px;text-align:left}
.odb-restart{width:100%;padding:13px 0;border:none;border-radius:999px;background:#7fd6a4;color:#fff;font-size:18px;font-weight:900;cursor:pointer;box-shadow:0 6px 0 #3faf71}
.odb-restart:active{transform:translateY(3px);box-shadow:0 3px 0 #3faf71}
@media (max-width:640px){
.odb-hud{width:200px;padding:9px 10px;top:8px;left:8px}
.odb-row{font-size:12px;padding:3px 7px}
.odb-time{font-size:14px}
.odb-lobby,.odb-result{padding:20px 18px}
.odb-title{font-size:24px}
.odb-winner{font-size:34px}
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

export const createUI: CreateUI = (root) => {
  if (!document.getElementById('odb-style')) {
    const style = document.createElement('style');
    style.id = 'odb-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  let toggleCb: () => void = () => {};

  const lobbyEl = el('div', 'odb-panel odb-lobby', root);
  const countEl = el('div', 'odb-panel odb-count', root);
  const hudEl = el('div', 'odb-panel odb-hud', root);
  const resultEl = el('div', 'odb-panel odb-result', root);

  // ── 로비 ──
  const wordmark = el('p', 'odb-wordmark', lobbyEl);
  wordmark.textContent = 'ORB DERBY';
  const title = el('h1', 'odb-title', lobbyEl);
  title.textContent = '구슬 경주 추첨기';
  const sub = el('p', 'odb-sub', lobbyEl);
  sub.textContent = '이름을 넣고 누가 뽑힐지 굴려보세요';

  const nameLabel = el('label', 'odb-label', lobbyEl) as HTMLLabelElement;
  nameLabel.textContent = '참가자 이름 (줄바꿈 또는 쉼표로 구분, 2~40명)';
  const area = document.createElement('textarea');
  area.className = 'odb-names';
  nameLabel.htmlFor = 'odb-names';
  area.id = 'odb-names';
  const saved = loadSaved();
  area.value = saved || DEFAULT_NAMES.join('\n');
  lobbyEl.appendChild(area);

  const modes = el('div', 'odb-modes', lobbyEl);
  const modeFirst = document.createElement('label');
  modeFirst.className = 'odb-mode';
  const radioFirst = document.createElement('input');
  radioFirst.type = 'radio';
  radioFirst.name = 'odb-mode';
  radioFirst.value = 'first';
  radioFirst.checked = true;
  const spanFirst = document.createElement('span');
  spanFirst.textContent = '1등 당첨';
  modeFirst.appendChild(radioFirst);
  modeFirst.appendChild(spanFirst);
  const modeLast = document.createElement('label');
  modeLast.className = 'odb-mode';
  const radioLast = document.createElement('input');
  radioLast.type = 'radio';
  radioLast.name = 'odb-mode';
  radioLast.value = 'last';
  const spanLast = document.createElement('span');
  spanLast.textContent = '꼴등 당첨';
  modeLast.appendChild(radioLast);
  modeLast.appendChild(spanLast);
  modes.appendChild(modeFirst);
  modes.appendChild(modeLast);

  const countLine = el('p', 'odb-countline', lobbyEl);
  const err = el('p', 'odb-err', lobbyEl);
  const refreshCount = () => {
    const n = parseNames(area.value).length;
    countLine.textContent = `현재 ${n}명`;
  };
  area.addEventListener('input', () => {
    err.textContent = '';
    refreshCount();
  });
  refreshCount();

  const startBtn = document.createElement('button');
  startBtn.className = 'odb-start';
  startBtn.textContent = '경주 시작';
  lobbyEl.appendChild(startBtn);

  let startCb: (names: string[], mode: WinMode) => void = () => {};
  startBtn.onclick = () => {
    const names = parseNames(area.value);
    if (names.length < 2) {
      err.textContent = '참가자를 2명 이상 입력해 주세요.';
      return;
    }
    const use = names.slice(0, MAX_NAMES);
    saveNames(use);
    const mode: WinMode = radioLast.checked ? 'last' : 'first';
    startCb(use, mode);
  };

  // ── 카운트다운 ──
  let countTimer = 0;
  function hideAll(): void {
    lobbyEl.style.display = 'none';
    countEl.style.display = 'none';
    hudEl.style.display = 'none';
    resultEl.style.display = 'none';
  }

  // ── HUD (DOM은 한 번만 만들고 updateHud에서 내용만 갱신) ──
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
    const rank = document.createElement('span');
    rank.className = 'odb-rank';
    const dot = document.createElement('span');
    dot.className = 'odb-dot';
    const nm = document.createElement('span');
    nm.className = 'odb-name';
    li.appendChild(rank);
    li.appendChild(dot);
    li.appendChild(nm);
    board.appendChild(li);
    rowEls.push(li);
  }
  const camBtn = document.createElement('button');
  camBtn.className = 'odb-cambtn';
  camBtn.onclick = () => toggleCb();
  hudEl.appendChild(camBtn);

  let lastHudAt = 0;
  function renderHud(snap: RaceSnapshot, manual: boolean): void {
    timeEl.textContent = `경과 ${snap.t.toFixed(1)}초`;
    modeEl.textContent = snap.mode === 'first' ? '1등 당첨' : '꼴등 당첨';
    camBtn.textContent = manual ? '자동 카메라로 보기' : '수동 카메라로 보기';
    const focusId = snap.focus ? snap.focus.id : -1;
    for (let i = 0; i < HUD_N; i++) {
      const li = rowEls[i];
      const m: Marble | undefined = snap.ranked[i];
      if (!m) {
        li.style.display = 'none';
        continue;
      }
      li.style.display = '';
      li.classList.toggle('odb-focus', m.id === focusId);
      const rank = li.children[0] as HTMLElement;
      rank.textContent = `${m.place ?? i + 1}위`;
      const dot = li.children[1] as HTMLElement;
      dot.style.background = m.color;
      const nm = li.children[2] as HTMLElement;
      nm.textContent = m.name;
      // 기존 태그 제거 후 상태에 맞게 부착
      li.querySelectorAll('.odb-tag').forEach((t) => t.remove());
      if (m.place !== null) {
        const tag = document.createElement('span');
        tag.className = 'odb-tag odb-tag-done';
        tag.textContent = '완주';
        li.appendChild(tag);
      }
      if (m.id === focusId) {
        const tag = document.createElement('span');
        tag.className = 'odb-tag odb-tag-focus';
        tag.textContent = '주인공';
        li.appendChild(tag);
      }
    }
  }

  // ── 결과 ──
  const rLabel = el('div', 'odb-rlabel', resultEl);
  const winnerEl = el('p', 'odb-winner', resultEl);
  const rSub = el('p', 'odb-rsub', resultEl);
  const rList = document.createElement('ol');
  rList.className = 'odb-rlist';
  resultEl.appendChild(rList);
  const restartBtn = document.createElement('button');
  restartBtn.className = 'odb-restart';
  restartBtn.textContent = '다시 하기';
  resultEl.appendChild(restartBtn);
  let restartCb: () => void = () => {};
  restartBtn.onclick = () => restartCb();

  hideAll();
  lobbyEl.style.display = '';

  return {
    showLobby(onStart) {
      startCb = onStart;
      err.textContent = '';
      const s = loadSaved();
      if (s) {
        area.value = s;
        refreshCount();
      }
      hideAll();
      lobbyEl.style.display = '';
    },
    showCountdown(n: number) {
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
    updateHud(snap: RaceSnapshot, manual: boolean) {
      if (lobbyEl.style.display !== 'none' || resultEl.style.display !== 'none') {
        hideAll();
        hudEl.style.display = '';
        lastHudAt = 0;
      }
      if (countEl.style.display !== 'none' && snap.t > 0.5) countEl.style.display = 'none';
      const now = performance.now();
      if (now - lastHudAt < HUD_THROTTLE_MS) return;
      lastHudAt = now;
      hudEl.style.display = '';
      renderHud(snap, manual);
    },
    showResult(winner: Marble, ranked: Marble[], mode: WinMode, onRestart: () => void) {
      restartCb = onRestart;
      hideAll();
      resultEl.style.display = '';
      rLabel.textContent = mode === 'first' ? '1등 당첨 레이스' : '꼴등 당첨 레이스';
      winnerEl.textContent = winner.name;
      winnerEl.style.color = winner.color;
      rSub.textContent =
        mode === 'first' ? '가장 먼저 들어온 구슬이 당첨!' : '가장 늦게 들어온 구슬이 당첨!';
      rList.replaceChildren();
      ranked.forEach((m, i) => {
        const li = document.createElement('li');
        li.className = 'odb-row';
        const rank = document.createElement('span');
        rank.className = 'odb-rank';
        rank.textContent = `${m.place ?? i + 1}위`;
        const dot = document.createElement('span');
        dot.className = 'odb-dot';
        dot.style.background = m.color;
        const nm = document.createElement('span');
        nm.className = 'odb-name';
        nm.textContent = m.name;
        li.appendChild(rank);
        li.appendChild(dot);
        li.appendChild(nm);
        if (m.id === winner.id) {
          const tag = document.createElement('span');
          tag.className = 'odb-tag odb-tag-focus';
          tag.textContent = '당첨';
          li.appendChild(tag);
        } else if (m.place !== null) {
          const tag = document.createElement('span');
          tag.className = 'odb-tag odb-tag-done';
          tag.textContent = '완주';
          li.appendChild(tag);
        }
        rList.appendChild(li);
      });
    },
    onToggleManual(cb) {
      toggleCb = cb;
    },
  };
};
