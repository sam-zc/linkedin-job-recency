import type { JobVisibility } from './preferences.ts';
import { isSearchPath } from './search.ts';

const HIDDEN_CLASS = 'ljr-hidden-job';
const RESULT_CARD = '.jobs-search-results__list-item, [data-occludable-job-id]';
const CARD = RESULT_CARD + ', .job-card-container, .job-card-list, [data-job-id]';
const FOOTERS = '[class*="job-card"][class*="footer"], [data-job-state]';
const APPLIED =
  /^applied(?:\s+(?:\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago|just now|today|yesterday))?$/i;

function jobState(card: HTMLElement): { applied: boolean; viewed: boolean } {
  const labels = new Set<string>();
  for (const footer of card.querySelectorAll<HTMLElement>(FOOTERS)) {
    if (footer.dataset.jobState) labels.add(footer.dataset.jobState);
    for (const node of [footer, ...footer.querySelectorAll<HTMLElement>('span, li, p, small')]) {
      // Keep title text and Easy Apply separate from actual state labels.
      if (node.children.length === 0)
        labels.add((node.textContent ?? '').replace(/\s+/g, ' ').trim());
    }
  }
  return {
    applied:
      card.matches('.job-card-container--is-applied') ||
      !!card.querySelector('.job-card-container--is-applied') ||
      [...labels].some((label) => APPLIED.test(label)),
    viewed:
      card.matches('.job-card-container--is-seen') ||
      !!card.querySelector('.job-card-container--is-seen') ||
      [...labels].some((label) => /^viewed$/i.test(label)),
  };
}

// The caller owns only settings; DOM state, scheduling, and cleanup stay here.
export function createJobFilter(document: Document): {
  update(settings: JobVisibility): void;
  dispose(): void;
} {
  const owner = document.defaultView;
  if (!owner || !document.body) throw new Error('Job filtering requires a loaded document.');
  const view = owner;
  let settings: JobVisibility = { hideApplied: false, hideViewed: false };
  const hidden = new Set<HTMLElement>();
  let pending: number | undefined;
  let routeTimer: number | undefined;
  let pathname = view.location.pathname;
  let disposed = false;

  const enabled = (): boolean => settings.hideApplied || settings.hideViewed;
  const observer = new view.MutationObserver((records) => {
    if (view.location.pathname !== pathname || records.some(relevantMutation)) schedule();
  });

  function relevantMutation(record: MutationRecord): boolean {
    const target =
      record.target.nodeType === 1 ? (record.target as HTMLElement) : record.target.parentElement;
    if (target?.closest(CARD) || (target && hidden.has(target))) return true;
    return (
      record.type === 'childList' &&
      [...record.addedNodes, ...record.removedNodes].some((node) => {
        if (node.nodeType !== 1) return false;
        const element = node as HTMLElement;
        return element.matches(CARD) || !!element.querySelector(CARD);
      })
    );
  }

  function restore(): void {
    for (const card of hidden) card.classList.remove(HIDDEN_CLASS);
    hidden.clear();
  }

  function refresh(): void {
    pending = undefined;
    // Our own class changes must not trigger another observation pass.
    observer.disconnect();
    pathname = view.location.pathname;
    if (disposed || !enabled() || !isSearchPath(pathname)) {
      restore();
    } else {
      const cards = new Set<HTMLElement>();
      for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href*="/jobs/view/"]')) {
        const card = link.closest<HTMLElement>(RESULT_CARD) ?? link.closest<HTMLElement>(CARD);
        if (card && card !== link) cards.add(card);
      }
      for (const card of hidden) {
        if (!cards.has(card)) {
          card.classList.remove(HIDDEN_CLASS);
          hidden.delete(card);
        }
      }
      for (const card of cards) {
        const state = jobState(card);
        const shouldHide =
          (settings.hideApplied && state.applied) || (settings.hideViewed && state.viewed);
        card.classList.toggle(HIDDEN_CLASS, shouldHide);
        if (shouldHide) hidden.add(card);
        else hidden.delete(card);
      }
    }
    if (!disposed && enabled()) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'data-job-state', 'href'],
      });
    }
  }

  function schedule(): void {
    if (!disposed && enabled() && pending === undefined) pending = view.setTimeout(refresh, 80);
  }

  function stop(): void {
    observer.disconnect();
    view.clearTimeout(pending);
    view.clearInterval(routeTimer);
    pending = routeTimer = undefined;
  }

  return {
    update(next) {
      if (disposed) return;
      stop();
      settings = { ...next };
      refresh();
      if (enabled()) {
        // A pathname-only check handles SPA navigation without inspecting page content.
        routeTimer = view.setInterval(() => {
          if (view.location.pathname !== pathname) schedule();
        }, 1000);
      }
    },
    dispose() {
      disposed = true;
      stop();
      restore();
    },
  };
}
