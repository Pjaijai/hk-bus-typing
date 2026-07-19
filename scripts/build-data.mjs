// Builds public/data/bus.json (featured routes, fully offline) and
// public/data/route-index.json (search-all index) from hkbus open data.
// Raw snapshots live in data/; missing ones are fetched and saved so later
// runs are reproducible offline. Run: node scripts/build-data.mjs
import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRouteIndex,
  normalizeRoute,
  pairBounds,
  preferredPair,
  primaryOperator,
  routeId,
  OPERATORS,
} from "../src/lib/busNormalize.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const WAYPOINTS_DIR = path.join(DATA_DIR, "waypoints");
const OUT_DIR = path.join(ROOT, "public", "data");

const ROUTE_DB_URL = "https://data.hkbus.app/routeFareList.min.json";
const WAYPOINTS_BASE = "https://hkbus.github.io/route-waypoints";

function expect(condition, message) {
  if (!condition) throw new Error(`validation failed: ${message}`);
}

async function loadSource(file, url) {
  const filePath = path.join(DATA_DIR, file);
  try {
    await access(filePath);
  } catch {
    console.log(`fetching ${url}`);
    const response = await fetch(url, {
      headers: { "User-Agent": "hk-bus-typing-data/0.1" },
    });
    if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
  }
  return readFile(filePath, "utf8");
}

// 404s are real for a few routes (no surveyed geometry); those runs fall
// back to straight stop-to-stop lines instead of failing the build.
async function loadWaypoints(gtfsId, dir) {
  if (!gtfsId) return null;
  const file = path.join("waypoints", `${gtfsId}-${dir}.json`);
  try {
    return JSON.parse(
      await loadSource(file, `${WAYPOINTS_BASE}/${gtfsId}-${dir}.json`),
    );
  } catch (error) {
    console.warn(`  no waypoints for ${gtfsId}-${dir}: ${error.message}`);
    return null;
  }
}

const routeDb = JSON.parse(
  await loadSource("routeFareList.min.json", ROUTE_DB_URL),
);
expect(
  routeDb.routeList && typeof routeDb.routeList === "object",
  "routeFareList has routeList",
);
expect(
  routeDb.stopList && typeof routeDb.stopList === "object",
  "routeFareList has stopList",
);

const featuredConfig = JSON.parse(
  await readFile(path.join(DATA_DIR, "featured-routes.json"), "utf8"),
);

const franchisedEntries = Object.entries(routeDb.routeList)
  .map(([key, entry]) => ({ key, entry }))
  .filter(({ entry }) =>
    (entry.co ?? []).some((operator) => OPERATORS.includes(operator)),
  );
const pairs = pairBounds(franchisedEntries);
const pairsById = new Map(pairs.map((pair) => [routeId(pair), pair]));

// Resolve the hand-written featured list against live data; a renumbered or
// cancelled route must fail the build, not silently vanish from the game.
const featuredPairs = featuredConfig.map(({ route, co }) => {
  const candidates = pairs.filter(
    (pair) => pair.route === route && primaryOperator(pair.co) === co,
  );
  expect(candidates.length > 0, `featured route ${co} ${route} not found`);
  const pair = preferredPair(candidates);
  expect(
    Object.keys(pair.entries).length >= 1,
    `featured route ${co} ${route} has no bounds`,
  );
  return pair;
});

const featuredIds = new Set(featuredPairs.map((pair) => routeId(pair)));
expect(
  featuredIds.size === featuredConfig.length,
  "featured routes resolve to distinct ids",
);

const routes = [];
for (const pair of featuredPairs) {
  const label = `${primaryOperator(pair.co)} ${pair.route}`;
  const waypointsByDir = {};
  // Directions can carry different gtfsIds (e.g. CTB 15), so resolve the
  // waypoint file per bound from that bound's own entry.
  for (const [bound, { entry }] of Object.entries(pair.entries))
    waypointsByDir[bound] = await loadWaypoints(
      entry.gtfsId ?? pair.gtfsId,
      bound,
    );
  const { route, warnings } = normalizeRoute({
    pair,
    stopList: routeDb.stopList,
    waypointsByDir,
  });
  for (const warning of warnings) console.warn(`  ${label}: ${warning}`);
  expect(route, `${label} produced a playable route`);
  for (const [index, segment] of route.segments.entries()) {
    expect(segment.length >= 2, `${label} run ${index} has >=2 stops`);
    expect(
      route.stopPositions[index].length === segment.length,
      `${label} run ${index} positions align with stops`,
    );
    expect(
      route.geometries[index].length >= 2,
      `${label} run ${index} has geometry`,
    );
  }
  routes.push(route);
}
expect(routes.length === featuredConfig.length, "all featured routes built");

const index = buildRouteIndex(routeDb.routeList, { featuredIds });
expect(index.length > 500, `route index looks complete (${index.length})`);
expect(index.length < 4000, `route index looks sane (${index.length})`);
expect(
  index.filter((entry) => entry.featured).length === featuredIds.size,
  "index marks every featured route",
);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  path.join(OUT_DIR, "bus.json"),
  JSON.stringify({
    network: "hkbus",
    source:
      "HK Bus Crawling @2021 (hkbus/hk-bus-crawling, GPL-2.0); route geometry: hkbus/route-waypoints; data via DATA.GOV.HK / CSDI",
    sourceUrl: "https://github.com/hkbus/hk-bus-crawling",
    routes,
  }),
);
await writeFile(path.join(OUT_DIR, "route-index.json"), JSON.stringify(index));

const stops = routes.reduce((sum, route) => sum + route.stations.length, 0);
console.log(
  `built ${routes.length} featured routes (${stops} stops) and an index of ${index.length} routes`,
);
