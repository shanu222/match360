import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Country } from './types';

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

export function getPosition(): Promise<{ lat: number; lng: number }> {
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

export const flagOf = (countries: Country[] | undefined, code: string) => countries?.find((c) => c.code === code)?.flag || '';
