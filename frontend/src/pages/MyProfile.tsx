import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Eye, Pencil, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProfileView } from '../components/ProfileView';
import { FullScreenLoader } from '../components/ui';
import { useEffect } from 'react';

function strength(u: NonNullable<ReturnType<typeof useAuth>['me']>['user']) {
  let s = 0;
  const tips: string[] = [];
  if (u.photos.length) s += 20; else tips.push('Add a photo');
  if (u.photos.length >= 3) s += 10; else tips.push('Add 3+ photos');
  if (u.bio) s += 10; else tips.push('Write a short bio');
  if (u.education) s += 10; else tips.push('Add education');
  if (u.languages) s += 5;
  s += Math.min(20, u.interests.length * 4);
  s += u.prompts.length >= 3 ? 25 : u.prompts.length * 8;
  if (u.prompts.length < 3) tips.push('Answer all 3 prompts');
  return { score: Math.min(100, s), tips };
}

export default function MyProfile() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['me'] });
  }, [qc]);
  if (!me) return <FullScreenLoader />;
  const u = me.user;
  const st = me.stats;
  const { score, tips } = strength(u);
  const badges = [
    ['🎯', 'First challenge', st.challengesTaken >= 1],
    ['🔥', '5 challenges', st.challengesTaken >= 5],
    ['🧠', 'Perfect score', st.perfectScores >= 1],
    ['🤝', 'First connection', st.connections >= 1],
    ['🌟', 'Popular', st.requestsReceived >= 5],
    ['💬', 'Conversationalist', st.messagesSent >= 25],
    ['💎', 'Complete profile', score >= 90],
    ['✅', 'Verified email', u.verified],
  ] as const;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
      <div className="card overflow-hidden">
        <ProfileView p={u} self heroClass="h-[420px]" />
      </div>
      <div className="space-y-4">
        <div className="flex gap-3">
          <Link to="/me/edit" className="btn btn-primary flex-1"><Pencil size={17} /> Edit profile</Link>
          <Link to="/settings" className="btn btn-ghost"><Settings size={17} /> Settings</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            [st.challengesTaken, 'Challenges'],
            [`${st.avgScore}%`, 'Avg score'],
            [st.connections, 'Connections'],
          ].map(([v, l]) => (
            <div key={l} className="card p-4 text-center">
              <div className="text-2xl font-extrabold">{v}</div>
              <div className="mt-0.5 text-xs font-semibold text-ink-400">{l}</div>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <div className="flex justify-between text-sm font-bold"><span>Profile strength</span><span>{score}%</span></div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${score}%` }} /></div>
          {tips.length > 0 && <p className="mt-3 text-sm text-ink-400">Next: {tips.slice(0, 3).join(' · ')}</p>}
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">Your challenge bar: {u.threshold}%</div>
              <div className="mt-0.5 text-sm text-ink-400">People see this before taking your challenge.</div>
            </div>
          </div>
          <button onClick={() => nav('/me/preview')} className="btn btn-ghost mt-4 w-full"><Eye size={17} /> How others see me</button>
        </div>
        <div className="card p-5">
          <div className="mb-4 font-bold">Achievements</div>
          <div className="grid grid-cols-4 gap-3">
            {badges.map(([e, l, got]) => (
              <div key={l} className="text-center">
                <div className={clsx('mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl', got ? 'border border-coral/40 bg-coral/10' : 'bg-ink-800 opacity-35 grayscale')}>{e}</div>
                <div className={clsx('mt-1.5 text-[11px] font-semibold leading-tight', got ? 'text-white' : 'text-ink-400')}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PreviewSelf() {
  const { me } = useAuth();
  const nav = useNavigate();
  if (!me) return <FullScreenLoader />;
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold">How others see you</h1>
        <button className="btn btn-ghost px-4 py-2" onClick={() => nav(-1)}>Done</button>
      </div>
      <div className="card overflow-hidden"><ProfileView p={{ ...me.user, compatibility: 0, sharedInterests: [] }} heroClass="h-[min(70dvh,560px)]" /></div>
    </div>
  );
}
