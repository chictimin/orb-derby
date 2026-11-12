// QR 참가 진행자 피어(PeerJS). 계약: src/types.ts StartPartyHost.
import Peer, { type DataConnection } from 'peerjs';
import QRCode from 'qrcode';
import type { JoinInfo, JoinMsg, JoinReply, StartPartyHost } from '../types';
import { cleanName, makeRoomId } from './protocol';

const MAX_ID_TRIES = 3;

function openPeer(id: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const p = new Peer(id);
    p.once('open', () => resolve(p));
    p.once('error', (e) => {
      p.destroy();
      reject(e);
    });
  });
}

export const startPartyHost: StartPartyHost = async (onJoin, onStatus) => {
  onStatus('connecting');
  let peer: Peer | null = null;
  let roomId = '';
  let lastErr: unknown = null;
  for (let i = 0; i < MAX_ID_TRIES && !peer; i++) {
    roomId = makeRoomId();
    try {
      peer = await openPeer(roomId);
    } catch (e) {
      lastErr = e;
      if ((e as { type?: string })?.type !== 'unavailable-id') break;
    }
  }
  if (!peer) {
    const msg = 'party.connectFail';
    console.warn('[party]', (lastErr as { type?: string })?.type ?? 'unknown');
    onStatus('error', msg);
    throw lastErr instanceof Error ? lastErr : new Error(msg);
  }
  const p = peer;

  const reply = (conn: DataConnection, r: JoinReply) => {
    try {
      conn.send(r);
    } catch {
      /* 끊긴 연결 */
    }
  };
  const handle = (conn: DataConnection, data: unknown) => {
    const m = data as Partial<JoinMsg> | null;
    if (!m || typeof m !== 'object' || m.type !== 'join') return reply(conn, { type: 'joined', ok: false, reason: 'host.badRequest' });
    const name = cleanName(m.name);
    if (!name) return reply(conn, { type: 'joined', ok: false, reason: 'host.badName' });
    let r: { ok: boolean; reason?: string };
    try {
      r = onJoin(name);
    } catch {
      r = { ok: false, reason: 'host.failed' };
    }
    reply(conn, { type: 'joined', ok: r.ok, reason: r.reason });
  };

  p.on('connection', (conn) => {
    conn.on('data', (d) => handle(conn, d));
    conn.on('error', () => {});
  });
  p.on('disconnected', () => {
    if (p.destroyed) return;
    onStatus('connecting', 'party.reconnecting');
    p.reconnect();
  });
  p.on('open', () => onStatus('ready'));
  p.on('error', (e) => {
    const t = (e as { type?: string }).type;
    // 개별 참가자 쪽 오류(peer-unavailable 등)는 방 전체 오류가 아니다
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') onStatus('connecting', 'party.reconnecting');
    else console.warn('[party]', e);
  });

  const u = new URL('join.html', location.href);
  u.search = `?room=${roomId}`;
  u.hash = '';
  const url = u.toString();
  const host = location.hostname;
  const unreachable = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 360 });
  const info: JoinInfo = { roomId, url, qrDataUrl, unreachable };
  console.info('[party] 참가 URL:', url);
  onStatus('ready');
  return { info, close: () => p.destroy() };
};
