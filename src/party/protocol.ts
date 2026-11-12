// QR 참가 공용 상수·검증(진행자/참가 페이지 공유).
export const ROOM_PREFIX = 'orbderby-';
export const ROOM_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // 혼동 문자(i,l,o,0,1) 제외
export const ROOM_RE = /^orbderby-[abcdefghjkmnpqrstuvwxyz23456789]{6}$/;
export const NAME_MAX = 20;

export function makeRoomId(): string {
  const a = new Uint32Array(6);
  crypto.getRandomValues(a);
  return ROOM_PREFIX + Array.from(a, (v) => ROOM_CHARS[v % ROOM_CHARS.length]).join('');
}

/** 제어문자 제거 + trim. 1~NAME_MAX자가 아니면 null */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let s = '';
  for (const ch of v) {
    const c = ch.codePointAt(0)!;
    const bad = c < 0x20 || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e);
    if (!bad) s += ch;
  }
  s = s.trim();
  return s.length >= 1 && s.length <= NAME_MAX ? s : null;
}
