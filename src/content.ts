import { createJobFilter } from './job-filter.ts';
import { watchVisibility } from './preferences.ts';

const filter = createJobFilter(document);
const stopWatching = watchVisibility(chrome.storage, filter.update);

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    stopWatching();
    filter.dispose();
  }
});
