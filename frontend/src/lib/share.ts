import { isAndroidApp } from './platform';
import { PLAY_STORE_URL } from '../native/billing';

const TEXT = 'Join me on Match360, where people answer questions about each other’s profile before they can chat.';

/**
 * Opens the system share sheet with an invitation to Match360. On computers without one, copies the invitation instead.
 * Resolves to what happened so the caller can confirm it; 'cancelled' when the person closed the sheet.
 */
export async function inviteFriend(): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = isAndroidApp ? PLAY_STORE_URL : window.location.origin;
  try {
    if (isAndroidApp) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'Match360', text: TEXT, url, dialogTitle: 'Invite a friend' });
      return 'shared';
    }
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: 'Match360', text: TEXT, url });
      return 'shared';
    }
  } catch (e: any) {
    if (e?.name === 'AbortError' || /cancel/i.test(String(e?.message || ''))) return 'cancelled';
    // fall through to copying
  }
  await navigator.clipboard.writeText(`${TEXT} ${url}`);
  return 'copied';
}
