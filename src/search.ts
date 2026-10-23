const SEARCH_PATH = /^\/jobs\/(search|search-results)\/?$/;

export function isSearchPath(pathname: string): boolean {
  return SEARCH_PATH.test(pathname);
}

export function parseSearchUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Open a LinkedIn job search, then try again.');
  }
  const isLinkedIn = url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com');
  if (
    url.protocol !== 'https:' ||
    !isLinkedIn ||
    url.username ||
    url.password ||
    !isSearchPath(url.pathname)
  ) {
    throw new Error('Open a LinkedIn job search, then try again.');
  }
  return url;
}

export function hoursToSeconds(hours: number): number {
  const seconds = Math.round(hours * 3600);
  if (!Number.isFinite(hours) || hours <= 0 || !Number.isSafeInteger(seconds) || seconds < 1) {
    throw new Error('Enter a positive duration of at least 1 second.');
  }
  return seconds;
}

export function buildSearchUrl(currentUrl: string, hours: number): string {
  const url = parseSearchUrl(currentUrl);
  const seconds = hoursToSeconds(hours);
  const locations = [
    ...new Set(
      url.searchParams.getAll('geoId').flatMap((value) =>
        value
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ),
  ];
  // Preference searches can encode several places in geoId. Classic search
  // fails to load filters with that value; never silently discard locations.
  if (locations.length > 1) {
    throw new Error(
      'This search contains multiple locations. Open a LinkedIn search for one location, then apply the hours filter. Your current search has not been changed.',
    );
  }
  if (locations.length === 1) url.searchParams.set('geoId', locations[0]);
  url.pathname = '/jobs/search/';
  url.searchParams.set('f_TPR', `r${seconds}`);
  url.searchParams.set('sortBy', 'R');
  url.searchParams.delete('start');
  url.searchParams.delete('currentJobId');
  url.searchParams.delete('originToLandingJobPostings');
  if (url.searchParams.get('origin') === 'PREFERENCES_LANDING') {
    url.searchParams.set('origin', 'JOB_SEARCH_PAGE_JOB_FILTER');
  }
  url.hash = '';
  return url.toString();
}

export function readCurrentHours(currentUrl: string): number | null {
  const value = parseSearchUrl(currentUrl).searchParams.get('f_TPR');
  if (!value || !/^r\d+$/.test(value)) return null;
  const seconds = Number(value.slice(1));
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds / 3600 : null;
}
