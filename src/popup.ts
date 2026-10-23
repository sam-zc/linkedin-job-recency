import './style.css';
import { hoursToSeconds } from './search.ts';
import type { JobVisibility } from './preferences.ts';
import { createPreviewSession, openChromeSession, type SearchSession } from './search-session.ts';

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing popup element: ${selector}`);
  return found;
}

const form = element<HTMLFormElement>('#filter-form');
const controls = element<HTMLFieldSetElement>('#controls');
const custom = element<HTMLInputElement>('#custom-hours');
const error = element('#input-error');
const status = element('#status');
const applyLabel = element('#apply-label');
const appliedToggle = element<HTMLButtonElement>('#hide-applied');
const viewedToggle = element<HTMLButtonElement>('#hide-viewed');
const presets = [...document.querySelectorAll<HTMLButtonElement>('[data-hours]')];
const isLocalPreview =
  ['http:', 'https:'].includes(location.protocol) &&
  ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
let selectedHours = 3;
let session: SearchSession | undefined;
let busy = false;

function visibility(): JobVisibility {
  return {
    hideApplied: appliedToggle.getAttribute('aria-checked') === 'true',
    hideViewed: viewedToggle.getAttribute('aria-checked') === 'true',
  };
}

function setVisibility(settings: JobVisibility): void {
  appliedToggle.setAttribute('aria-checked', String(settings.hideApplied));
  viewedToggle.setAttribute('aria-checked', String(settings.hideViewed));
}

for (const toggle of [appliedToggle, viewedToggle]) {
  toggle.addEventListener('click', () => {
    toggle.setAttribute('aria-checked', String(toggle.getAttribute('aria-checked') !== 'true'));
    status.textContent = '';
    applyLabel.textContent = 'Apply';
  });
}

function updateSelection(hours: number, isCustom: boolean): void {
  selectedHours = hours;
  for (const button of presets) {
    button.setAttribute(
      'aria-pressed',
      String(!isCustom && Number(button.dataset.hours) === hours),
    );
  }
  error.hidden = true;
  custom.removeAttribute('aria-invalid');
  status.textContent = '';
  applyLabel.textContent = 'Apply';
}

for (const button of presets) {
  button.addEventListener('click', () => {
    custom.value = '';
    updateSelection(Number(button.dataset.hours), false);
  });
}

custom.addEventListener('input', () => {
  updateSelection(custom.valueAsNumber, true);
});

function messageFor(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : 'Could not update this search. Please try again.';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !session) return;
  try {
    hoursToSeconds(selectedHours);
  } catch (reason) {
    error.textContent = messageFor(reason);
    error.hidden = false;
    custom.setAttribute('aria-invalid', 'true');
    custom.focus();
    return;
  }
  busy = true;
  controls.disabled = true;
  applyLabel.textContent = 'Applying…';
  status.textContent = '';
  try {
    const result = await session.apply(selectedHours, visibility());
    if (!isLocalPreview) {
      window.close();
      return;
    }
    status.textContent = result.message;
    applyLabel.textContent = result.label;
  } catch (reason) {
    status.textContent = messageFor(reason);
    applyLabel.textContent = 'Try again';
  } finally {
    busy = false;
    controls.disabled = false;
  }
});

async function initialize(): Promise<void> {
  if (!isLocalPreview && (typeof chrome === 'undefined' || !chrome.tabs?.query)) {
    status.textContent = 'Load the built extension in Chrome to apply a filter.';
    return;
  }
  try {
    session = isLocalPreview
      ? createPreviewSession()
      : await openChromeSession(chrome.tabs, chrome.storage.local);
    setVisibility(session.visibility);
    const currentHours = session.hours;
    if (currentHours !== null) {
      const isCustom = !presets.some((button) => Number(button.dataset.hours) === currentHours);
      if (isCustom) custom.value = String(currentHours);
      updateSelection(currentHours, isCustom);
    }
    controls.disabled = false;
  } catch (reason) {
    status.textContent = messageFor(reason);
  }
}

void initialize();
