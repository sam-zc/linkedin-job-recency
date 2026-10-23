import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { Window } from 'happy-dom';
import { createJobFilter } from '../src/job-filter.ts';

function fixture(t: TestContext) {
  const window = new Window({ url: 'https://www.linkedin.com/jobs/search/' });
  window.document.head.innerHTML =
    '<style>' +
    readFileSync(new URL('../public/content.css', import.meta.url), 'utf8') +
    '</style>';
  window.document.body.innerHTML = `<ul>
    <li class="jobs-search-results__list-item" id="applied"><div class="job-card-container"><a href="/jobs/view/1">Developer</a><ul class="job-card-container__footer-wrapper"><li class="job-card-container__footer-job-state">Applied 2 days ago</li></ul></div></li>
    <li class="jobs-search-results__list-item" id="viewed"><div class="job-card-container job-card-container--is-seen"><a href="/jobs/view/2">Engineer</a><span class="job-card-container__footer-job-state">Viewed</span></div></li>
    <li class="jobs-search-results__list-item" id="fresh"><div class="job-card-container"><a href="/jobs/view/3">Applied Scientist</a><ul class="job-card-container__footer-wrapper"><li>Easy Apply</li></ul></div></li>
    <li class="jobs-search-results__list-item" id="label"><a href="/jobs/view/4">Designer</a><span data-job-state="viewed">Viewed</span></li>
  </ul><aside><ul><li id="details"><a href="/jobs/view/99">Related role</a><span class="job-card-container__footer-job-state">Applied</span></li></ul></aside>`;
  const document = window.document as unknown as Document;
  const filter = createJobFilter(document);
  t.after(() => {
    filter.dispose();
    window.close();
  });
  const get = (id: string) => document.getElementById(id)!;
  const visible = (id: string) =>
    window.getComputedStyle(window.document.getElementById(id)!).display !== 'none';
  return { window, document, filter, get, visible };
}

async function until(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!condition() && Date.now() < deadline) await setTimeout(10);
  assert.ok(condition(), 'Expected the observed change to be applied');
}

test('filters only recognized result cards and never Easy Apply or related detail links', (t) => {
  const { filter, visible } = fixture(t);
  filter.update({ hideApplied: true, hideViewed: false });
  assert.equal(visible('applied'), false);
  assert.equal(visible('viewed'), true);
  assert.equal(visible('fresh'), true);
  assert.equal(visible('details'), true);
  filter.update({ hideApplied: false, hideViewed: true });
  assert.equal(visible('applied'), true);
  assert.equal(visible('viewed'), false);
  assert.equal(visible('label'), false);
});

test('switching filters off restores cards without overriding the page own visibility', (t) => {
  const { filter, visible, get } = fixture(t);
  get('fresh').style.display = 'none';
  filter.update({ hideApplied: true, hideViewed: true });
  filter.update({ hideApplied: false, hideViewed: false });
  assert.equal(visible('applied'), true);
  assert.equal(visible('viewed'), true);
  assert.equal(visible('fresh'), false);
});

test('observes newly loaded and recycled cards through its public interface', async (t) => {
  const { filter, document, get, visible } = fixture(t);
  filter.update({ hideApplied: true, hideViewed: true });
  const card = document.createElement('li');
  card.className = 'jobs-search-results__list-item';
  card.id = 'dynamic';
  card.innerHTML =
    '<a href="/jobs/view/5">New result</a><span data-job-state="viewed">Viewed</span>';
  document.querySelector('ul')!.append(card);
  await until(() => !visible('dynamic'));
  get('applied').querySelector('.job-card-container__footer-job-state')!.textContent = 'Promoted';
  await until(() => visible('applied'));
  card.querySelector('[data-job-state]')!.setAttribute('data-job-state', 'promoted');
  card.querySelector('[data-job-state]')!.textContent = 'Promoted';
  await until(() => visible('dynamic'));
});

test('cleans up pending work and stops filtering after disposal', async (t) => {
  const { filter, document, visible } = fixture(t);
  filter.update({ hideApplied: true, hideViewed: true });
  document.querySelector('#applied a')!.textContent = 'Changed title';
  filter.dispose();
  filter.update({ hideApplied: true, hideViewed: true });
  await setTimeout(120);
  assert.equal(visible('applied'), true);
  assert.equal(visible('viewed'), true);
});

test('restores cards on SPA route exit and filters again on return', async (t) => {
  const { filter, window, visible } = fixture(t);
  filter.update({ hideApplied: true, hideViewed: true });
  window.history.pushState(null, '', '/jobs/view/1/');
  await until(() => visible('applied'));
  window.history.pushState(null, '', '/jobs/search-results/');
  await until(() => !visible('applied'));
});
