// Builds public/data/mtr.json and public/data/hk-boundary.json from raw
// snapshots in data/. Missing snapshots are fetched and saved so later runs
// are reproducible offline. Run: node scripts/build-data.mjs
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoArea } from "d3-geo";
import { buildLand } from "./coastline.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const OUT_DIR = path.join(ROOT, "public", "data");

const SOURCES = {
  csv: {
    file: "mtr_lines_and_stations.csv",
    url: "https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv",
  },
  osm: {
    file: "osm-stations.json",
    url:
      "https://overpass-api.de/api/interpreter?data=" +
      encodeURIComponent(
        '[out:json][timeout:60];nwr["railway"="station"](22.1,113.8,22.6,114.5);out tags center;',
      ),
  },
  coastline: {
    file: "osm-coastline.json",
    url:
      "https://overpass-api.de/api/interpreter?data=" +
      encodeURIComponent(
        '[out:json][timeout:100];way["natural"="coastline"](22.13,113.80,22.62,114.50);(._;>;);out;',
      ),
  },
  admin: {
    file: "hk-admin-raw.json",
    url: "https://polygons.openstreetmap.fr/get_geojson.py?id=913110&params=0",
  },
};

// Official line colours and names. CSV order is not the desired display order.
const LINES = [
  { code: "ISL", nameZh: "港島綫", nameEn: "Island Line", color: "#0075C2" },
  { code: "TWL", nameZh: "荃灣綫", nameEn: "Tsuen Wan Line", color: "#E60012" },
  { code: "KTL", nameZh: "觀塘綫", nameEn: "Kwun Tong Line", color: "#00A040" },
  { code: "TKL", nameZh: "將軍澳綫", nameEn: "Tseung Kwan O Line", color: "#7D499D" },
  { code: "EAL", nameZh: "東鐵綫", nameEn: "East Rail Line", color: "#53B7E8" },
  { code: "TML", nameZh: "屯馬綫", nameEn: "Tuen Ma Line", color: "#9C2E00" },
  { code: "TCL", nameZh: "東涌綫", nameEn: "Tung Chung Line", color: "#F7943E" },
  { code: "SIL", nameZh: "南港島綫", nameEn: "South Island Line", color: "#BAC429" },
  { code: "AEL", nameZh: "機場快綫", nameEn: "Airport Express", color: "#007078" },
  { code: "DRL", nameZh: "迪士尼綫", nameEn: "Disneyland Resort Line", color: "#F173AC" },
];

async function loadSource({ file, url }) {
  const filePath = path.join(DATA_DIR, file);
  try {
    await access(filePath);
  } catch {
    console.log(`fetching ${url}`);
    const response = await fetch(url, {
      headers: { "User-Agent": "hk-mtr-typing-data/0.1" },
    });
    if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
    await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
  }
  return readFile(filePath, "utf8");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') inQuotes = false;
      else value += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n" || char === "\r") {
      if (value || row.length) {
        row.push(value);
        rows.push(row);
      }
      row = [];
      value = "";
    } else value += char;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function buildStationRecords(csvText) {
  const rows = parseCsv(csvText.replace(/^﻿/, "")).slice(1);
  const byLine = new Map();
  for (const row of rows) {
    if (row.length < 7 || !row[0]) continue;
    const [lineCode, direction, stationCode, stationId, nameZh, nameEn, sequence] = row;
    if (!byLine.has(lineCode)) byLine.set(lineCode, new Map());
    const directions = byLine.get(lineCode);
    if (!directions.has(direction)) directions.set(direction, []);
    directions.get(direction).push({
      id: stationCode,
      stationId: stationCode,
      mtrId: stationId,
      nameZh,
      nameEn,
      sequence: Number(sequence),
    });
  }
  for (const directions of byLine.values())
    for (const stations of directions.values())
      stations.sort((a, b) => a.sequence - b.sequence);
  return byLine;
}

// The CSV lists each service pattern as a direction: plain UT/DT for the
// trunk, and prefixed variants (LMC-UT, TKS-UT) for branches. A branch that
// starts mid-trunk (TKL's LOHAS Park pattern starts at Tiu Keng Leng) is
// grafted onto the trunk so the run covers the full ride from the terminus.
function buildRuns(directions) {
  const trunk = directions.get("UT");
  if (!trunk) throw new Error("missing UT direction");
  const runs = [trunk];
  for (const [direction, stations] of directions) {
    if (direction === "UT" || direction === "DT" || direction.endsWith("-DT")) continue;
    const forkIndex = trunk.findIndex((station) => station.id === stations[0].id);
    if (forkIndex > 0) runs.push([...trunk.slice(0, forkIndex), ...stations]);
    else runs.push(stations);
  }
  return runs;
}

function scoreOsmCandidate(tags, nameZh) {
  let score = 0;
  const operator = `${tags.operator ?? ""} ${tags.network ?? ""}`;
  if (/MTR|港鐵/.test(operator)) score += 2;
  if (!tags.station) score += 1;
  else if (!["light_rail", "tram", "funicular", "monorail"].includes(tags.station)) score += 1;
  else score -= 3;
  const zh = tags["name:zh"] ?? tags.name ?? "";
  if (nameZh && zh.includes(nameZh)) score += 2;
  return score;
}

