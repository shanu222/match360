import { useNavigate } from 'react-router';
import { Clock, EyeOff, ListChecks, Repeat } from 'lucide-react';
import { Avatar, Modal } from './ui';

/** Shown after someone has read a full profile and chooses to connect (or accept). */
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
        <h2 className="mt-4 text-2xl font-bold">{purpose === 'request' ? `Connect with ${user.firstName}` : `Accept ${user.firstName}’s request`}</h2>
        <p className="mt-2 text-slate">
          {purpose === 'request'
            ? `Answer five quick questions about ${user.firstName}. Everything you need is in the profile you just read.`
            : `${user.firstName} read your profile and got ${theirScore ?? 0}% right. Answer five quick questions about ${user.firstName} to accept.`}
        </p>
      </div>
      <ul className="mt-6 space-y-3 text-[15px]">
        <li className="flex gap-3"><Clock className="shrink-0 text-cobalt" size={20} />20 seconds for each question</li>
        <li className="flex gap-3"><EyeOff className="shrink-0 text-cobalt" size={20} />The profile is hidden while you answer</li>
        <li className="flex gap-3"><ListChecks className="shrink-0 text-cobalt" size={20} />{user.firstName} sees how many you got right</li>
        {purpose === 'request' && <li className="flex gap-3"><Repeat className="shrink-0 text-cobalt" size={20} />One try a day for each person</li>}
      </ul>
      <div className="mt-7 grid grid-cols-2 gap-3">
        <button className="btn btn-ghost" onClick={onClose}>Read again</button>
        <button
          className="btn btn-primary"
          onClick={() => {
            onClose();
            nav(`/connect/${user.id}?purpose=${purpose}`);
          }}
        >
          I’m ready
        </button>
      </div>
    </Modal>
  );
}
