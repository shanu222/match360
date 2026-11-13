import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { BadgeCheck, Loader2, X } from 'lucide-react';

export function Spinner({ className, size = 22 }: { className?: string; size?: number }) {
  return <Loader2 size={size} className={clsx('animate-spin text-ink-300', className)} />;
}

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink-400">
      <Spinner size={28} />
      {label && <div className="text-sm">{label}</div>}
    </div>
  );
}

const HUES = [[350, 280], [265, 320], [200, 255], [20, 340], [160, 210], [290, 340], [40, 10], [225, 285]];
function hueFor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function Avatar({ src, name, className, rounded = 'rounded-2xl' }: { src?: string | null; name: string; className?: string; rounded?: string }) {
  const gid = `av${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (src)
    return <img src={src} alt={name} loading="lazy" className={clsx('shrink-0 bg-ink-700 object-cover', rounded, className)} />;
  const [a, b] = hueFor(name || '?');
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <svg role="img" aria-label={name} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className={clsx('shrink-0', rounded, className)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${a} 80% 62%)`} />
          <stop offset="1" stopColor={`hsl(${b} 65% 38%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gid})`} />
      <text x="50" y="50" dy=".35em" textAnchor="middle" fontSize="36" fontWeight="800" fill="rgba(255,255,255,.95)" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
        {initials}
      </text>
    </svg>
  );
}

export function Verified({ size = 18 }: { size?: number }) {
  return (
    <span title="Verified email">
      <BadgeCheck size={size} className="shrink-0 fill-sky-500 text-white" />
    </span>
  );
}

export function Modal({ open, onClose, children, title, wide }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'max-h-[92dvh] w-full animate-fade-up overflow-y-auto rounded-t-[28px] border border-ink-700 bg-ink-900 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-card sm:rounded-[28px]',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          {title ? <h2 className="text-xl font-extrabold tracking-tight">{title}</h2> : <span />}
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-xl p-2 text-ink-400 hover:bg-ink-800 hover:text-white">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-ink-700 bg-ink-850 text-coral">{icon}</div>
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      {text && <p className="mt-2 text-[15px] leading-relaxed text-ink-400">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <p className="text-ink-300">{message}</p>
      {onRetry && (
        <button className="btn btn-ghost mt-5" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function ScoreRing({ score, size = 170, stroke = 12, label }: { score: number; size?: number; stroke?: number; label?: ReactNode }) {
  const gid = `ring${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff5f6d" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#252036" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-extrabold leading-none" style={{ fontSize: size * 0.26 }}>
          {score}%
        </div>
        {label && <div className="mt-1.5 text-xs text-ink-400">{label}</div>}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={clsx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-coral' : 'bg-ink-600')}
    >
      <span className={clsx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
    </button>
  );
}
