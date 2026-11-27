// 다국어(PM 소유 틀, 사전 내용은 i18n 워커가 src/i18n-dict.ts에 채운다). 캡틴: 영어판 — 자동 감지 + KO/EN 토글.
// 규칙
//  - 화면·aria·title 문구는 모두 t('키', {변수})로. 키는 점 구분(예 'lobby.start', 'hud.elapsed').
//  - ko와 en은 같은 키 집합을 가져야 한다.
//  - 변수 자리는 {name} 형태. 서수·복수 같은 언어별 차이는 함수 값으로(예: (p) => `${p.n}${ord(p.n)}`).
//  - 참가자 이름 등 사용자 입력은 사전에 넣지 않고 textContent로 따로 넣는다.
import { en, ko } from './i18n-dict';

export type Lang = 'ko' | 'en';
export type Params = Record<string, string | number>;
export type Entry = string | ((p: Params) => string);
export type Dict = Record<string, Entry>;

const LS = 'orb-derby:lang';
const DICTS: Record<Lang, Dict> = { ko, en };

function detect(): Lang {
  const qs = new URLSearchParams(location.search).get('lang');
  if (qs === 'ko' || qs === 'en') return qs;
  try {
    const saved = localStorage.getItem(LS);
    if (saved === 'ko' || saved === 'en') return saved;
  } catch {
    /* 저장소 없음 */
  }
  return (navigator.languages?.[0] ?? navigator.language ?? 'en').toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

// SEO: hreflang 링크가 있는 페이지(index.html)만. canonical은 실제 URL 기준(?lang=ko/en은 각자, 기본 주소는 x-default),
// description은 표시 언어 기준. 크롤러는 영어 브라우저로 렌더링하므로 기본 주소가 영어 설명을 갖게 된다.
const DESC: Record<Lang, string> = {
  ko: '이름을 넣으면 구슬이 3D 장애물 탑을 굴러 내려가 순위를 정하는 무료 구슬 경주 추첨기. 룰렛·돌림판 추첨 대신 랜덤 뽑기, 제비뽑기, 순서 정하기, 벌칙 당첨자 뽑기에 쓰세요. 2~40명, QR로 휴대폰 참가, 설치·가입 없음.',
  en: 'A free 3D marble race picker: enter 2-40 names and the marbles race down an obstacle tower to pick a winner or the full order. A fun alternative to a roulette wheel or random name picker. Join by QR, no sign-up.',
};

function applyHead(l: Lang) {
  if (!document.querySelector('link[rel="alternate"][hreflang]')) return;
  const qs = new URLSearchParams(location.search).get('lang');
  const href = `${location.origin}${location.pathname}${qs === 'ko' || qs === 'en' ? `?lang=${qs}` : ''}`;
  let canon = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canon) {
    canon = document.createElement('link');
    canon.rel = 'canonical';
    document.head.append(canon);
  }
  canon.href = href;
  document.querySelector('meta[name="description"]')?.setAttribute('content', DESC[l]);
}

let lang: Lang = detect();
document.documentElement.lang = lang;
applyHead(lang);
const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang {
  return lang;
}

/** 언어 변경 + 저장 + 구독자(화면 다시 그리기) 호출. 페이지 새로고침 없이(QR 방 유지). */
export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l;
  document.documentElement.lang = l;
  applyHead(l);
  try {
    localStorage.setItem(LS, l);
  } catch {
    /* noop */
  }
  for (const f of listeners) f(l);
}

export function onLangChange(f: (l: Lang) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** 번역. 키가 없으면 ko → 키 문자열 순으로 대체(누락이 화면에 키로 드러나게). */
export function t(key: string, p: Params = {}): string {
  const e = DICTS[lang][key] ?? DICTS.ko[key];
  if (e === undefined) return key;
  if (typeof e === 'function') return e(p);
  return e.replace(/\{(\w+)\}/g, (_, k: string) => (k in p ? String(p[k]) : `{${k}}`));
}
