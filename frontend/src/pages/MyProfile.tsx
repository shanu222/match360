import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Award, BadgeCheck, Eye, Handshake, ListChecks, MessageCircle, Pencil, Settings, Target, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProfileView } from '../components/ProfileView';
import { ProfileViews } from '../components/ProfileViews';
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
    [Target, 'First request', st.challengesTaken >= 1],
    [ListChecks, '5 requests', st.challengesTaken >= 5],
    [Award, 'Perfect answers', st.perfectScores >= 1],
    [Handshake, 'First connection', st.connections >= 1],
    [Users, 'Popular', st.requestsReceived >= 5],
    [MessageCircle, 'Conversationalist', st.messagesSent >= 25],
    [UserCheck, 'Complete profile', score >= 90],
    [BadgeCheck, 'ID verified', u.verified],
  ] as const;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
      <div className="card overflow-hidden">
        <ProfileView p={u.photoBlur ? { ...u, photos: u.photosBlur.filter((b, i) => b && b !== u.photos[i]), photosBlurred: true } : u} self heroClass="h-[420px]" />
        {u.photoBlur && <p className="border-t border-rule px-5 py-3 text-sm text-slate">Your photos are blurred for others until you connect. Turn this off in Settings.</p>}
      </div>
      <div className="space-y-4">
        <div className="flex gap-3">
          <Link to="/me/edit" className="btn btn-primary flex-1"><Pencil size={17} /> Edit profile</Link>
          <Link to="/settings" className="btn btn-ghost"><Settings size={17} /> Settings</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            [st.challengesTaken, 'Profiles answered'],
            [`${st.avgScore}%`, 'Average result'],
            [st.connections, 'Connections'],
          ].map(([v, l]) => (
            <div key={l} className="card p-4 text-center">
              <div className="text-2xl font-bold">{v}</div>
              <div className="mt-0.5 text-xs font-semibold text-slate">{l}</div>
            </div>
          ))}
        </div>
        <ProfileViews />
        <div className="card p-5">
          <div className="flex justify-between text-sm font-bold"><span>Profile strength</span><span>{score}%</span></div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-rule"><div className="h-full rounded-full bg-cobalt transition-all" style={{ width: `${score}%` }} /></div>
          {tips.length > 0 && <p className="mt-3 text-sm text-slate">Next: {tips.slice(0, 3).join(', ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</p>}
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">Score you hope for: {u.threshold}%</div>
              <div className="mt-0.5 text-sm text-slate">People see this before they answer questions about you.</div>
            </div>
          </div>
          <button onClick={() => nav('/me/preview')} className="btn btn-ghost mt-4 w-full"><Eye size={17} /> How others see me</button>
        </div>
        <div className="card p-5">
          <div className="mb-4 font-semibold">Milestones</div>
          <div className="grid grid-cols-4 gap-3">
            {badges.map(([Icon, l, got]) => (
              <div key={l} className="text-center">
                <div className={clsx('mx-auto flex h-12 w-12 items-center justify-center rounded-xl', got ? 'bg-marker text-ink' : 'bg-paper text-slate/50')}><Icon size={20} /></div>
                <div className={clsx('mt-1.5 text-[11px] font-semibold leading-tight', got ? 'text-ink' : 'text-slate')}>{l}</div>
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
        <h1 className="text-xl font-bold">How others see you</h1>
        <button className="btn btn-ghost px-4 py-2" onClick={() => nav(-1)}>Done</button>
      </div>
      {me.user.photoBlur && <p className="mb-3 text-sm text-slate">Your photos are blurred for everyone until you connect with them.</p>}
      <div className="card overflow-hidden">
        <ProfileView
          p={{ ...me.user, compatibility: 0, sharedInterests: [], photos: me.user.photoBlur ? me.user.photosBlur.filter((b, i) => b && b !== me.user.photos[i]) : me.user.photos, photosBlurred: me.user.photoBlur }}
          heroClass="h-[min(70dvh,560px)]"
        />
      </div>
    </div>
  );
}
