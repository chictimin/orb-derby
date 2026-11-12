// 구글 애널리틱스(GA4, PM 소유). 배포 빌드 + 측정 ID(VITE_GA_ID, GitHub 저장소 변수 GA_ID)가 있을 때만 동작.
// 개인정보: 참가자 이름·QR 방 코드 등 주소 쿼리는 보내지 않는다(page_location에서 쿼리·해시 제거).
// 보내는 이벤트: page_view, race_start{participants, mode}, race_end{participants, mode, duration_s}.

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim() ?? '';
const enabled = import.meta.env.PROD && /^G-[A-Z0-9]{4,20}$/.test(ID);

function cleanLocation(): string {
  return location.origin + location.pathname; // 쿼리(?room=… ?auto=…)·해시 제거
}

if (enabled) {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  window.gtag('event', 'page_view', { page_location: cleanLocation(), page_title: document.title });
}

/** 이벤트 전송. 이름 같은 개인 식별 정보는 넣지 않는다. */
export function track(name: 'race_start' | 'race_end', params: Record<string, string | number>) {
  if (!enabled || !window.gtag) return;
  window.gtag('event', name, { ...params, page_location: cleanLocation() });
}
