# Project Record — HK MTR Typing (港鐵打字)

> Development record and technical architecture notes, written for reuse in the
> next project. Built 2026-07-18. Live at <https://mtr-typing.paulwong.dev>.
> Repo: `m-type-r` (Pjaijai). License: MIT (code); map/station data keep
> upstream terms (DATA.GOV.HK, ODbL).

---

## 1. What we built

A bilingual (English / 繁體中文) typing game where players type real Hong Kong
MTR station names in order along real lines drawn on a real coastline map.
Inspired by tw-metro-typing and densyatyping (original implementation, no code
reused).

### Feature list (in the order it was built — one commit per step)

1. **Core game** — pick a line, service pattern (e.g. Lo Wu vs Lok Ma Chau,
   Po Lam vs LOHAS Park) and direction; type each station in order; 30-second
   sprint or full-line mode; WPM/CPM, accuracy, stations completed; English
   letter-by-letter input or Chinese with desktop/mobile IME support; dark
   mode; bilingual UI.
2. **Landing redesign** — full-screen map with a floating "island" control
   panel.
3. **Journey mode** — type between _any_ two stations; route found by BFS over
   the network graph (interchanges fall out of shared station codes; walking
   interchanges like Central↔Hong Kong added explicitly). Fully
   keyboard-driven.
4. **Game screen redesign** — full-screen map, floating island, stats bar on
   top.
5. **Full keyboard operability** across all screens.
6. **Mobile UX pass** — collapsible islands, compact typing layout for phones.
7. **Train marker** — replaced a pulse dot with a 3D-look MTR train that rides
   along the line; shakes on a wrong keystroke.
8. **Camera work** — in-game tracking camera zoomed to current + next station;
   animated fly-in to the first station on start.
9. **Sound** — synthesized (Web Audio, no audio files) keystroke/success/error
   effects with a persistent mute toggle.
10. **Polish & launch** — MIT license, author credit, SEO (meta/OG/Twitter
    tags, favicon drawn as an MTR train face, OG image, robots.txt,
    sitemap.xml), Google Analytics 4 gated behind `VITE_GA_ID`, canonical URLs
    pointed at `mtr-typing.paulwong.dev`.

---

## 2. Tech stack

| Layer        | Choice                                               | Notes                                                 |
| ------------ | ---------------------------------------------------- | ----------------------------------------------------- |
| Build        | Vite 5                                               | zero config beyond the React plugin                   |
| UI           | React 18 (JSX, no TypeScript)                        | plain `.jsx`, no router — screen state in `App.jsx`   |
| Map          | d3-geo (`geoMercator`, `geoPath`) + hand-rolled SVG  | only d3 module imported; rendering is plain React SVG |
| Icons        | lucide-react                                         |                                                       |
| Styling      | one plain CSS file (`src/styles.css`, ~1000 lines)   | CSS variables for theming/dark mode; no framework     |
| Tests        | Vitest (node environment)                            | pure-logic libs only, no DOM tests                    |
| Audio        | Web Audio API, synthesized                           | no asset files to license or load                     |
| Analytics    | GA4 injected at runtime only if `VITE_GA_ID` is set  | privacy-clean default                                 |
| Data tooling | Node scripts (`.mjs`), `polygon-clipping` (dev-only) | offline build step, output committed                  |
| Hosting      | Vercel (static)                                      | env var set in Vercel dashboard                       |

Total app code: ~3,800 lines including CSS and tests. No backend, no state
library, no router — everything is client-side static.

---

## 3. Architecture

### 3.1 Data pipeline (build-time, not runtime)

```
data/ (raw snapshots, committed)          scripts/               public/data/ (committed output)
├─ mtr_lines_and_stations.csv  ──┐
├─ osm-mtr-stations.json         ├─►  build-data.mjs  ──►  mtr.json
├─ osm-coastline.json            │    coastline.mjs   ──►  hk-boundary.json
└─ hk-admin-raw.json           ──┘
```

- `npm run data` rebuilds the JSON. **Raw snapshots are committed**; deleting
  one re-fetches it from source (MTR open data via DATA.GOV.HK, OSM via
  Overpass API). This makes the build reproducible and offline-friendly.
- Station coordinates matched from OSM **by English name**, with a manual
  escape hatch: `data/coordinate-overrides.json`
  (`{"STATION_CODE": {"lat":…, "lon":…}}`).
- Coastline clipped to the HK administrative boundary (OSM relation 913110)
  with `polygon-clipping`.
- The app fetches the two prebuilt JSON files at startup — no API keys, no
  runtime dependency on any external service.

### 3.2 Runtime module layout

