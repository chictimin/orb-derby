// QR 참가 페이지(휴대폰). join.html?room=<roomId>
import Peer from 'peerjs';
import type { JoinMsg, JoinReply } from '../types';
import { getLang, onLangChange, setLang, t, type Lang } from '../i18n';
import { cleanName, NAME_MAX, ROOM_RE } from './protocol';

const TIMEOUT_MS = 10000;
const LS_KEY = 'orbderby.name';

const css = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#f7f1ff;color:#3a3358;font-family:system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;display:flex;align-items:center;justify-content:center;padding:20px}
.card{position:relative;width:100%;max-width:420px;background:#fff;border-radius:28px;padding:28px 22px;box-shadow:0 10px 30px rgba(120,100,180,.18)}
h1{margin:0 0 6px;font-size:40px;font-weight:900;letter-spacing:1px;text-align:center;color:#e0508a}
.eyebrow{margin:12px 0 6px;font-size:13px;font-weight:800;letter-spacing:2px;color:#c23375}
p{margin:0 0 18px;text-align:center;color:#6b6490;font-size:16px;line-height:1.5}
input{width:100%;font-size:22px;padding:16px;border-radius:18px;border:3px solid #ded2ff;background:#fbf9ff;color:#3a3358;outline:none}
input:focus{border-color:#b8a9ff}
button{width:100%;margin-top:14px;font-size:22px;font-weight:700;padding:16px;border:0;border-radius:18px;background:#c23375;color:#fff;cursor:pointer}
button:disabled{background:#d9d3e8;cursor:default}
.status{margin-top:16px;text-align:center;font-size:18px;min-height:27px;overflow-wrap:anywhere}
.ok{color:#2f9e6e;font-weight:700}.bad{color:#b3263f}
button:focus-visible,input:focus-visible{outline:3px solid #6a4fd8;outline-offset:2px}
.lang{position:absolute;top:12px;right:14px;display:flex;border:2px solid #a8245e;border-radius:999px;overflow:hidden;background:#fff}
.lang .lb{width:auto;margin:0;font-size:12px;font-weight:900;padding:4px 10px;border-radius:0;background:#fff;color:#a8245e;letter-spacing:.5px;line-height:1.2}
.lang .lb[aria-pressed=true]{background:#a8245e;color:#fff}
`;

const root = document.getElementById('join')!;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

const room = new URLSearchParams(location.search).get('room') ?? '';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

const card = el('div', undefined, 'card');
root.replaceChildren(card);
const eyebrow = el('p', undefined, 'eyebrow');
const relabels: (() => void)[] = [];
const bind = (fn: () => void) => {
  fn();
  relabels.push(fn);
};

// 언어 토글 [KO | EN]
const langBox = el('div', undefined, 'lang');
langBox.setAttribute('role', 'group');
const langBtns: [Lang, HTMLButtonElement][] = (['ko', 'en'] as Lang[]).map((l) => {
  const b = el('button', l.toUpperCase(), 'lb');
  b.type = 'button';
  b.lang = l;
  b.onclick = () => setLang(l);
  langBox.append(b);
  return [l, b];
});
bind(() => {
  document.title = t('doc.joinTitle');
  eyebrow.textContent = t('join.eyebrow');
  langBox.setAttribute('aria-label', t('lang.label'));
  for (const [l, b] of langBtns) {
    b.setAttribute('aria-pressed', getLang() === l ? 'true' : 'false');
    b.setAttribute('aria-label', t('lang.' + l));
  }
});
card.append(langBox, eyebrow, el('h1', 'ORB DERBY'));
onLangChange(() => relabels.forEach((f) => f()));

if (!ROOM_RE.test(room)) {
  const bad = el('p');
  bind(() => {
    bad.textContent = t('join.badUrl');
  });
  card.append(bad);
} else {
  const prompt = el('p');
  bind(() => {
    prompt.textContent = t('join.prompt');
  });
  card.append(prompt);
  const input = el('input');
  input.type = 'text';
  input.maxLength = NAME_MAX;
  bind(() => {
    input.placeholder = t('join.placeholder');
  });
  input.autocomplete = 'off';
  try {
    input.value = (localStorage.getItem(LS_KEY) ?? '').slice(0, NAME_MAX);
  } catch {
    /* 저장소 사용 불가 */
  }
  const btn = el('button');
  const status = el('div', undefined, 'status');
  card.append(input, btn, status);

  // 상태 문구·버튼 라벨은 키로 기억해 두었다가 언어가 바뀌면 다시 번역한다.
  // 진행자가 보낸 사유는 키(reason.*)이거나 옛 진행자의 원문이다(t가 없는 키는 원문 그대로 돌려준다).
  let statusKey = '';
  let statusParams: Record<string, string | number> = {};
  let statusCls = '';
  let btnKey = 'join.button';
  const paint = () => {
    status.textContent = statusKey ? t(statusKey, statusParams) : '';
    status.className = 'status ' + statusCls;
    btn.textContent = t(btnKey);
  };
  bind(paint);
  const show = (key: string, cls = '', params: Record<string, string | number> = {}) => {
    statusKey = key;
    statusParams = params;
    statusCls = cls;
    paint();
  };

  let peer: Peer | null = null;
  let attempt = 0;
  const cleanup = () => {
    peer?.destroy();
    peer = null;
  };

  const join = () => {
    const name = cleanName(input.value);
    if (!name) return show('join.nameError', 'bad');
    try {
      localStorage.setItem(LS_KEY, name);
    } catch {
      /* 무시 */
    }
    cleanup();
    const my = ++attempt;
    btn.disabled = true;
    show('join.connecting');
    let done = false;
    const finish = (key: string, cls: string, retry: boolean, params: Record<string, string | number> = {}) => {
      if (done || my !== attempt) return;
      done = true;
      clearTimeout(timer);
      btnKey = retry ? 'join.retry' : 'join.rename';
      show(key, cls, params);
      btn.disabled = false;
    };
    const timer = window.setTimeout(() => {
      finish('join.timeout', 'bad', true);
      cleanup();
    }, TIMEOUT_MS);

    const p = new Peer();
    peer = p;
    p.on('error', (e) => finish('join.peerError', 'bad', true, { type: (e as { type?: string }).type ?? t('join.unknown') }));
    p.on('open', () => {
      const conn = p.connect(room, { reliable: true });
      conn.on('open', () => {
        show('join.requesting');
        const msg: JoinMsg = { type: 'join', name };
        conn.send(msg);
      });
      conn.on('data', (d) => {
        const r = d as Partial<JoinReply> | null;
        if (!r || r.type !== 'joined') return;
        if (r.ok) finish('join.done', 'ok', false);
        else finish(r.reason ?? 'join.rejected', 'bad', true);
      });
      conn.on('error', () => finish('join.dropped', 'bad', true));
    });
  };

  btn.addEventListener('click', join);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
}
