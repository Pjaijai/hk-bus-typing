# Data licences and provenance

The application code in this repository is MIT-licensed (see `LICENSE`).
The bundled and fetched **data** comes from third parties under their own
terms, which travel with the data files:

## Bus routes, stops and fares

- Source: [hkbus/hk-bus-crawling](https://github.com/hkbus/hk-bus-crawling)
  (`routeFareList.min.json`), which aggregates official operator data
  published through DATA.GOV.HK / CSDI.
- Licence: **GPL-2.0**. Required attribution: **HK Bus Crawling @2021**.
- Files derived from it in this repository:
  `data/routeFareList.min.json`, `public/data/bus.json`,
  `public/data/route-index.json`.
- The app also fetches this dataset at runtime from
  `https://data.hkbus.app/routeFareList.min.json` for the search-all
  feature.

## Route geometry (waypoints)

- Source: [hkbus/route-waypoints](https://github.com/hkbus/route-waypoints),
  generated daily from the Hong Kong CSDI geoportal.
- Licence: **GPL-2.0**, same attribution as above.
- Files derived from it: `data/waypoints/*.json` and the `geometries`
  arrays inside `public/data/bus.json`; fetched at runtime from
  `https://hkbus.github.io/route-waypoints/` for searched routes.

## Coastline / boundary

- Source: © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors, via the Overpass API (coastline ways and the Hong Kong
  administrative boundary, relation 913110).
- Licence: **ODbL 1.0**.
- File: `public/data/hk-boundary.json` (built in the sibling
  [m-type-r](https://github.com/Pjaijai/mtr-typing) project and reused
  here unchanged).

This project is not affiliated with or endorsed by KMB, Citybus, NLB, the
Hong Kong Government, or the hkbus.app team.
