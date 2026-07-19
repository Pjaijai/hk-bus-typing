import { geoMercator, geoPath } from "d3-geo";
import { cumulativeLengths, pointAt, positionToLength } from "./busGeometry.js";

// Hong Kong is wider than tall, so the home map uses a landscape canvas.
export const MAP_VIEWBOX = [0, 0, 960, 620];

// Fit to the territory proper; keeps Victoria Harbour near the centre.
const HK_BOUNDS = {
  type: "Polygon",
  coordinates: [
    [
      [113.82, 22.15],
      [113.82, 22.57],
      [114.45, 22.57],
      [114.45, 22.15],
      [113.82, 22.15],
    ],
  ],
};

// Projects everything once: route geometry to screen polylines, and each
// run's stops onto that polyline (via their {i, t} params) so dots sit
// exactly on the drawn path and the bus can ride it by arc length.
export function buildMapModel(boundaryFeature, routes) {
  const projection = geoMercator().fitExtent(
    [
      [24, 24],
      [936, 596],
    ],
    HK_BOUNDS,
  );
  const path = geoPath(projection);
  const boundaryPath = path(boundaryFeature);

  const mapRoutes = routes.map((route) => {
    const stationById = new Map(
      route.stations.map((station) => [station.id, station]),
    );
    const runs = route.segments.map((stopIds, runIndex) => {
      const rawGeometry =
        route.geometries?.[runIndex] ??
        stopIds.map((id) => {
          const station = stationById.get(id);
          return [station.lon, station.lat];
        });
      const geometry = rawGeometry.map((point) => projection(point));
      const lengths = cumulativeLengths(geometry);
      const stops = stopIds.map((id, stopIndex) => {
        const position = route.stopPositions?.[runIndex]?.[stopIndex] ?? {
          i: stopIndex,
          t: 0,
        };
        return {
          station: stationById.get(id),
          point: pointAt(geometry, position.i, position.t),
          length: positionToLength(geometry, lengths, position),
        };
      });
      return { index: runIndex, geometry, lengths, stops };
    });
    return {
      ...route,
      runs,
      // Drawing and camera framing both consume the projected polylines.
      segments: runs.map((run) => run.geometry),
    };
  });

  return { boundaryPath, routes: mapRoutes };
}

// verticalOffsetRatio shifts the viewBox down so the route renders above
// centre — used in-game where the floating island covers the lower third.
export function getRouteViewBox(
  route,
  minimumWidth = 320,
  padding = 48,
  verticalOffsetRatio = 0,
) {
  if (!route) return MAP_VIEWBOX;
  const points = route.segments.flat();
  if (!points.length) return MAP_VIEWBOX;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX + padding * 2, minimumWidth);
  const height = Math.max(maxY - minY + padding * 2, width * 0.62);
  return [
    (minX + maxX - width) / 2,
    (minY + maxY - height) / 2 + height * verticalOffsetRatio,
    width,
    height,
  ];
}

// Frames a small set of points (current + next stop) for the in-game
// tracking camera. minimumWidth keeps it from zooming in absurdly close.
export function getPairViewBox(
  points,
  minimumWidth = 210,
  padding = 52,
  verticalOffsetRatio = 0,
) {
  if (!points.length) return MAP_VIEWBOX;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX + padding * 2, minimumWidth);
  const height = Math.max(maxY - minY + padding * 2, width * 0.62);
  return [
    (minX + maxX - width) / 2,
    (minY + maxY - height) / 2 + height * verticalOffsetRatio,
    width,
    height,
  ];
}

export function pointsToString(points) {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}
