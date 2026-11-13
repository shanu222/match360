import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface Toast { id: number; title: string; body?: string; tone?: 'info' | 'success' | 'error'; image?: string | null; to?: string }
const Ctx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const n = useRef(0);
  const nav = useNavigate();
  const dismiss = useCallback((id: number) => setList((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++n.current;
      setList((l) => [...l.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === 'error' ? 6000 : 4500);
    },
    [dismiss],
  );
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-3 sm:items-end sm:p-5" aria-live="polite">
        {list.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => {
              if (t.to) nav(t.to);
              dismiss(t.id);
            }}
            className={clsx(
              'pointer-events-auto flex w-full max-w-sm animate-fade-up cursor-pointer items-center gap-3 rounded-2xl border bg-ink-800/95 p-3.5 shadow-card backdrop-blur',
              t.tone === 'error' ? 'border-rose-500/40' : t.tone === 'success' ? 'border-emerald-500/40' : 'border-ink-600',
            )}
          >
            {t.image ? <img src={t.image} alt="" className="h-10 w-10 rounded-xl object-cover" /> : null}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">{t.title}</div>
              {t.body ? <div className="mt-0.5 text-[13px] leading-snug text-ink-300">{t.body}</div> : null}
            </div>
            <button
              aria-label="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(t.id);
              }}
              className="rounded-lg p-1 text-ink-400 hover:bg-ink-700 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
