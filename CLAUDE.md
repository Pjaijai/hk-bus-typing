# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A typing game built on real Hong Kong bus routes and stop names. Players type stop names in sequence while a bus marker rides an actual road-following path on a hand-rolled SVG map (no map tiles, no API keys). Sibling project: HK MTR TYPING.

## Commands

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # vitest run — pure-logic libs only, in src/lib/*.test.js
npm run build     # production build to dist/
npm run data      # rebuild public/data/*.json from data/ snapshots
```

Run a single test file: `npx vitest run src/lib/typing.test.js`

There is no lint script configured.

## Stack

- Vite 5 + React 18, plain JSX, no router, no state library — one `App.jsx` holds all game state via hooks
- d3-geo for a one-time Mercator projection at map-build time; everything after that is 2D polyline math
- One CSS file (`src/styles.css`), Web Audio for synthesized sound effects
- Vitest for pure-logic libraries under `src/lib/`

## Architecture

### Two data pipelines converging on one shape

Both the build-time and runtime paths produce identical route objects (stations, segments, geometries, stopPositions) via the shared normalizer, so game code never needs to know which path a route came from:

- **Build time** (`scripts/build-data.mjs`, Node): reads `data/featured-routes.json` (curated list of ~23 routes), resolves each against the live hkbus route database (`https://data.hkbus.app/routeFareList.min.json`), fetches/caches waypoint geometry snapshots into `data/waypoints/`, and writes `public/data/bus.json` (fully offline, bundled) and `public/data/route-index.json` (a slim search index over ~1,150 routes). Validates the featured list against live data and fails the build if a route was renumbered or cancelled.
- **Runtime** (`src/lib/routeLoader.js`, browser): powers "search any route" — fetches the same upstream JSON directly (via Cache Storage API, 24h freshness), and calls the *same* `normalizeRoute` used at build time. A route picked this way is merged into app state as an "extra route" alongside the bundled featured ones (see `addLoadedRoute` in `App.jsx`).
- **Shared normalizer** (`src/lib/busNormalize.js`): must stay free of Node/DOM imports since both sides import it. Handles operator precedence (KMB > Citybus > NLB > ...), pairing outbound/inbound entries into one route record (`pairBounds`), matching stops to waypoint geometry (`matchStopsToLine` from `busGeometry.js`), route coloring (including special-cased MTR line liveries), and building the route id used everywhere (`{operator}-{route}-{serviceType}`).

To add/remove a featured route: edit `data/featured-routes.json`, then run `npm run data`. Delete a file under `data/` to force it to be re-fetched from source.

### Run = direction, not a reversed array

A bus route's outbound and inbound directions have genuinely different stop lists (not just reverse order). `route.segments` holds one entry per real service run; `getLineRuns`/`getPlayableStations` (`src/lib/data.js`) select a run by index — direction choice is run choice.

### Map model (`src/lib/map.js`)

`buildMapModel` projects raw lon/lat geometry to screen space once (via d3-geo), and separately tracks **screen-space arc length** (drives marker placement) vs **real-world meters** (drives the km/h readout) — both computed from cumulative lengths over the same polyline, one projected and one not. Stops are positioned on the polyline via `{i, t}` params (segment index + interpolation fraction) rather than raw coordinates, so markers sit exactly on the drawn path.

### Game loop state (`src/App.jsx`)

All game state lives in one component via hooks — no external state library. Two things worth knowing before touching it:

- Fast keystroke bursts can outrun React re-renders, so the typing cursor and active station index are also tracked in refs (`typedIndexRef`, `stationIndexRef`) alongside the React state that drives rendering.
- The run clock is armed at game start but only starts counting on the *first keystroke* (`timerStartedRef`), so staring at the screen before typing is free.
- Global `keydown` handling doubles as both gameplay input and keyboard shortcuts (number keys to pick a featured route, `s`/`d`/`m`/`t` on the home screen, Escape to navigate back) — screen-dependent, so check `screen` before adding new bindings.

### Typing matching (`src/lib/typing.js`)

English targets are typed verbatim in lowercase, spaces included; Chinese targets strip all punctuation on both the target and the committed input before comparing. Chinese (and other IME) input arrives through the composition events (`compositionstart/update/end`) on a hidden text input — `consumeTypingInput` only commits on `compositionend`, since IME candidates change mid-composition.

### Challenge links (`src/lib/challenge.js`)

Async multiplayer with no backend: a full match result (route, run, mode, typing language, name, speed, accuracy, stop count, time) is serialized to compact keys and base64url-encoded into a `#vs/<payload>` URL hash. `decodeChallenge` never throws — any malformed or version-mismatched link is treated as "no challenge," not an error. `#r/<route-id>` is a separate, simpler deep-link prefix that just preselects a featured route.

### Stop name cleanup (`src/lib/names.js`)

Upstream stop names carry inconsistent formatting; typing targets are derived from cleaned names (`cleanStopNameEn`/`cleanStopNameZh`/`stopTypingTarget`) at normalize time so cleanup logic lives in one place rather than being repeated by every consumer.

## Licensing note

Route, stop, and geometry data come from `hkbus/hk-bus-crawling` and `hkbus/route-waypoints` (GPL-2.0, attribution "HK Bus Crawling @2021"); the coastline is © OpenStreetMap contributors (ODbL). See `DATA-LICENSE.md` before changing how this data is sourced, cached, or redistributed. Not affiliated with KMB, Citybus, or NLB.

## Analytics

Disabled by default. `VITE_GA_ID` set at build time enables GA4 (`src/lib/analytics.js`); unset, `trackEvent` calls are no-ops.
