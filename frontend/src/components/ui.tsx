import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { BadgeCheck, Loader2, X } from 'lucide-react';

export function Spinner({ className, size = 22 }: { className?: string; size?: number }) {
  return <Loader2 size={size} className={clsx('animate-spin text-slate', className)} />;
}

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate">
      <Spinner size={28} />
      {label && <div className="text-sm">{label}</div>}
    </div>
  );
}

const TONES = ['#2541D8', '#101935', '#0E7C66', '#B4462C', '#6B4FA0', '#1F6FB2', '#8A5A00'];
function toneFor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function Avatar({ src, name, className, rounded = 'rounded-2xl' }: { src?: string | null; name: string; className?: string; rounded?: string }) {
  if (src)
    return <img src={src} alt={name} loading="lazy" className={clsx('shrink-0 bg-rule object-cover', rounded, className)} />;
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <svg role="img" aria-label={name} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className={clsx('shrink-0', rounded, className)}>
      <rect width="100" height="100" fill={toneFor(name || '?')} />
      <text x="50" y="50" dy=".35em" textAnchor="middle" fontSize="34" fontWeight="700" fill="#fff" fontFamily="Bricolage Grotesque Variable, system-ui, sans-serif">
        {initials}
      </text>
    </svg>
  );
}

export function Verified({ size = 18 }: { size?: number }) {
  return (
    <span title="Verified email">
      <BadgeCheck size={size} className="shrink-0 fill-cobalt text-white" />
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
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'max-h-[92dvh] w-full animate-rise overflow-y-auto rounded-t-3xl bg-card p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-lift sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          {title ? <h2 className="text-xl font-bold">{title}</h2> : <span />}
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-xl p-2 text-slate hover:bg-paper hover:text-ink">
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
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-rule bg-card text-cobalt">{icon}</div>
      <h2 className="text-xl font-bold">{title}</h2>
      {text && <p className="mt-2 text-[15px] leading-relaxed text-slate">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <p className="text-slate">{message}</p>
      {onRetry && (
        <button className="btn btn-ghost mt-5" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** The score, marked like a grade on a returned paper. */
export function ScoreStamp({ score, label, size = 'lg' }: { score: number; label?: ReactNode; size?: 'lg' | 'sm' }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={clsx(
          'relative inline-block animate-stamp font-display font-bold leading-none tracking-[-0.04em] text-ink',
          size === 'lg' ? 'text-[104px]' : 'text-5xl',
        )}
      >
        <span className="absolute inset-x-[-0.12em] bottom-[0.08em] top-[0.42em] -z-10 rounded-[4px] bg-marker" />
        {score}
        <span className={size === 'lg' ? 'text-[52px]' : 'text-2xl'}>%</span>
      </div>
      {label && <div className="mt-3 text-sm text-slate">{label}</div>}
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
      className={clsx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-cobalt' : 'bg-rule')}
    >
      <span className={clsx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
    </button>
  );
}
