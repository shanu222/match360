import { useId } from 'react';
import clsx from 'clsx';

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const gid = `m360g${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5f6d" />
          <stop offset=".5" stopColor="#c85ab8" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${gid})`} />
      <circle cx="25" cy="35" r="11.5" fill="none" stroke="#fff" strokeWidth="4.6" />
      <circle cx="39" cy="35" r="11.5" fill="none" stroke="#fff" strokeOpacity=".78" strokeWidth="4.6" />
      <path d="M32 26.3a11.5 11.5 0 0 1 0 17.4" fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M48 9.5l1.7 4.3 4.3 1.7-4.3 1.7L48 21.5l-1.7-4.3-4.3-1.7 4.3-1.7z" fill="#fff" />
    </svg>
  );
}

export function Logo({ size = 34, className, text = true }: { size?: number; className?: string; text?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      {text && (
        <span className="text-[22px] font-extrabold tracking-tight">
          Match<span className="text-brand">360</span>
        </span>
      )}
    </span>
  );
}
