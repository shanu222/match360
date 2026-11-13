import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { onSocket } from '../lib/socket';
import { useToast } from '../context/Toast';
import type { Message, Notification } from '../lib/types';

/** Bridges socket events into the query cache and shows toasts only when useful. */
export function Realtime({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const loc = useLocation();

  useEffect(() => {
    const offs = [
      onSocket('notification', (n: Notification) => {
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['counts'] });
        const to = n.type === 'accepted' && n.ref_id ? `/chats/${n.ref_id}` : '/requests';
        toast({ title: n.type === 'accepted' ? 'New connection' : 'New connection request', body: n.body, to });
      }),
      onSocket('request:new', () => {
        qc.invalidateQueries({ queryKey: ['requests'] });
        qc.invalidateQueries({ queryKey: ['counts'] });
      }),
      onSocket('request:update', () => {
        qc.invalidateQueries({ queryKey: ['requests'] });
        qc.invalidateQueries({ queryKey: ['counts'] });
      }),
      onSocket('match:new', () => {
        qc.invalidateQueries({ queryKey: ['matches'] });
        qc.invalidateQueries({ queryKey: ['requests'] });
        qc.invalidateQueries({ queryKey: ['me'] });
      }),
      onSocket('match:removed', () => {
        qc.invalidateQueries({ queryKey: ['matches'] });
      }),
      onSocket('message', (m: Message & { match_id: string }) => {
        qc.setQueryData<{ pages: { messages: Message[]; hasMore: boolean }[] }>(['messages', m.match_id], (old) => {
          if (!old) return old;
          const pages = [...old.pages];
          const last = { ...pages[pages.length - 1] };
          const exists = last.messages.some((x) => x.id === m.id || (m.client_id && x.client_id === m.client_id));
          last.messages = exists
            ? last.messages.map((x) => (m.client_id && x.client_id === m.client_id ? { ...m, pending: false, failed: false } : x))
            : [...last.messages, m];
          pages[pages.length - 1] = last;
          return { ...old, pages };
        });
        qc.invalidateQueries({ queryKey: ['matches'] });
        if (m.sender_id !== myId) {
          qc.invalidateQueries({ queryKey: ['counts'] });
          if (!window.location.pathname.endsWith(m.match_id)) {
            toast({ title: 'New message', body: m.body.length > 80 ? m.body.slice(0, 80) + '…' : m.body, to: `/chats/${m.match_id}` });
          }
        }
      }),
      onSocket('read', (p: { matchId: string; at: string }) => {
        qc.setQueryData<{ pages: { messages: Message[]; hasMore: boolean }[] }>(['messages', p.matchId], (old) =>
          old
            ? { ...old, pages: old.pages.map((pg) => ({ ...pg, messages: pg.messages.map((x) => (x.sender_id === myId && !x.read_at ? { ...x, read_at: p.at } : x)) })) }
            : old,
        );
      }),
      onSocket('connect', () => {
        // Catch up on anything missed while disconnected.
        qc.invalidateQueries({ queryKey: ['counts'] });
        qc.invalidateQueries({ queryKey: ['matches'] });
        qc.invalidateQueries({ queryKey: ['messages'] });
      }),
    ];
    return () => offs.forEach((f) => f());
  }, [qc, toast, myId]);

  // keep location referenced so the toast check re-evaluates after navigation
  void loc;
  return null;
}
