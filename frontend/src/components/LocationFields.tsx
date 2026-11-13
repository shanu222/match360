import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, LocateFixed, Search } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { getPosition, useCities, useCountries } from '../lib/geo';
import { Spinner } from './ui';

/** Searchable single-select. Works with keyboard (↑ ↓ Enter Esc) and touch. */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  onSearch,
  loading,
  render,
  emptyText = 'No matches',
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; hint?: string }[];
  placeholder: string;
  onSearch?: (term: string) => void;
  loading?: boolean;
  render?: (o: { value: string; label: string }) => React.ReactNode;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const filtered = onSearch ? options : options.filter((o) => o.label.toLowerCase().includes(term.trim().toLowerCase()));
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  useEffect(() => setHi(0), [term, open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setTerm('');
  };

  return (
    <div ref={box} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx('input flex items-center justify-between text-left', !value && 'text-slate/70', disabled && 'opacity-60')}
      >
        <span className="truncate">{value ? (render && selected ? render(selected) : selected?.label || value) : placeholder}</span>
        <ChevronDown size={18} className="shrink-0 text-slate" />
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-rule bg-card shadow-lift">
          <div className="relative border-b border-rule">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate" />
            <input
              autoFocus
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                onSearch?.(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
                if (e.key === 'Enter' && filtered[hi]) { e.preventDefault(); choose(filtered[hi].value); }
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="Type to search"
              className="w-full bg-transparent py-3 pl-10 pr-3 text-[15px] outline-none"
              aria-controls={listId}
            />
            {loading && <Spinner size={16} className="absolute right-3 top-1/2 -translate-y-1/2" />}
          </div>
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-4 py-3 text-sm text-slate">{emptyText}</li>}
            {filtered.slice(0, 300).map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}
                className={clsx('flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-[15px]', i === hi && 'bg-paper')}
              >
                <span className="truncate">{render ? render(o) : o.label}</span>
                {o.value === value && <Check size={16} className="shrink-0 text-cobalt" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function LocationFields({
  country,
  city,
  onChange,
  onLocated,
}: {
  country: string;
  city: string;
  onChange: (v: { country: string; city: string }) => void;
  onLocated?: () => void;
}) {
  const countries = useCountries();
  const [term, setTerm] = useState('');
  const cities = useCities(country, term);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState('');

  const locate = async () => {
    setMsg('');
    setLocating(true);
    try {
      const pos = await getPosition();
      const r = await api.post<{ country: string; countryName: string; city: string }>('/me/location', pos);
      if (r.country) onChange({ country: r.country, city: r.city });
      setMsg(r.city ? `Location set to ${r.city}, ${r.countryName}. Only your approximate distance is shown to others.` : 'Location saved.');
      onLocated?.();
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setLocating(false);
    }
  };

  const cityOptions = (cities.data?.cities || []).map((c) => ({ value: c, label: c }));
  if (city && !cityOptions.some((o) => o.value === city)) cityOptions.unshift({ value: city, label: city });

  return (
    <div>
      <button type="button" onClick={locate} disabled={locating} className="btn btn-ghost w-full justify-start">
        {locating ? <Spinner size={18} /> : <LocateFixed size={18} className="text-cobalt" />}
        Use my current location
      </button>
      {msg && <p className="mt-2 text-sm text-slate">{msg}</p>}
      <div className="grid gap-x-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="country">Country</label>
          <Combobox
            id="country"
            value={country}
            onChange={(v) => onChange({ country: v, city: '' })}
            options={(countries.data || []).map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` }))}
            placeholder={countries.isLoading ? 'Loading countries…' : 'Select country'}
          />
        </div>
        <div>
          <label className="label" htmlFor="city">City</label>
          <Combobox
            id="city"
            value={city}
            onChange={(v) => onChange({ country, city: v })}
            options={cityOptions}
            onSearch={setTerm}
            loading={cities.isFetching}
            placeholder={country ? 'Select city' : 'Choose a country first'}
            disabled={!country}
            emptyText={term ? `No city called “${term}”` : 'Start typing your city'}
          />
        </div>
      </div>
    </div>
  );
}
