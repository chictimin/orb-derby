// QR 참가 페이지(휴대폰). join.html?room=<roomId>
import Peer from 'peerjs';
import type { JoinMsg, JoinReply } from '../types';
import { cleanName, NAME_MAX, ROOM_RE } from './protocol';

const TIMEOUT_MS = 10000;
const LS_KEY = 'orbderby.name';

const css = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#f7f1ff;color:#3a3358;font-family:system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;display:flex;align-items:center;justify-content:center;padding:20px}
.card{width:100%;max-width:420px;background:#fff;border-radius:28px;padding:28px 22px;box-shadow:0 10px 30px rgba(120,100,180,.18)}
h1{margin:0 0 6px;font-size:40px;font-weight:900;letter-spacing:1px;text-align:center;color:#e0508a}
.eyebrow{margin:0 0 6px;font-size:13px;font-weight:800;letter-spacing:2px;color:#c23375}
p{margin:0 0 18px;text-align:center;color:#6b6490;font-size:16px;line-height:1.5}
input{width:100%;font-size:22px;padding:16px;border-radius:18px;border:3px solid #ded2ff;background:#fbf9ff;color:#3a3358;outline:none}
input:focus{border-color:#b8a9ff}
button{width:100%;margin-top:14px;font-size:22px;font-weight:700;padding:16px;border:0;border-radius:18px;background:#ff7b8f;color:#fff;cursor:pointer}
button:disabled{background:#d9d3e8;cursor:default}
.status{margin-top:16px;text-align:center;font-size:18px;min-height:27px;overflow-wrap:anywhere}
.ok{color:#2f9e6e;font-weight:700}.bad{color:#d6455d}
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
card.append(el('p', '구슬 경주 추첨기', 'eyebrow'), el('h1', 'ORB DERBY'));

if (!ROOM_RE.test(room)) {
  card.append(el('p', '참가 주소가 올바르지 않습니다. 진행자 화면의 QR 코드를 다시 찍어 주세요.'));
} else {
  card.append(el('p', '참가하기 — 이름을 입력하세요'));
  const input = el('input');
  input.type = 'text';
  input.maxLength = NAME_MAX;
  input.placeholder = '이름';
  input.autocomplete = 'off';
  try {
    input.value = (localStorage.getItem(LS_KEY) ?? '').slice(0, NAME_MAX);
  } catch {
    /* 저장소 사용 불가 */
  }
  const btn = el('button', '참가하기');
  const status = el('div', undefined, 'status');
  card.append(input, btn, status);

  const show = (text: string, cls = '') => {
    status.textContent = text;
    status.className = 'status ' + cls;
  };

  let peer: Peer | null = null;
  let attempt = 0;
  const cleanup = () => {
    peer?.destroy();
    peer = null;
  };

  const join = () => {
    const name = cleanName(input.value);
    if (!name) return show('이름을 1~20자로 입력해 주세요', 'bad');
    try {
      localStorage.setItem(LS_KEY, name);
    } catch {
      /* 무시 */
    }
    cleanup();
    const my = ++attempt;
    btn.disabled = true;
    show('연결 중...');
    let done = false;
    const finish = (text: string, cls: string, retry: boolean) => {
      if (done || my !== attempt) return;
      done = true;
      clearTimeout(timer);
      show(text, cls);
      btn.disabled = false;
      btn.textContent = retry ? '다시 시도' : '이름 바꿔 다시 참가';
    };
    const timer = window.setTimeout(() => {
      finish('진행자와 연결하지 못했습니다. 같은 방 주소인지 확인하고 다시 시도해 주세요.', 'bad', true);
      cleanup();
    }, TIMEOUT_MS);

    const p = new Peer();
    peer = p;
    p.on('error', (e) => finish(`연결 오류: ${(e as { type?: string }).type ?? '알 수 없음'}`, 'bad', true));
    p.on('open', () => {
      const conn = p.connect(room, { reliable: true });
      conn.on('open', () => {
        show('참가 요청 중...');
        const msg: JoinMsg = { type: 'join', name };
        conn.send(msg);
      });
      conn.on('data', (d) => {
        const r = d as Partial<JoinReply> | null;
        if (!r || r.type !== 'joined') return;
        if (r.ok) finish('참가 완료! 진행자 화면을 보세요', 'ok', false);
        else finish(r.reason ?? '참가하지 못했습니다', 'bad', true);
      });
      conn.on('error', () => finish('연결이 끊겼습니다. 다시 시도해 주세요.', 'bad', true));
    });
  };

  btn.addEventListener('click', join);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });
}
