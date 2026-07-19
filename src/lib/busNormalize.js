// Turns hkbus routeFareList entries into the game's route objects. Shared
// by scripts/build-data.mjs (node) and the runtime search loader (browser),
// so it must stay free of node/DOM imports.

import { cleanStopNameEn, cleanStopNameZh, stopTypingTarget } from "./names.js";
import {
  distanceMeters,
  flattenWaypoints,
  matchStopsToLine,
  simplifyLine,
} from "./busGeometry.js";

// kmb/ctb/nlb stay first so joint ctb+kmb routes resolve to KMB as primary.
export const OPERATORS = [
  "kmb",
  "ctb",
  "nlb",
  "gmb",
  "lrtfeeder",
  "lightRail",
  "mtr",
  "sunferry",
  "fortuneferry",
  "hkkf",
];

export const OPERATOR_COLORS = {
  kmb: "#D71920",
  ctb: "#FDB913",
  nlb: "#00934B",
  gmb: "#37B34A",
  lrtfeeder: "#178F7D",
  lightRail: "#7B4FA0",
  mtr: "#E2231A",
  sunferry: "#0075C2",
  fortuneferry: "#F08300",
  hkkf: "#0AA3B5",
};

export const OPERATOR_NAMES = {
  kmb: { en: "KMB", zh: "九巴" },
  ctb: { en: "Citybus", zh: "城巴" },
  nlb: { en: "NLB", zh: "嶼巴" },
  gmb: { en: "Minibus", zh: "專線小巴" },
  lrtfeeder: { en: "MTR Bus", zh: "港鐵巴士" },
  lightRail: { en: "Light Rail", zh: "輕鐵" },
  mtr: { en: "MTR", zh: "港鐵" },
  sunferry: { en: "Sun Ferry", zh: "新渡輪" },
  fortuneferry: { en: "Fortune Ferry", zh: "富裕小輪" },
  hkkf: { en: "HKKF", zh: "港九小輪" },
};

// MTR heavy-rail routes carry a line code (AEL, TWL, …) as their "route".
// Riders know these by name and livery colour, so we surface the full line
// name in place of the code and paint each option in its own official hue
// rather than the generic MTR red.
export const MTR_LINES = {
  AEL: { en: "Airport Express", zh: "機場快綫", color: "#00888E" },
  TCL: { en: "Tung Chung Line", zh: "東涌綫", color: "#F7943E" },
  TML: { en: "Tuen Ma Line", zh: "屯馬綫", color: "#923011" },
  TKL: { en: "Tseung Kwan O Line", zh: "將軍澳綫", color: "#7D499D" },
  EAL: { en: "East Rail Line", zh: "東鐵綫", color: "#53B7E8" },
  SIL: { en: "South Island Line", zh: "南港島綫", color: "#BAC429" },
  TWL: { en: "Tsuen Wan Line", zh: "荃灣綫", color: "#E2231A" },
  KTL: { en: "Kwun Tong Line", zh: "觀塘綫", color: "#00AB4E" },
  ISL: { en: "Island Line", zh: "港島綫", color: "#007DC5" },
  DRL: { en: "Disneyland Resort Line", zh: "迪士尼綫", color: "#E45FA9" },
};

// Full MTR line name in the active locale, or null when `route` isn't a known
// MTR line code — callers then fall back to the raw route number.
export function mtrLineName(co, route, useZh) {
  if (primaryOperator(co) !== "mtr") return null;
  const line = MTR_LINES[route];
  return line ? (useZh ? line.zh : line.en) : null;
}

// ~11 m at Hong Kong's latitude; waypoints ship 5-decimal coordinates.
const SIMPLIFY_TOLERANCE_DEG = 1e-4;
const WARN_METERS = 150;
const FAIL_METERS = 500;

export function primaryOperator(co) {
  return OPERATORS.find((operator) => co.includes(operator)) ?? co[0];
}

