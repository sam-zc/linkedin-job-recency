import { buildSearchUrl, hoursToSeconds, parseSearchUrl, readCurrentHours } from './search.ts';
import { PREFERENCES_KEY, readVisibility, type JobVisibility } from './preferences.ts';

export interface SearchSession {
  readonly hours: number | null;
  readonly visibility: JobVisibility;
  apply(hours: number, visibility: JobVisibility): Promise<{ message: string; label: string }>;
}

export function createPreviewSession(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): SearchSession {
  let visibility = readVisibility(null);
  try {
    visibility = readVisibility(
      JSON.parse((storage ?? localStorage).getItem(PREFERENCES_KEY) ?? 'null'),
    );
  } catch {
    /* Local preview also works when storage is blocked or malformed. */
  }

  return {
    hours: null,
    visibility,
    async apply(hours, settings) {
      hoursToSeconds(hours);
      const next = readVisibility(settings);
      try {
        (storage ?? localStorage).setItem(PREFERENCES_KEY, JSON.stringify(next));
      } catch {
        /* Storage is optional in preview. */
      }
      const hiddenStates = [
        next.hideApplied ? 'Applied' : '',
        next.hideViewed ? 'Viewed' : '',
      ].filter(Boolean);
      const hiding = hiddenStates.length ? ` Hide ${hiddenStates.join(' and ')} jobs.` : '';
      return {
        message: `Preview: last ${hours} ${hours === 1 ? 'hour' : 'hours'}, most relevant first.${hiding} No tab was changed.`,
        label: 'Applied (preview)',
      };
    },
  };
}

export async function openChromeSession(
  tabs: typeof chrome.tabs,
  storage: typeof chrome.storage.local,
): Promise<SearchSession> {
  const [tab] = await tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || tab.id === undefined)
    throw new Error('Open a LinkedIn job search, then try again.');
  parseSearchUrl(tab.url);
  const tabId = tab.id;
  const stored = await storage.get(PREFERENCES_KEY);

  return {
    hours: readCurrentHours(tab.url),
    visibility: readVisibility(stored[PREFERENCES_KEY]),
    async apply(hours, settings) {
      // Re-read the tab so filters changed after opening the popup are preserved.
      const [current] = await tabs.query({ active: true, currentWindow: true });
      if (!current?.url || current.id !== tabId)
        throw new Error('The active tab changed. Reopen the extension on your search.');
      const url = buildSearchUrl(current.url, hours);
      await storage.set({ [PREFERENCES_KEY]: readVisibility(settings) });
      await tabs.update(tabId, { url });
      return {
        message: '',
        label: 'Search updated',
      };
    },
  };
}
