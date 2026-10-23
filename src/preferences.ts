export const PREFERENCES_KEY = 'jobVisibility';

export interface JobVisibility {
  hideApplied: boolean;
  hideViewed: boolean;
}

export function readVisibility(value: unknown): JobVisibility {
  const settings = value as Partial<JobVisibility> | null;
  return {
    hideApplied: settings?.hideApplied === true,
    hideViewed: settings?.hideViewed === true,
  };
}

export function watchVisibility(
  storage: typeof chrome.storage,
  update: (settings: JobVisibility) => void,
): () => void {
  let changed = false;
  let disposed = false;
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (disposed || area !== 'local' || !changes[PREFERENCES_KEY]) return;
    changed = true;
    update(readVisibility(changes[PREFERENCES_KEY].newValue));
  };
  storage.onChanged.addListener(onChanged);
  storage.local
    .get(PREFERENCES_KEY)
    .then((stored) => {
      // A delayed initial read must never replace a newer settings event.
      if (!disposed && !changed) update(readVisibility(stored[PREFERENCES_KEY]));
    })
    .catch(() => {
      /* Keep cards visible until settings can be read. */
    });

  return () => {
    disposed = true;
    storage.onChanged.removeListener(onChanged);
  };
}
