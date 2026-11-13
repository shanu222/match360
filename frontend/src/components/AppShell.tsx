import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, Compass, MessageCircle, Settings, UserRound, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { Counts, Notification } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { Avatar, Modal, Spinner } from './ui';
import { Realtime } from './Realtime';

const NAV = [
  { to: '/discover', label: 'Discover', icon: Compass, count: null as null | keyof Counts },
  { to: '/challenges', label: 'Challenges', icon: Zap, count: 'pendingRequests' as const },
  { to: '/chats', label: 'Chats', icon: MessageCircle, count: 'unreadMessages' as const },
  { to: '/me', label: 'Profile', icon: UserRound, count: null },
];

function Badge({ n, className }: { n?: number; className?: string }) {
  if (!n) return null;
  return <span className={clsx('flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cobalt px-1.5 text-[11px] font-bold text-white', className)}>{n > 99 ? '99+' : n}</span>;
}

export function AppShell() {
  const { me } = useAuth();
  const loc = useLocation();
  const [bell, setBell] = useState(false);
  const countsQ = useQuery({ queryKey: ['counts'], queryFn: () => api.get<Counts>('/me/counts'), refetchInterval: 45_000, initialData: me?.counts });
  const counts = countsQ.data;
  const inChat = /^\/chats\/[^/]+/.test(loc.pathname);
  const user = me!.user;

  return (
    <div className="min-h-dvh lg:pl-72">
      <Realtime myId={user.id} />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-rule bg-card px-5 py-6 backdrop-blur lg:flex">
        <NavLink to="/discover" className="px-2">
          <Logo />
        </NavLink>
        <nav className="mt-10 flex flex-col gap-1.5">
          {NAV.map(({ to, label, icon: Icon, count }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx('flex items-center gap-3.5 rounded-2xl px-4 py-3 text-[15px] font-semibold transition', isActive ? 'bg-paper text-ink' : 'text-slate hover:bg-paper hover:text-ink')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={21} className={isActive ? 'text-cobalt' : ''} />
                  <span className="flex-1">{label}</span>
                  <Badge n={count ? counts?.[count] : 0} />
                </>
              )}
            </NavLink>
          ))}
          <button onClick={() => setBell(true)} className="flex items-center gap-3.5 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold text-slate transition hover:bg-paper hover:text-ink">
            <Bell size={21} />
            <span className="flex-1">Notifications</span>
            <Badge n={counts?.unreadNotifications} />
          </button>
        </nav>
        <div className="mt-auto">
          <NavLink to="/settings" className="mb-3 flex items-center gap-3.5 rounded-2xl px-4 py-3 text-[15px] font-semibold text-slate hover:bg-paper hover:text-ink">
            <Settings size={21} /> Settings
          </NavLink>
          <NavLink to="/me" className="flex items-center gap-3 rounded-2xl border border-rule bg-card p-3 border-rule">
            <Avatar src={user.photos[0]} name={user.name} className="h-11 w-11" />
            <div className="min-w-0">
              <div className="truncate font-bold">{user.name}</div>
              <div className="truncate text-xs text-slate">{user.email}</div>
            </div>
          </NavLink>
        </div>
      </aside>

      {/* Mobile top bar */}
      {!inChat && (
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-paper/90 px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))] backdrop-blur lg:hidden">
          <NavLink to="/discover"><Logo size={30} /></NavLink>
          <div className="flex items-center gap-2">
            <NavLink to="/settings" aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rule bg-card text-slate">
              <Settings size={19} />
            </NavLink>
            <button aria-label="Notifications" onClick={() => setBell(true)} className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-rule bg-card text-slate">
              <Bell size={19} />
              <Badge n={counts?.unreadNotifications} className="absolute -right-1.5 -top-1.5" />
            </button>
          </div>
        </header>
      )}

      <main className={clsx('mx-auto w-full max-w-5xl', inChat ? 'lg:px-10 lg:pb-12 lg:pt-10' : 'px-4 pb-28 pt-4 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10')}>
        <Outlet />
      </main>

      {/* Mobile tab bar */}
      {!inChat && (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-rule bg-paper/90 px-2 pb-[calc(.6rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
          {NAV.map(({ to, label, icon: Icon, count }) => (
            <NavLink key={to} to={to} className={({ isActive }) => clsx('relative flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-semibold', isActive ? 'text-ink' : 'text-slate')}>
              {({ isActive }) => (
                <>
                  <Icon size={22} className={isActive ? 'text-cobalt' : ''} />
                  {label}
                  <Badge n={count ? counts?.[count] : 0} className="absolute right-[calc(50%-22px)] -top-1" />
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      <Notifications open={bell} onClose={() => setBell(false)} />
    </div>
  );
}

function Notifications({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ notifications: Notification[] }>('/notifications'), enabled: open });
  const markRead = useMutation({
    mutationFn: () => api.post('/notifications/read'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['counts'] }),
  });
  const close = () => {
    if (q.data?.notifications.some((n) => !n.read)) markRead.mutate();
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title="Notifications">
      <div className="mt-4 space-y-2">
        {q.isLoading && <div className="flex justify-center py-10"><Spinner /></div>}
        {q.isError && <p className="py-8 text-center text-slate">Couldn’t load notifications.</p>}
        {q.data && !q.data.notifications.length && <p className="py-10 text-center text-slate">You’re all caught up. Challenge requests and new connections will show here.</p>}
        {q.data?.notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              close();
              nav(n.type === 'accepted' && n.ref_id ? `/chats/${n.ref_id}` : '/challenges');
            }}
            className={clsx('flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-paper', !n.read && 'bg-card')}
          >
            <Avatar src={n.actor_photo} name={n.actor_name || 'Match360'} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <div className={clsx('text-sm leading-snug', !n.read ? 'font-bold text-ink' : 'text-slate')}>{n.body}</div>
              <div className="mt-0.5 text-xs text-slate">{timeAgo(n.created_at)}</div>
            </div>
            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-cobalt" />}
          </button>
        ))}
      </div>
    </Modal>
  );
}