function buildCoordinateIndex(osmText) {
  const elements = JSON.parse(osmText).elements;
  const index = new Map();
  for (const element of elements) {
    const tags = element.tags ?? {};
    const nameEn = (tags["name:en"] ?? "").trim() || (tags.name ?? "").trim();
    if (!nameEn) continue;
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat == null || lon == null) continue;
    if (!index.has(nameEn)) index.set(nameEn, []);
    index.get(nameEn).push({ tags, lat, lon });
  }
  return index;
}

async function loadOverrides() {
  try {
    return JSON.parse(
      await readFile(path.join(DATA_DIR, "coordinate-overrides.json"), "utf8"),
    );
  } catch {
    return {};
  }
}

const [csvText, osmText, coastlineText, adminText] = await Promise.all([
  loadSource(SOURCES.csv),
  loadSource(SOURCES.osm),
  loadSource(SOURCES.coastline),
  loadSource(SOURCES.admin),
]);
const overrides = await loadOverrides();
const byLine = buildStationRecords(csvText);
const coordinateIndex = buildCoordinateIndex(osmText);

const missingCoordinates = [];
function locate(station) {
  const override = overrides[station.id];
  if (override) return override;
  const candidates = coordinateIndex.get(station.nameEn) ?? [];
  const best = candidates
    .map((candidate) => ({
      candidate,
      score: scoreOsmCandidate(candidate.tags, station.nameZh),
    }))
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 0) {
    missingCoordinates.push(`${station.id} ${station.nameEn}`);
    return { lat: null, lon: null };
  }
  return { lat: best.candidate.lat, lon: best.candidate.lon };
}

const lines = LINES.map(({ code, nameZh, nameEn, color }) => {
  const directions = byLine.get(code);
  if (!directions) throw new Error(`line ${code} missing from CSV`);
  const runs = buildRuns(directions);
  const stationById = new Map();
  for (const run of runs)
    for (const station of run)
      if (!stationById.has(station.id)) stationById.set(station.id, station);
  const stations = [...stationById.values()].map((station) => {
    const { lat, lon } = locate(station);
    return {
      ...station,
      target: station.nameEn.toLowerCase(),
      lat,
      lon,
    };
  });
  return {
    id: `MTR-${code}`,
    code,
    nameZh,
    nameEn,
    color,
    stations,
    segments: runs.map((run) => run.map((station) => station.id)),
  };
});

// Validation: every line present, every station located, branches captured.
if (missingCoordinates.length)
  throw new Error(`stations without coordinates:\n${missingCoordinates.join("\n")}`);
const expect = (label, actual, expected) => {
  if (actual !== expected)
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
};
const lineByCode = new Map(lines.map((line) => [line.code, line]));
expect("line count", lines.length, 10);
expect("ISL stations", lineByCode.get("ISL").stations.length, 17);
expect("TWL stations", lineByCode.get("TWL").stations.length, 16);
expect("EAL runs", lineByCode.get("EAL").segments.length, 2);
expect("EAL stations", lineByCode.get("EAL").stations.length, 15);
expect("TKL runs", lineByCode.get("TKL").segments.length, 2);
expect("TKL LOHAS run", lineByCode.get("TKL").segments[1].join(","), "NOP,QUB,YAT,TIK,TKO,LHP");

const admin = JSON.parse(adminText);
if (admin.type !== "MultiPolygon") throw new Error("unexpected admin boundary type");
const landCoordinates = buildLand(JSON.parse(coastlineText), admin.coordinates).map(
  (polygon) =>
    polygon.map((ring) =>
      ring.map(([lon, lat]) => [
        Math.round(lon * 1e5) / 1e5,
        Math.round(lat * 1e5) / 1e5,
      ]),
    ),
);
if (landCoordinates.length < 20)
  throw new Error(`suspiciously few land polygons: ${landCoordinates.length}`);
const asLandFeature = (coordinates) => ({
  type: "Feature",
  properties: { name: "Hong Kong", source: "OpenStreetMap (ODbL)" },
  geometry: { type: "MultiPolygon", coordinates },
});
// d3-geo treats rings as spherical: RFC7946-wound rings (polygon-clipping's
// output) cover the whole globe minus Hong Kong, which geoArea exposes as
// more than a hemisphere. Reverse every ring in that case.
let land = asLandFeature(landCoordinates);
if (geoArea(land) > 2 * Math.PI)
  land = asLandFeature(
    landCoordinates.map((polygon) => polygon.map((ring) => [...ring].reverse())),
  );
if (geoArea(land) > 2 * Math.PI) throw new Error("land polygon inverted");

await writeFile(
  path.join(OUT_DIR, "mtr.json"),
  JSON.stringify(
    {
      network: "mtr",
      source: "MTR Corporation open data via DATA.GOV.HK; coordinates © OpenStreetMap contributors (ODbL)",
      sourceUrl: "https://opendata.mtr.com.hk/",
      lines,
    },
    null,
    1,
  ),
);
await writeFile(path.join(OUT_DIR, "hk-boundary.json"), JSON.stringify(land));

console.log(`ok: ${lines.length} lines, ${lines.reduce((n, line) => n + line.stations.length, 0)} line-stations`);
for (const line of lines)
  console.log(
    `  ${line.code} ${line.nameZh} ${line.stations.length} stations, ${line.segments.length} run(s)`,
  );
