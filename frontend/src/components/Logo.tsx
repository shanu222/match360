import clsx from 'clsx';

/** Two people, and the overlap that is what you know about each other. */
export function LogoMark({ size = 32, className, tile = false }: { size?: number; className?: string; tile?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      {tile && <rect width="64" height="64" rx="16" fill="#2541D8" />}
      <path d="M32 20.5a14 14 0 0 1 0 23a14 14 0 0 1 0-23z" fill="#FFD84D" />
      <circle cx="24" cy="32" r="14" fill="none" stroke={tile ? '#fff' : '#2541D8'} strokeWidth="4.5" />
      <circle cx="40" cy="32" r="14" fill="none" stroke={tile ? '#fff' : '#2541D8'} strokeWidth="4.5" />
    </svg>
  );
}

export function Logo({ size = 30, className, text = true }: { size?: number; className?: string; text?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      {text && <span className="font-display text-[21px] font-bold tracking-[-0.03em] text-ink">match360</span>}
    </span>
  );
}
