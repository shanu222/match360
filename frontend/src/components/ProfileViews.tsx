import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { Profile } from '../lib/types';
import { Avatar } from './ui';

export function ProfileViews() {
  const q = useQuery({ queryKey: ['views'], queryFn: () => api.get<{ total: number; premium: boolean; viewers: { viewedAt: string; user: Profile }[] }>('/views'), staleTime: 60_000 });
  if (!q.data) return null;
  const { total, premium, viewers } = q.data;
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <Eye size={20} className="text-cobalt" />
        <div className="flex-1">
          <div className="font-semibold">{total === 1 ? '1 person viewed your profile' : `${total} people viewed your profile`}</div>
          <div className="text-sm text-slate">In the last 30 days</div>
        </div>
      </div>
      {premium ? (
        viewers.length > 0 && (
          <div className="mt-4 space-y-1">
            {viewers.slice(0, 8).map((v) => (
              <Link key={v.user.id} to={`/u/${v.user.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-paper">
                <Avatar src={v.user.photos[0]} name={v.user.name} className={v.user.photosBlurred ? 'h-10 w-10 blur-sm' : 'h-10 w-10'} rounded="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{v.user.firstName}{v.user.age ? `, ${v.user.age}` : ''}</div>
                  <div className="truncate text-sm text-slate">{v.user.job}, {v.user.city}</div>
                </div>
                <span className="text-xs text-slate">{timeAgo(v.viewedAt)}</span>
              </Link>
            ))}
          </div>
        )
      ) : (
        total > 0 && <Link to="/premium" className="btn btn-ghost mt-4 w-full">See who with Premium</Link>
      )}
    </div>
  );
}
