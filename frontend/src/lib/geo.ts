import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Country } from './types';
import { isAndroidApp } from './platform';

export const useCountries = () =>
  useQuery({ queryKey: ['countries'], queryFn: () => api.get<{ countries: Country[] }>('/geo/countries').then((r) => r.countries), staleTime: Infinity });

export function useCities(country: string, term: string) {
  return useQuery({
    queryKey: ['cities', country, term],
    queryFn: () => api.get<{ cities: string[]; total: number }>(`/geo/cities?country=${encodeURIComponent(country)}&q=${encodeURIComponent(term)}`),
    enabled: Boolean(country),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  });
}

/** Android app: approximate (coarse) location only, requested at the moment the user taps the button. */
async function getNativePosition(): Promise<{ lat: number; lng: number }> {
  const { Geolocation } = await import('@capacitor/geolocation');
  const denied = new Error('Location permission is off. Allow location for Match360 in your phone’s Settings › Apps, or choose your city manually.');
  let perm;
  try {
    perm = await Geolocation.checkPermissions();
    if (perm.coarseLocation !== 'granted') perm = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] });
  } catch {
    throw new Error('Location is turned off on this phone. Turn it on, or choose your city manually.');
  }
  if (perm.coarseLocation !== 'granted') throw denied;
  // Network (Wi-Fi/cell) location first. Some phones have none, so fall back to GPS;
  // with only the approximate permission Android still returns a coarsened position.
  for (const enableHighAccuracy of [false, true]) {
    try {
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy, timeout: enableHighAccuracy ? 20_000 : 8_000, maximumAge: 10 * 60_000 });
      return { lat: p.coords.latitude, lng: p.coords.longitude };
    } catch {
      /* try the next source */
    }
  }
  throw new Error('We couldn’t get your location. Check that location is turned on, or choose your city manually.');
}

export function getPosition(): Promise<{ lat: number; lng: number }> {
  if (isAndroidApp) return getNativePosition();
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Your browser can’t share location.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Location permission is off. Allow location for this site in your browser settings, then try again.'
              : 'We couldn’t get your location. Try again or choose your city manually.',
          ),
        ),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 10 * 60_000 },
    );
  });
}

/** Windows has no flag emoji and shows the two country letters instead ("PK"), so flags are left out there. */
const flagsOk = typeof navigator === 'undefined' || !/Windows/i.test(navigator.userAgent);
export const flagOf = (countries: Country[] | undefined, code: string) => (flagsOk ? countries?.find((c) => c.code === code)?.flag || '' : '');
/** "🇵🇰 Pakistan" where flags can be drawn, otherwise just "Pakistan". */
export const countryLabel = (c: Country) => (flagsOk && c.flag ? `${c.flag} ${c.name}` : c.name);
