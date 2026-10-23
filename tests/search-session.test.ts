import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewSession, openChromeSession } from '../src/search-session.ts';
import { PREFERENCES_KEY } from '../src/preferences.ts';

function browser() {
  const state = {
    tab: {
      id: 7,
      url: 'https://www.linkedin.com/jobs/search-results/?keywords=TypeScript&f_TPR=r10800',
    },
    stored: {} as Record<string, unknown>,
    navigated: '',
    failStorage: false,
    failNavigation: false,
  };
  const tabs = {
    query: async () => [state.tab],
    update: async (id: number, changes: chrome.tabs.UpdateProperties) => {
      assert.equal(id, 7);
      if (state.failNavigation) throw new Error('Navigation failed');
      state.navigated = changes.url!;
    },
  } as unknown as typeof chrome.tabs;
  const storage = {
    get: async () => state.stored,
    set: async (value: Record<string, unknown>) => {
      if (state.failStorage) throw new Error('Storage failed');
      state.stored = value;
    },
  } as unknown as typeof chrome.storage.local;
  return { state, tabs, storage };
}

test('Chrome session reads the current range and applies to the latest search URL', async () => {
  const { state, tabs, storage } = browser();
  const session = await openChromeSession(tabs, storage);
  assert.equal(session.hours, 3);
  state.tab.url += '&location=India&f_WT=2&start=25';
  const visibility = { hideApplied: true, hideViewed: false };
  const result = await session.apply(4, visibility);
  const url = new URL(state.navigated);
  assert.equal(url.pathname, '/jobs/search/');
  assert.equal(url.searchParams.get('f_TPR'), 'r14400');
  assert.equal(url.searchParams.get('f_WT'), '2');
  assert.equal(url.searchParams.get('location'), 'India');
  assert.equal(url.searchParams.has('start'), false);
  assert.deepEqual(state.stored[PREFERENCES_KEY], visibility);
  assert.equal(result.label, 'Search updated');
});

test('Chrome session rejects active-tab changes, unsupported pages, and invalid hours before writing', async () => {
  for (const change of ['tab', 'page', 'duration']) {
    const { state, tabs, storage } = browser();
    const session = await openChromeSession(tabs, storage);
    if (change === 'tab') state.tab.id = 8;
    if (change === 'page') state.tab.url = 'https://www.linkedin.com/feed/';
    await assert.rejects(
      session.apply(change === 'duration' ? 0 : 3, { hideApplied: true, hideViewed: true }),
    );
    assert.deepEqual(state.stored, {});
    assert.equal(state.navigated, '');
  }
});

test('Chrome session reports storage and navigation failures instead of success', async () => {
  const { state, tabs, storage } = browser();
  const session = await openChromeSession(tabs, storage);
  state.failStorage = true;
  await assert.rejects(session.apply(3, session.visibility), /Storage failed/);
  assert.equal(state.navigated, '');
  state.failStorage = false;
  state.failNavigation = true;
  await assert.rejects(session.apply(3, session.visibility), /Navigation failed/);
});

test('preview session persists choices and validates without navigating', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const session = createPreviewSession(storage);
  const result = await session.apply(2.5, { hideApplied: true, hideViewed: true });
  assert.match(result.message, /last 2.5 hours/);
  assert.match(result.message, /Hide Applied and Viewed/);
  assert.match(result.message, /No tab was changed/);
  assert.deepEqual(createPreviewSession(storage).visibility, {
    hideApplied: true,
    hideViewed: true,
  });
  await assert.rejects(session.apply(0, session.visibility));
});

test('preview survives malformed or unavailable storage', async () => {
  const malformed = createPreviewSession({ getItem: () => 'not json', setItem() {} });
  assert.deepEqual(malformed.visibility, { hideApplied: false, hideViewed: false });
  const blocked = createPreviewSession({
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  });
  assert.equal((await blocked.apply(3, blocked.visibility)).label, 'Applied (preview)');
});

test('multi-location Apply leaves settings and the current tab untouched', async () => {
  const { state, tabs, storage } = browser();
  state.tab.url += '&geoId=90009633%2C90009648%2C101031506%2C106888327&origin=PREFERENCES_LANDING';
  const session = await openChromeSession(tabs, storage);
  await assert.rejects(
    session.apply(3, { hideApplied: true, hideViewed: true }),
    /multiple locations.*one location/i,
  );
  assert.deepEqual(state.stored, {});
  assert.equal(state.navigated, '');
});
