import { useNavigate } from 'react-router';
import { Clock, Eye, ListChecks, Target } from 'lucide-react';
import { Avatar, Modal } from './ui';

export function ChallengeIntro({
  open,
  onClose,
  user,
  purpose,
  theirScore,
}: {
  open: boolean;
  onClose: () => void;
  user: { id: string; firstName: string; name: string; photos: string[]; threshold: number };
  purpose: 'request' | 'accept';
  theirScore?: number;
}) {
  const nav = useNavigate();
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <Avatar src={user.photos[0]} name={user.name} className="h-20 w-20" rounded="rounded-2xl" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight">
          {purpose === 'request' ? `Ready for ${user.firstName}’s challenge?` : `Your turn: how well do you know ${user.firstName}?`}
        </h2>
        {purpose === 'accept' && theirScore != null && (
          <p className="mt-2 text-slate">
            {user.firstName} scored <b className="text-ink">{theirScore}%</b> on you. To accept, answer five questions about {user.firstName}. Your score is shared with them.
          </p>
        )}
      </div>
      <ul className="mt-6 space-y-3 text-[15px] text-slate">
        <li className="flex gap-3"><ListChecks className="shrink-0 text-cobalt" size={20} />Five questions about {user.firstName}</li>
        <li className="flex gap-3"><Clock className="shrink-0 text-cobalt" size={20} />20 seconds per question</li>
        <li className="flex gap-3"><Eye className="shrink-0 text-cobalt" size={20} />The profile is hidden while you answer</li>
        {purpose === 'request' && <li className="flex gap-3"><Target className="shrink-0 text-cobalt" size={20} />{user.firstName} hopes for {user.threshold}% or more. You get one attempt a day.</li>}
      </ul>
      <div className="mt-7 grid grid-cols-2 gap-3">
        <button
          className="btn btn-ghost"
          onClick={() => {
            onClose();
            nav(`/u/${user.id}`);
          }}
        >
          Study profile
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            onClose();
            nav(`/challenge/${user.id}?purpose=${purpose}`);
          }}
        >
          Start now
        </button>
      </div>
    </Modal>
  );
}
