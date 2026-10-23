import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchUrl, hoursToSeconds, parseSearchUrl, readCurrentHours } from '../src/search.ts';

test('rewrites the newer route, preserves filters, and clears stale result state', () => {
  const input =
    'https://www.linkedin.com/jobs/search-results/?keywords=React+%26+TypeScript&location=Bengaluru&f_WT=2&f_E=3&start=25&currentJobId=123&f_TPR=r86400&sortBy=DD#results';
  const result = new URL(buildSearchUrl(input, 4));
  assert.equal(result.pathname, '/jobs/search/');
  assert.equal(result.searchParams.get('keywords'), 'React & TypeScript');
  assert.equal(result.searchParams.get('location'), 'Bengaluru');
  assert.equal(result.searchParams.get('f_WT'), '2');
  assert.equal(result.searchParams.get('f_E'), '3');
  assert.equal(result.searchParams.get('f_TPR'), 'r14400');
  assert.equal(result.searchParams.get('sortBy'), 'R');
  assert.equal(result.searchParams.has('start'), false);
  assert.equal(result.searchParams.has('currentJobId'), false);
  assert.equal(result.hash, '');
});

test('handles classic paths, fractional hours, and duplicate time parameters', () => {
  const result = new URL(
    buildSearchUrl('https://in.linkedin.com/jobs/search?f_TPR=r1&f_TPR=r2', 2.5),
  );
  assert.equal(result.hostname, 'in.linkedin.com');
  assert.equal(result.pathname, '/jobs/search/');
  assert.deepEqual(result.searchParams.getAll('f_TPR'), ['r9000']);
  assert.equal(hoursToSeconds(5), 18000);
  assert.equal(hoursToSeconds(3), 10800);
});

test('rejects unsupported tabs and lookalike hosts', () => {
  for (const url of [
    'not a URL',
    'chrome://extensions',
    'http://www.linkedin.com/jobs/search/',
    'https://linkedin.com.evil.test/jobs/search/',
    'https://fakelinkedin.com/jobs/search/',
    'https://www.linkedin.com/feed/',
    'https://www.linkedin.com/jobs/view/123/',
    'https://user@www.linkedin.com/jobs/search/',
  ]) {
    assert.throws(() => parseSearchUrl(url), /Open a LinkedIn job search/);
  }
});

test('rejects invalid or unrepresentable durations', () => {
  for (const hours of [0, -1, NaN, Infinity, -Infinity, Number.MAX_VALUE, 0.00001]) {
    assert.throws(() => hoursToSeconds(hours), /positive duration/);
  }
});

test('initializes the selection only from a valid current time filter', () => {
  const base = 'https://www.linkedin.com/jobs/search/';
  assert.equal(readCurrentHours(base + '?f_TPR=r18000'), 5);
  assert.equal(readCurrentHours(base + '?f_TPR=r9000'), 2.5);
  for (const value of ['', 'r0', 'r-1', 'rnope', '3600', 'rInfinity', 'r999999999999999999999']) {
    assert.equal(readCurrentHours(base + '?f_TPR=' + value), null);
  }
});

test('rejects multi-location preference searches before generating a broken classic URL', () => {
  const input =
    'https://www.linkedin.com/jobs/search-results/?currentJobId=4414392634&keywords=full-time%20Software%20Engineer%20or%20Frontend%20Developer&origin=PREFERENCES_LANDING&originToLandingJobPostings=4414392634%2C4376573544%2C4474133788&geoId=90009633%2C90009648%2C101031506%2C106888327';
  assert.throws(() => buildSearchUrl(input, 3), /multiple locations.*one location/i);
});

test('clears preference landing state for a single-location classic search', () => {
  const input =
    'https://www.linkedin.com/jobs/search-results/?geoId=90009633&keywords=Frontend%20Developer&origin=PREFERENCES_LANDING&originToLandingJobPostings=4414392634%2C4376573544';
  const result = new URL(buildSearchUrl(input, 3));
  assert.equal(result.searchParams.get('geoId'), '90009633');
  assert.equal(result.searchParams.get('f_TPR'), 'r10800');
  assert.equal(result.searchParams.has('originToLandingJobPostings'), false);
  assert.equal(result.searchParams.get('origin'), 'JOB_SEARCH_PAGE_JOB_FILTER');
});
