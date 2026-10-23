import test from 'node:test';
import assert from 'node:assert/strict';
import { PREFERENCES_KEY, readVisibility, watchVisibility } from '../src/preferences.ts';

test('invalid settings default to off', () => {
  assert.deepEqual(readVisibility(undefined), { hideApplied: false, hideViewed: false });
  assert.deepEqual(readVisibility({ hideApplied: 'true', hideViewed: true }), {
    hideApplied: false,
    hideViewed: true,
  });
});

test('a delayed settings read cannot replace a newer storage event', async () => {
  let resolve!: (value: Record<string, unknown>) => void;
  const initial = new Promise<Record<string, unknown>>((done) => {
    resolve = done;
  });
  type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
  const listeners = new Set<Listener>();
  const storage = {
    local: { get: () => initial },
    onChanged: {
      addListener: (fn: Listener) => listeners.add(fn),
      removeListener: (fn: Listener) => listeners.delete(fn),
    },
  } as unknown as typeof chrome.storage;
  const seen: unknown[] = [];
  const stop = watchVisibility(storage, (value) => seen.push(value));
  const latest = { hideApplied: true, hideViewed: false };
  for (const listener of listeners) listener({ [PREFERENCES_KEY]: { newValue: latest } }, 'local');
  resolve({ [PREFERENCES_KEY]: { hideApplied: false, hideViewed: true } });
  await initial;
  assert.deepEqual(seen, [latest]);
  stop();
  assert.equal(listeners.size, 0);
});

test('disposal ignores a pending initial settings read', async () => {
  let resolve!: (value: Record<string, unknown>) => void;
  const initial = new Promise<Record<string, unknown>>((done) => {
    resolve = done;
  });
  const storage = {
    local: { get: () => initial },
    onChanged: { addListener() {}, removeListener() {} },
  } as unknown as typeof chrome.storage;
  const seen: unknown[] = [];
  const stop = watchVisibility(storage, (value) => seen.push(value));
  stop();
  resolve({ [PREFERENCES_KEY]: { hideApplied: true } });
  await initial;
  assert.deepEqual(seen, []);
});
