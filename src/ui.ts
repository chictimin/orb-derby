// STUB — 워커 B가 교체한다. 계약은 src/types.ts의 UI.
import type { CreateUI } from './types';

export const createUI: CreateUI = (root) => {
  let toggleCb = () => {};
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:absolute;top:12px;left:12px;background:#fffc;padding:10px;border-radius:10px;font-size:14px;max-width:320px';
  root.appendChild(panel);

  return {
    showLobby(onStart) {
      panel.innerHTML = `<textarea id="names" rows="6" style="width:280px">철수\n영희\n민수\n지영\n태호\n수진</textarea><br>
        <label><input type="radio" name="m" value="first" checked>1등 당첨</label>
        <label><input type="radio" name="m" value="last">꼴등 당첨</label><br><button id="go">시작</button>`;
      panel.querySelector<HTMLButtonElement>('#go')!.onclick = () => {
        const names = panel
          .querySelector<HTMLTextAreaElement>('#names')!
          .value.split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const mode = (panel.querySelector<HTMLInputElement>('input[name=m]:checked')!.value) as 'first' | 'last';
        if (names.length >= 2) onStart(names, mode);
      };
    },
    showCountdown(n) {
      panel.textContent = n > 0 ? String(n) : 'GO!';
    },
    updateHud(snap, manual) {
      panel.innerHTML =
        `<button id="cam">${manual ? '자동 카메라' : '수동 카메라'}</button> ${snap.t.toFixed(1)}s<br>` +
        snap.ranked
          .slice(0, 10)
          .map((m, i) => `${m.place ?? i + 1}. <span style="color:${m.color}">●</span> ${m.name}`)
          .join('<br>');
      panel.querySelector<HTMLButtonElement>('#cam')!.onclick = () => toggleCb();
    },
    showResult(winner, _ranked, mode, onRestart) {
      panel.innerHTML = `<b>${mode === 'first' ? '1등' : '꼴등'} 당첨: ${winner.name}</b><br><button id="re">다시</button>`;
      panel.querySelector<HTMLButtonElement>('#re')!.onclick = onRestart;
    },
    onToggleManual(cb) {
      toggleCb = cb;
    },
  };
};
