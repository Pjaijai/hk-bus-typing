export const ROUTE_DIRECTIONS = {
  FORWARD: "forward",
  REVERSE: "reverse",
};

// Station pairs connected by an official out-of-station interchange.
export const WALKING_INTERCHANGES = [
  ["CEN", "HOK"], // Central ↔ Hong Kong
  ["TST", "ETS"], // Tsim Sha Tsui ↔ East Tsim Sha Tsui
];

// Stations sharing a code across lines are the same node, so interchanges
// fall out of the graph naturally; walking links are added explicitly.
export function buildNetwork(lines) {
  const stationsById = new Map();
  const adjacency = new Map();
  const link = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  };
  for (const line of lines) {
    for (const station of line.stations)
      if (!stationsById.has(station.id)) stationsById.set(station.id, station);
    for (const segment of line.segments ?? [])
      for (let i = 0; i < segment.length - 1; i += 1)
        link(segment[i], segment[i + 1]);
  }
  for (const [a, b] of WALKING_INTERCHANGES)
    if (stationsById.has(a) && stationsById.has(b)) link(a, b);
  return { stationsById, adjacency };
}

// Fewest-stations path between two stations (BFS).
export function findJourney(network, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return [];
  if (!network.adjacency.has(fromId) || !network.adjacency.has(toId)) return [];
  const previous = new Map([[fromId, null]]);
  const queue = [fromId];
  while (queue.length) {
    const current = queue.shift();
    if (current === toId) break;
    for (const next of network.adjacency.get(current) ?? [])
      if (!previous.has(next)) {
        previous.set(next, current);
        queue.push(next);
      }
  }
  if (!previous.has(toId)) return [];
  const path = [];
  for (let id = toId; id !== null; id = previous.get(id))
    path.unshift(network.stationsById.get(id));
  return path;
}

// Each entry in line.segments is a real service pattern, e.g. the Tseung
// Kwan O Line runs North Point→Po Lam and North Point→LOHAS Park.
export function getLineRuns(line) {
  if (!line) return [];
  const stationById = new Map(
    line.stations.map((station) => [station.id, station]),
  );
  const segments =
    line.segments ?? [line.stations.map((station) => station.id)];
  return segments
    .map((stationIds, index) => {
      const stations = stationIds
        .map((id) => stationById.get(id))
        .filter(Boolean);
      return { index, stations };
    })
    .filter((run) => run.stations.length > 1);
}

export function getRunLabel(run, useZh) {
  if (!run?.stations.length) return "";
  const first = run.stations[0];
  const last = run.stations[run.stations.length - 1];
  return useZh
    ? `${first.nameZh} → ${last.nameZh}`
    : `${first.nameEn} → ${last.nameEn}`;
}

export function getPlayableStations(
  line,
  runIndex = 0,
  direction = ROUTE_DIRECTIONS.FORWARD,
) {
  const runs = getLineRuns(line);
  const stations = (runs[runIndex] ?? runs[0])?.stations ?? [];
  return direction === ROUTE_DIRECTIONS.REVERSE
    ? [...stations].reverse()
    : stations;
}