```
src/
├─ main.jsx                 entry
├─ App.jsx        (673 ln)  screen state machine (home → game → result),
│                           game loop, timers, keyboard handling
├─ components/
│  ├─ HomeScreen.jsx        line/run/direction/journey pickers (floating island)
│  ├─ GameScreen.jsx        typing UI + stats bar over full-screen map
│  ├─ ResultScreen.jsx      WPM/CPM/accuracy summary + retry
│  └─ HKMap.jsx             pure SVG renderer: boundary, line segments,
│                           station dots/labels, train marker, animated viewBox
└─ lib/            (pure, unit-tested, no React imports)
   ├─ data.js               network graph: buildNetwork, findJourney (BFS),
   │                        getLineRuns / getPlayableStations / getRunLabel
   ├─ map.js                buildMapModel (project once, reuse everywhere),
   │                        buildJourneyRoute, viewBox "camera" math
   ├─ typing.js             language-aware target/normalize/match (NFKC)
   ├─ i18n.js               tiny dictionary-based EN/繁中 strings
   ├─ audio.js              Web Audio synth + mute persistence
   └─ analytics.js          GA4 loader gated on VITE_GA_ID
```

### 3.3 Key design decisions (and why they worked)

- **Pure-logic `lib/`, thin components.** All game/map/typing logic lives in
  React-free modules with Vitest coverage (`data.test.js`, `typing.test.js`,
  `i18n.test.js`). Components stay declarative renderers. This made every
  redesign (landing, game screen, mobile) cheap because logic never moved.
- **Project once, then work in screen space.** `buildMapModel()` runs the
  Mercator projection a single time and stores pixel coordinates in `Map`s
  keyed by station id. Everything downstream (routes, journey overlay, train
  position, camera) is pure 2-D math on those points.
- **The "camera" is just an animated SVG `viewBox`.** `getRouteViewBox()` /
  `getPairViewBox()` compute a box around points of interest (with minimum
  width so it never over-zooms, and a `verticalOffsetRatio` so the route sits
  above the floating island that covers the lower third). Interpolating the
  four viewBox numbers gives fly-ins and a tracking camera with zero libraries.
- **Graph model for free interchanges.** Stations sharing an MTR code across
  lines are the same node, so interchanges emerge naturally from
  `buildNetwork()`; only out-of-station walking links (CEN↔HOK, TST↔ETS) are
  hardcoded. Journey routing is a plain BFS (fewest stations).
- **Service patterns as `line.segments`.** A line is stations + an array of
  segments, where each segment is a real service pattern (branching lines get
  two runs). The picker, the map drawing, and the graph edges all consume the
  same structure.
- **Unicode-safe typing comparison.** All input and targets are NFKC
  normalized; Chinese mode strips non-word characters (`/[^\p{Letter}\p{Number}]/gu`)
  from both sides so IME punctuation never causes a miss; English compares
  lowercase verbatim. Chinese input is compared on _committed_ text, which is
  what makes desktop and mobile IMEs both work.
- **Everything optional is opt-in via env.** No GA script even exists in the
  bundle path unless `VITE_GA_ID` is set at build time.
- **Synthesized sound.** Web Audio oscillators instead of audio files: no
  assets, no licensing, instant load, one mute flag persisted to localStorage.
- **One CSS file + variables.** Dark mode and theming via CSS custom
  properties; responsive behaviour via media queries and "collapsible island"
  panels on phones. No Tailwind/CSS-in-JS overhead for a project this size.

---

## 4. Reuse checklist for the next project

Things worth lifting almost verbatim:

- [ ] **`scripts/build-data.mjs` pattern** — fetch-once-then-commit raw
      snapshots, deterministic transform to `public/data/*.json`, manual
      override file for bad upstream data. Works for any open-data game/viz.
- [ ] **`lib/map.js`** — projection-once model + viewBox camera math
      (`getRouteViewBox`/`getPairViewBox` are generic "frame these points"
      helpers; only `HK_BOUNDS` and the viewBox constants are HK-specific).
- [ ] **`lib/typing.js`** — NFKC + committed-text comparison is the correct
      base for any CJK+Latin typing input.
- [ ] **`lib/data.js` graph shape** — `{stationsById, adjacency}` + BFS; the
      shared-id interchange trick applies to any transit network.
- [ ] **`lib/i18n.js`** — 140-line dictionary i18n; enough for a two-language
      app, no library needed.
- [ ] **`lib/audio.js`** — synthesized SFX + persisted mute toggle.
- [ ] **`lib/analytics.js`** — GA4 behind `VITE_GA_ID`, plus the README
      wording explaining the privacy default.
- [ ] **Launch kit** — favicon.svg + apple-touch-icon + og-image + robots.txt + sitemap.xml + meta/OG/Twitter tags in `index.html`, canonical URL set
      last once the domain is known.
- [ ] **Floating-island layout** — full-screen canvas with a floating glass
      panel that collapses on mobile; keyboard-first navigation throughout.

Process notes that paid off:

- Small, single-purpose commits with plain-language messages made the history
  double as a changelog (see §1).
- Order of work that felt right: core loop → layout redesigns → extra mode →
  keyboard/mobile passes → juice (train, camera, shake, sound) → license/SEO/
  analytics last.
- Keep tests on the pure libs only; UI churned constantly and DOM tests would
  have been rewritten five times.

---

## 5. Commands

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # vitest, pure-logic libs
npm run build     # production build to dist/
npm run preview
npm run data      # rebuild public/data/*.json from data/ snapshots
```

Deploy: static hosting (Vercel); set `VITE_GA_ID` in project env vars to
enable analytics.
