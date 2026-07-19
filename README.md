# HK BUS TYPING 香港巴士打字

A typing game powered by real Hong Kong bus routes and stop names.
以真實香港巴士路線與站名為核心的打字遊戲——沿真實馬路逐站輸入站名。
Sibling of [HK MTR TYPING](https://mtr-typing.paulwong.dev/).

## Features

- Real Hong Kong coastline with bus routes drawn from real road geometry
  (no map tiles, no API keys — a hand-rolled SVG map)
- 23 featured KMB / Citybus / NLB routes bundled for fully offline play:
  the Peak, Stanley, cross-harbour classics, airport routes over Tsing Ma,
  Lantau mountain roads
- Search and play **any** of ~1,150 franchised routes — stop lists and
  geometry load on demand from the community
  [hkbus](https://github.com/hkbus/hk-bus-crawling) dataset and cache
  locally for a day
- Outbound / inbound direction choice (real per-direction stop lists),
  30-second sprint or full-route challenge
- English letter-by-letter input, or Chinese input with desktop and mobile
  IME support; WPM / CPM, accuracy and stops completed
- A double-decker marker that rides the road and faces the way the route
  bends; synthesized sound effects; bilingual UI (English / 繁體中文);
  dark mode; keyboard-first throughout

## Stack

- Vite 5 + React 18 (plain JSX, no router, no state library)
- d3-geo for the one-time Mercator projection; everything after is 2D math
- One CSS file; Web Audio for synthesized sound; Vitest for the pure libs

## Develop

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # vitest, pure-logic libs
npm run build     # production build to dist/
npm run data      # rebuild public/data/*.json from data/ snapshots
```

`npm run data` re-derives `public/data/bus.json` (featured routes) and
`public/data/route-index.json` (search index) from committed snapshots in
`data/`; delete a snapshot to re-fetch it from source. The featured route
list lives in `data/featured-routes.json` and is validated against the
live route database at build time.

## Analytics (opt-in)

No analytics by default. Set `VITE_GA_ID` at build time to enable
Google Analytics 4.

## Licences

Code is MIT (see `LICENSE`). Route, stop and geometry data come from
[hkbus/hk-bus-crawling](https://github.com/hkbus/hk-bus-crawling) and
[hkbus/route-waypoints](https://github.com/hkbus/route-waypoints)
(GPL-2.0, attribution **HK Bus Crawling @2021**); the coastline is
© OpenStreetMap contributors (ODbL). Details in `DATA-LICENSE.md`.

Not affiliated with KMB, Citybus or NLB. For typing practice only.

Created by [Paul Wong](https://www.linkedin.com/in/paulwong169/).
