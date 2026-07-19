export const ROUTE_DIRECTIONS = {
  FORWARD: "forward",
  REVERSE: "reverse",
};

// Each entry in route.segments is a real service run. For buses run 0 is
// the outbound direction and run 1 the inbound one — different stop lists,
// so direction choice is run choice, never an array reverse.
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
