// 구글 애널리틱스(PM 소유). 배포 빌드 + ID(VITE_GA_ID, GitHub 저장소 변수 GA_ID)가 있을 때만 동작.
//  - G-XXXX(GA4 측정 ID): gtag.js 직접. page_location에서 쿼리·해시 제거.
//  - GTM-XXXX(태그 매니저 컨테이너): gtm.js 로드 + dataLayer 이벤트만 올린다. 실제 GA4 전송·페이지뷰는 GTM 컨테이너 설정이 담당.
// 이벤트: race_start{participants, mode}, race_end{participants, mode, duration_s}. 참가자 이름은 절대 넣지 않는다.

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim() ?? '';
const isGA4 = /^G-[A-Z0-9]{4,20}$/.test(ID);
const isGTM = /^GTM-[A-Z0-9]{4,20}$/.test(ID);
const enabled = import.meta.env.PROD && (isGA4 || isGTM);

function cleanLocation(): string {
  return location.origin + location.pathname; // 쿼리(?room=… ?auto=…)·해시 제거
}

if (enabled && isGTM) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${ID}`;
  document.head.appendChild(s);
}

if (enabled && isGA4) {
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
  if (!enabled) return;
  if (isGTM) {
    window.dataLayer!.push({ event: name, ...params }); // GTM 맞춤 이벤트 트리거 이름 = race_start / race_end
    return;
  }
  window.gtag?.('event', name, { ...params, page_location: cleanLocation() });
}