// Deterministic per-route lightness shift so a dozen routes of one
// operator stay tellable apart where their corridors overlap. The brand
// hue survives; only the shade moves (±~14%).
function shiftShade(hex, amount) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const towards = amount >= 0 ? 255 : 0;
  const mix = Math.abs(amount);
  return `#${channels
    .map((value) =>
      Math.round(value + (towards - value) * mix)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function routeColor(co, route = "") {
  // Each MTR line has its own livery; skip the per-route shade shift so a
  // line reads in exactly its official colour.
  if (primaryOperator(co) === "mtr" && MTR_LINES[route])
    return MTR_LINES[route].color;
  const base = OPERATOR_COLORS[primaryOperator(co)] ?? "#888888";
  if (!route) return base;
  let hash = 0;
  for (const character of route)
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  return shiftShade(base, ((hash % 15) - 7) * 0.02);
}

// Dark or white text for a chip painted `hex`, by perceived lightness — the
// MTR liveries span lime and light blue, so a fixed white no longer works.
export function contrastText(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#20242a" : "#ffffff";
}

// Kept for callers that only have the operator on hand (no baked colour):
// Citybus yellow needs dark text, every other operator livery carries white.
export function routeTextColor(co) {
  return primaryOperator(co) === "ctb" ? "#20242a" : "#ffffff";
}

function serviceKey(serviceType) {
  return String(serviceType);
}

// MTR carries "DT"/"UT" (down/up track) plus branch variants like "LMC-DT";
// map those onto the outbound/inbound slots the pairing logic expects. Bus
// "O"/"I" pass through, and combined "OI"/"IO" fall through to be handled as a
// single run downstream.
function normalizeBound(raw) {
  if (raw === "O" || raw === "I") return raw;
  if (typeof raw === "string" && raw.endsWith("UT")) return "I";
  if (typeof raw === "string" && raw.endsWith("DT")) return "O";
  return raw;
}

function looksReversed(a, b) {
  const name = (value) => (value ?? "").trim().toLowerCase();
  return (
    name(a.orig?.en) === name(b.dest?.en) &&
    name(a.dest?.en) === name(b.orig?.en)
  );
}

// Ranks service-type variants of the same route: two directions beat one,
// waypoint-capable (gtfsId on every bound) beats not, then the lower
// service type (the everyday service) wins.
export function pairQuality(pair) {
  const bounds = Object.values(pair.entries);
  let score = bounds.length > 1 ? 2 : 0;
  if (bounds.every(({ entry }) => entry.gtfsId ?? pair.gtfsId)) score += 1;
  return score;
}

export function preferredPair(candidates) {
  return [...candidates].sort(
    (a, b) =>
      pairQuality(b) - pairQuality(a) ||
      Number(a.serviceType) - Number(b.serviceType),
  )[0];
}

function isFranchised(entry) {
  return (entry.co ?? []).some((operator) => OPERATORS.includes(operator));
}

function stopIdsFor(entry) {
  for (const operator of OPERATORS)
    if (entry.stops?.[operator]?.length) return entry.stops[operator];
  return [];
}

// Group routeList entries into one record per route number + operator set +
// service type, holding the outbound and inbound entries side by side.
// Exact "O"/"I" bounds win their slot; a combined "IO" bound (circular
// loops, and odd variant entries some routes carry) only fills a slot that
// no exact entry claimed, playing as a single outbound run.
export function pairBounds(entries) {
  const groups = new Map();
  for (const { key, entry } of entries) {
    const operator = primaryOperator(entry.co);
    const groupKey = `${entry.route}|${[...entry.co].sort().join(",")}|${serviceKey(entry.serviceType)}`;
    if (!groups.has(groupKey))
      groups.set(groupKey, {
        route: entry.route,
        co: entry.co,
        serviceType: serviceKey(entry.serviceType),
        gtfsId: entry.gtfsId ?? null,
        entries: {},
        combined: [],
      });
    const group = groups.get(groupKey);
    const bound = normalizeBound(entry.bound?.[operator] ?? "O");
    if (bound === "O" || bound === "I") {
      if (!group.entries[bound]) group.entries[bound] = { key, entry };
      // NLB marks both directions "O"; the swapped-termini twin is inbound.
      else if (
        bound === "O" &&
        !group.entries.I &&
        looksReversed(group.entries.O.entry, entry)
      )
        group.entries.I = { key, entry };
    } else {
      group.combined.push({ key, entry });
    }
    if (!group.gtfsId && entry.gtfsId) group.gtfsId = entry.gtfsId;
  }
  for (const group of groups.values()) {
    if (!group.entries.O && group.combined.length)
      group.entries.O = group.combined[0];
    delete group.combined;
  }
  return [...groups.values()];
}

function routeSortKey(route) {
  const number = Number.parseInt(route, 10);
  return [Number.isNaN(number) ? Infinity : number, route];
}

// Slim search index: one entry per playable route, lowest service type per
// route + operator set wins (type 1 is the everyday service).
export function buildRouteIndex(routeList, { featuredIds = new Set() } = {}) {
  const entries = Object.entries(routeList)
    .map(([key, entry]) => ({ key, entry }))
    .filter(
      ({ entry }) => isFranchised(entry) && stopIdsFor(entry).length >= 2,
    );
  const pairs = pairBounds(entries);
  const byRouteCo = new Map();
  for (const pair of pairs) {
    const routeCoKey = `${pair.route}|${[...pair.co].sort().join(",")}`;
    const current = byRouteCo.get(routeCoKey);
    byRouteCo.set(
      routeCoKey,
      current ? preferredPair([current, pair]) : pair,
    );
  }
  return [...byRouteCo.values()]
    .map((pair) => {
      const primary = pair.entries.O ?? pair.entries.I;
      const { orig, dest } = primary.entry;
      const id = routeId(pair);
      return {
        id,
        route: pair.route,
        co: pair.co,
        serviceType: pair.serviceType,
        gtfsId: pair.gtfsId,
        bounds: Object.fromEntries(
          Object.entries(pair.entries).map(([bound, { key }]) => [bound, key]),
        ),
        orig: {
          en: cleanStopNameEn(orig?.en ?? ""),
          zh: cleanStopNameZh(orig?.zh ?? ""),
        },
        dest: {
          en: cleanStopNameEn(dest?.en ?? ""),
          zh: cleanStopNameZh(dest?.zh ?? ""),
        },
        featured: featuredIds.has(id),
      };
    })
    .sort((a, b) => {
      const [numberA, textA] = routeSortKey(a.route);
      const [numberB, textB] = routeSortKey(b.route);
      return numberA - numberB || textA.localeCompare(textB);
    });
}

export function routeId(pair) {
  return `${primaryOperator(pair.co)}-${pair.route}-${pair.serviceType}`.toLowerCase();
}

function buildRunStations(entry, stopList, warnings) {
  const stations = [];
  for (const stopId of stopIdsFor(entry)) {
    const record = stopList[stopId];
    if (!record) {
      warnings.push(`missing stop ${stopId}`);
      continue;
    }
    const nameEn = cleanStopNameEn(record.name?.en ?? "");
    const station = {
      id: stopId,
      nameEn,
      nameZh: cleanStopNameZh(record.name?.zh ?? ""),
      target: stopTypingTarget(nameEn),
      lat: record.location?.lat,
      lon: record.location?.lng,
    };
    const previous = stations[stations.length - 1];
    // Consecutive stops that clean to the same typed name play as one stop.
    if (
      previous &&
      previous.target === station.target &&
      previous.nameZh === station.nameZh
    )
      continue;
    stations.push(station);
  }
  return stations;
}

function runGeometry(runStations, waypoints, warnings, label) {
  const straight = {
    geometry: runStations.map((station) => [station.lon, station.lat]),
    positions: runStations.map((_, index) => ({ i: index, t: 0 })),
  };
  if (!waypoints) return straight;
  const { line, gaps } = flattenWaypoints(waypoints);
  if (line.length < 2) {
    warnings.push(`${label}: empty waypoint geometry, using straight lines`);
    return straight;
  }
  if (gaps) warnings.push(`${label}: ${gaps} gap(s) between waypoint parts`);
  const simplified = simplifyLine(line, SIMPLIFY_TOLERANCE_DEG);
  const match = matchStopsToLine(runStations, simplified, {
    distanceFn: distanceMeters,
  });
  if (!match || match.maxDistance > FAIL_METERS) {
    warnings.push(
      `${label}: stops up to ${Math.round(match?.maxDistance ?? Infinity)}m off the waypoints, using straight lines`,
    );
    return straight;
  }
  if (match.maxDistance > WARN_METERS)
    warnings.push(
      `${label}: farthest stop ${Math.round(match.maxDistance)}m from the waypoints`,
    );
  return {
    geometry: simplified.map(([lon, lat]) => [
      Number(lon.toFixed(5)),
      Number(lat.toFixed(5)),
    ]),
    positions: match.positions.map(({ i, t }) => ({
      i,
      t: Number(t.toFixed(4)),
    })),
  };
}

// pair: output of pairBounds; stopList: routeFareList stopList; waypointsByDir:
// {O: geojson|null, I: geojson|null}. Returns { route, warnings }.
export function normalizeRoute({ pair, stopList, waypointsByDir = {} }) {
  const warnings = [];
  const stationsById = new Map();
  const segments = [];
  const runsMeta = [];
  const geometries = [];
  const stopPositions = [];
  for (const bound of ["O", "I"]) {
    const record = pair.entries[bound];
    if (!record) continue;
    const { entry } = record;
    const runStations = buildRunStations(entry, stopList, warnings);
    if (runStations.length < 2) {
      warnings.push(`${pair.route} ${bound}: fewer than 2 stops, skipped`);
      continue;
    }
    for (const station of runStations)
      if (!stationsById.has(station.id)) stationsById.set(station.id, station);
    const { geometry, positions } = runGeometry(
      runStations,
      waypointsByDir[bound] ?? null,
      warnings,
      `${pair.route} ${bound}`,
    );
    segments.push(runStations.map((station) => station.id));
    runsMeta.push({
      dir: bound,
      gtfsId: entry.gtfsId ?? pair.gtfsId,
      orig: {
        en: cleanStopNameEn(entry.orig?.en ?? ""),
        zh: cleanStopNameZh(entry.orig?.zh ?? ""),
      },
      dest: {
        en: cleanStopNameEn(entry.dest?.en ?? ""),
        zh: cleanStopNameZh(entry.dest?.zh ?? ""),
      },
    });
    geometries.push(geometry);
    stopPositions.push(positions);
  }
  if (!segments.length) return { route: null, warnings };
  const operator = primaryOperator(pair.co);
  const route = {
    id: routeId(pair),
    route: pair.route,
    co: pair.co,
    operator,
    serviceType: pair.serviceType,
    code: pair.route,
    nameEn: pair.route,
    nameZh: pair.route,
    color: routeColor(pair.co, pair.route),
    stations: [...stationsById.values()],
    segments,
    runsMeta,
    geometries,
    stopPositions,
  };
  return { route, warnings };
}
