# LinkedIn Job Recency

A small Chrome extension for filtering your current LinkedIn job search by preset or custom hours. Built with TypeScript, Vite, and Chrome Manifest V3; no runtime framework or backend.

## Install locally

Requires Node.js 22.18+ (Node 24 recommended) and npm.

```sh
npm ci
npm run build
```

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project's **dist** folder.
4. Pin **LinkedIn Job Recency** from Chrome's Extensions menu.
5. Open a LinkedIn job search, click the extension, choose a duration, and click **Apply**.

After source changes, build again and reload the extension on `chrome://extensions`. The generated `dist/` folder is excluded from Git; build it after cloning.

## Features

- Presets: 1, 3, 6, 9, and 12 hours.
- Custom positive hours, including decimals such as 2.5.
- Applied and Viewed switches hide loaded search cards that LinkedIn marks with those states. Choices are saved when Apply is clicked and persist across searches.
- Initializes the selection from the current search's time filter; otherwise defaults to 3 hours.
- Supports `/jobs/search/` and `/jobs/search-results/`, with or without a trailing slash.
- Switches to the classic `/jobs/search/` route and sets `f_TPR=r<seconds>` and `sortBy=R` for Most relevant ordering.
- Preserves keywords, location, and other query parameters; clears `start`, `currentJobId`, and the fragment so the updated search starts fresh.
- Applies to the same tab and closes the extension popup after a successful update. Unsupported pages and invalid input keep it open with an explanation.
- Includes LinkedIn toolbar icons, an info tooltip, and an author link in a compact popup.

For example, 4 hours becomes `f_TPR=r14400`; 5 hours becomes `f_TPR=r18000`.

## Development and checks

```sh
npm test
npm run check
npm run build
npm run dev
```

`npm run check` checks formatting, strictly typechecks source, tests, scripts, and build configuration, then runs the test suite. Tests cover URL rewriting, preserved filters, fractional durations, malformed input, unsupported searches, Chrome and preview sessions, settings races, and the job-filter lifecycle.

`npm run build` typechecks, produces the popup and standalone content script, and verifies packaged file references and PNG icon dimensions. `npm run format` formats the project. The lockfile is committed for reproducible installs with `npm ci`.

`npm run dev` provides an interactive browser preview on localhost. Presets, custom hours, input validation, and Apply all work there; Apply displays the selected range without navigating a tab. To update a real LinkedIn search, load the production `dist/` folder as an unpacked extension.

## Permissions and privacy

`activeTab` reads the current search URL when the popup opens. `storage` saves only the Applied/Viewed switches locally. A content script is declared for `https://*.linkedin.com/jobs/*` and filters cards only on job search routes. It inspects result-card state labels, hides matching cards, observes newly loaded cards, and restores cards when filters are disabled. It does not collect analytics, store job history, or send data to a server. No background service worker is needed.

After updating the extension, reload it and refresh LinkedIn so the new content script can run.

## LinkedIn compatibility

The extension uses the classic `/jobs/search/` route. Live testing on October 23, 2026 found that the newer `/jobs/search-results/` route displayed jobs older than the requested window even with `f_TPR=r10800` in the URL. Clicking a job first did not change that behavior.

LinkedIn controls the returned jobs and redirects. These custom query parameters are not a documented stable API, so behavior may differ across accounts or change. The extension requests the selected range; it does not independently verify job ages or enforce a cutoff if LinkedIn ignores it. If LinkedIn redirects back to a different route, the extension does not repeatedly redirect.

Multi-location preference searches encode multiple IDs in `geoId`. Live testing showed that passing these into classic search produces “There was a problem loading your filters.” Moving the same IDs to `f_PP` did not resolve it. Apply now detects this case before saving settings or navigating and asks the user to start a single-location search. It never silently drops locations. Single-location conversions also clear preference landing job IDs and use a classic-search origin.

Applied/Viewed filtering is local display filtering, not a server query. It recognizes English footer labels and known card state classes; cards with unrecognized markup or labels remain visible. It does not change LinkedIn's total result count or load extra pages to replace hidden jobs. Applications outside LinkedIn can only be hidden if LinkedIn marks the card as Applied. Fixture tests verify state detection, newly loaded cards, and restoration; account-specific markup may need adjustments.

Chrome controls the popup's outer window shape. CSS controls the content and spacing, but the manifest does not provide a setting for rounding the native frame.

## Source

- `src/search.ts`: validation and URL transformation.
- `src/popup.ts`: popup interaction and Chrome Tabs API integration.
- `src/search-session.ts`: Chrome and localhost adapters for loading settings and applying a search; validates the tab again before applying.
- `src/preferences.ts`: visibility normalization and race-safe storage observation.
- `src/job-filter.ts`: owns card detection, observation, restoration, route checks, and cleanup. Observation and route timers stop when both filters are off; its own DOM changes do not schedule another scan.
- `src/content.ts`: connects saved visibility choices to the job filter.
- `vite.content.config.ts`: bundles the content script as a standalone script for Chrome.
- `src/style.css` and `index.html`: popup UI.
- `public/manifest.json`: Chrome configuration, copied to `dist/` during build.
- `public/icons/`: shared SVG logo and toolbar PNGs at 16, 24, 32, 48, and 128 pixels.
- `scripts/verify-build.ts`: checks packaged references and icon dimensions after building.
- `tests/search.test.ts`: URL behavior tests using Node's built-in test runner.
- `tests/job-filter.test.ts`: DOM fixtures for Applied/Viewed detection and restoring cards.
- `tests/search-session.test.ts` and `tests/preferences.test.ts`: Apply failures, preview behavior, and settings races.
- `GLOSSARY.md`: shared domain terms.

The popup uses plain CSS with shared variables and one choice-button style. React, SCSS, a state library, and a background worker are unnecessary for its current scope. The content script remains a separate standalone build because Chrome content scripts do not run as ES modules.

## References

- [Chrome popup UI](https://developer.chrome.com/docs/extensions/develop/ui/add-popup)
- [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Chrome activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Loading unpacked extensions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
- [LinkedIn's documented search filters](https://www.linkedin.com/help/linkedin/answer/a507441/filter-and-sort-job-search-results?lang=en)
