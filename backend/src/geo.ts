import { City, Country } from 'country-state-city';

interface CityRow { name: string; lat: number; lng: number }
const cityCache = new Map<string, CityRow[]>();

export const countries: { code: string; name: string; flag: string; phone: string }[] = Country.getAllCountries()
  .map((c: any) => ({ code: c.isoCode, name: c.name, flag: c.flag, phone: c.phonecode }))
  .sort((a: any, b: any) => a.name.localeCompare(b.name));

const countryByCode = new Map(countries.map((c) => [c.code, c]));
export const countryName = (code: string) => countryByCode.get(code)?.name || '';
export const isCountry = (code: string) => countryByCode.has(code);

export function citiesOf(code: string): CityRow[] {
  if (!isCountry(code)) return [];
  let list = cityCache.get(code);
  if (!list) {
    const seen = new Set<string>();
    list = [];
    for (const c of City.getCitiesOfCountry(code) || []) {
      const key = c.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ name: c.name, lat: Number(c.latitude), lng: Number(c.longitude) });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    cityCache.set(code, list);
  }
  return list;
}

export function isCityOf(code: string, city: string) {
  const list = citiesOf(code);
  // Some countries have no city data — allow free text there.
  return !list.length || list.some((c) => c.name.toLowerCase() === city.toLowerCase());
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Nearest known city to a coordinate, searched across every country. */
export function nearestCity(lat: number, lng: number) {
  let best: { country: string; city: string; d: number } | null = null;
  for (const c of City.getAllCities() as any[]) {
    const la = Number(c.latitude), ln = Number(c.longitude);
    if (Math.abs(la - lat) > 2 || Math.abs(ln - lng) > 2) continue; // quick box filter
    const d = distanceKm(lat, lng, la, ln);
    if (!best || d < best.d) best = { country: c.countryCode, city: c.name, d };
  }
  return best;
}
