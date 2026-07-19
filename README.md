# HK MTR TYPING 港鐵打字

A typing game powered by real Hong Kong MTR lines and station names.
以香港港鐵路綫與站名為核心的打字遊戲，靈感來自
[tw-metro-typing](https://tw-metro-typing.yencheng.dev/) 與日本的
[電車タイピング](https://densyatyping.com/)（原創實作，未使用其程式碼）。

## Features

- Real Hong Kong coastline and all 10 MTR heavy-rail lines drawn from
  WGS84 coordinates, including branch service patterns (Lo Wu / Lok Ma Chau,
  Po Lam / LOHAS Park)
- Pick a line, service pattern and direction, then type each station in order
- 30-second sprint or full-line challenge
- English letter-by-letter input, or Chinese input with desktop and mobile IME
  support
- WPM / CPM, accuracy and stations completed
- Bilingual UI (English / 繁體中文), dark mode, responsive layout

## Stack

- Vite 5 + React 18
- d3-geo for the map projection

## Develop

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

```bash
npm test        # unit tests (vitest)
npm run build   # production build
npm run preview
```

## Data

`npm run data` rebuilds `public/data/mtr.json` and `public/data/hk-boundary.json`
from raw snapshots in `data/`. Delete a snapshot to re-fetch it from source:

- Lines, station order and names: [MTR Corporation open data](https://opendata.mtr.com.hk/)
  via [DATA.GOV.HK](https://data.gov.hk/)
- Station coordinates and coastline: © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors (ODbL), fetched via the Overpass API
- Administrative boundary used to clip the coastline: OpenStreetMap relation
  [913110](https://www.openstreetmap.org/relation/913110)

Station coordinates are matched from OSM by English name; add entries to
`data/coordinate-overrides.json` (`{"STATION_CODE": {"lat": ..., "lon": ...}}`)
to pin any station manually.

## Analytics

Google Analytics 4 loads only when the `VITE_GA_ID` environment variable is
set to a measurement ID (`G-XXXXXXXXXX`) at build time — e.g. in Vercel
under Settings → Environment Variables. Without it, no analytics code runs.

## Credits

Created by [Paul Wong](https://www.linkedin.com/in/paulwong169/)
([Pjaijai](https://github.com/Pjaijai) on GitHub).

## License

Code is released under the [MIT License](./LICENSE). The map and station
data keep their own upstream terms: MTR open data under the
[DATA.GOV.HK](https://data.gov.hk/) terms of use, and OpenStreetMap-derived
data under the [ODbL](https://www.openstreetmap.org/copyright).

This is not an official MTR service. For typing practice only.
本網站並非港鐵官方服務，僅供打字練習使用。
