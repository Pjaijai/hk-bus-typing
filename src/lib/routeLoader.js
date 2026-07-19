// Runtime loader for the search-all path: any franchised route becomes
// playable by fetching the hkbus route database plus that route's waypoint
// files, then normalizing them with the same code the build pipeline uses.
// Browser-only (fetch + Cache Storage API).
import { normalizeRoute, pairBounds } from "./busNormalize.js";

const INDEX_URL = "/data/route-index.json";
const ROUTE_DB_URL = "https://data.hkbus.app/routeFareList.min.json";
const WAYPOINTS_BASE = "https://hkbus.github.io/route-waypoints";

// Bump to invalidate everything cached under the old schema.
const CACHE_NAME = "hk-bus-typing-data-v1";
const FRESH_MS = 24 * 60 * 60 * 1000; // upstream refreshes daily
const FETCHED_AT = "x-fetched-at";

async function openCache() {
  try {
    if (typeof caches === "undefined") return null;
    return await caches.open(CACHE_NAME);
  } catch {
    return null; // private browsing may refuse; memoization still applies
  }
}

// Serve from the persistent cache while fresh; refetch when stale, and
// fall back to the stale copy when the network is down.
async function cachedFetchJson(url) {
  const cache = await openCache();
  const hit = await cache?.match(url);
  const age = hit ? Date.now() - Number(hit.headers.get(FETCHED_AT)) : Infinity;
  if (hit && age < FRESH_MS) return hit.json();
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
    if (cache) {
      const headers = new Headers({ [FETCHED_AT]: String(Date.now()) });
      await cache.put(
        url,
        new Response(await response.clone().arrayBuffer(), { headers }),
      );
    }
    return response.json();
  } catch (error) {
    if (hit) return hit.json();
    throw error;
  }
}

function memoize(load) {
  let promise = null;
  return () => {
    // A failed attempt clears itself so a retry actually retries.
    promise ??= load().catch((error) => {
      promise = null;
      throw error;
    });
    return promise;
  };
}

export const loadRouteIndex = memoize(async () => {
  const response = await fetch(INDEX_URL);
  if (!response.ok) throw new Error(`route index HTTP ${response.status}`);
  return response.json();
});

export const loadRouteDb = memoize(async () => {
  const db = await cachedFetchJson(ROUTE_DB_URL);
  if (!db?.routeList || !db?.stopList)
    throw new Error("route database has an unexpected shape");
  return db;
});

async function loadWaypoints(gtfsId, dir) {
  if (!gtfsId) return null;
  try {
    return await cachedFetchJson(`${WAYPOINTS_BASE}/${gtfsId}-${dir}.json`);
  } catch {
    return null; // no geometry is playable, just straight lines
  }
}

// indexEntry comes from route-index.json; returns the same route object
// shape bus.json carries.
export async function loadPlayableRoute(indexEntry) {
  const db = await loadRouteDb();
  const entries = Object.values(indexEntry.bounds)
    .map((key) => ({ key, entry: db.routeList[key] }))
    .filter(({ entry }) => entry);
  if (!entries.length)
    throw new Error(`route ${indexEntry.route} is gone from the database`);
  const pair = pairBounds(entries)[0];
  const waypointsByDir = {};
  for (const [bound, { entry }] of Object.entries(pair.entries))
    waypointsByDir[bound] = await loadWaypoints(
      entry.gtfsId ?? pair.gtfsId,
      bound,
    );
  const { route } = normalizeRoute({
    pair,
    stopList: db.stopList,
    waypointsByDir,
  });
  if (!route) throw new Error(`route ${indexEntry.route} has no playable run`);
  return route;
}

// Matches on route number first (exact, then prefix), then termini names in
// either language. Returns at most `limit` entries.
export function searchRoutes(index, query, limit = 30) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  const scored = [];
  for (const entry of index) {
    let score = null;
    if (entry.route === upper) score = 0;
    else if (entry.route.startsWith(upper)) score = 1;
    else if (
      entry.orig.en.toLowerCase().includes(lower) ||
      entry.dest.en.toLowerCase().includes(lower) ||
      entry.orig.zh.includes(trimmed) ||
      entry.dest.zh.includes(trimmed)
    )
      score = 2;
    if (score !== null) scored.push({ entry, score });
  }
  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.entry.route.length - b.entry.route.length ||
        a.entry.route.localeCompare(b.entry.route),
    )
    .slice(0, limit)
    .map(({ entry }) => entry);
}
