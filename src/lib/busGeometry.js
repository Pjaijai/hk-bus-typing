// Geometry helpers shared by the build script (lon/lat, meters) and the map
// runtime (screen pixels, Euclidean). Points are [x, y] pairs; for
// geographic work x = lon, y = lat.

const METERS_PER_DEG_LAT = 111320;

// Equirectangular approximation — fine at Hong Kong's scale.
export function distanceMeters(a, b) {
  const midLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * Math.cos(midLat) * METERS_PER_DEG_LAT;
  const dy = (b[1] - a[1]) * METERS_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

export function euclidean(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

// Concatenate a waypoint GeoJSON's MultiLineString parts (in file order)
// into one polyline, dropping consecutive duplicate points. Returns
// { line, gaps } where gaps counts >100 m jumps between parts.
export function flattenWaypoints(geojson) {
  const geometry = geojson?.features?.[0]?.geometry;
  if (!geometry) return { line: [], gaps: 0 };
  const parts =
    geometry.type === "MultiLineString"
      ? geometry.coordinates
      : geometry.type === "LineString"
        ? [geometry.coordinates]
        : [];
  const line = [];
  let gaps = 0;
  for (const part of parts) {
    for (const point of part) {
      const last = line[line.length - 1];
      if (last && last[0] === point[0] && last[1] === point[1]) continue;
      if (
        last &&
        point === part[0] &&
        distanceMeters(last, point) > 100
      )
        gaps += 1;
      line.push(point);
    }
  }
  return { line, gaps };
}

// Douglas-Peucker in coordinate units (degrees or pixels).
export function simplifyLine(points, tolerance) {
  if (points.length <= 2) return points.slice();
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const a = points[first];
    const b = points[last];
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = pointToSegmentDistance(points[i], a, b);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }
    if (maxDistance > tolerance && index > 0) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function pointToSegmentDistance(p, a, b) {
  const { t } = projectOnSegment(p, a, b);
  const x = a[0] + (b[0] - a[0]) * t;
  const y = a[1] + (b[1] - a[1]) * t;
  return Math.hypot(p[0] - x, p[1] - y);
}

function projectOnSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return { t: 0 };
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq;
  return { t: Math.min(Math.max(t, 0), 1) };
}

// Match ordered stops onto the route polyline. The search only moves
// forward from the previous match, so self-intersecting and circular
// routes resolve correctly; within the forward window the first segment
// closer than acceptMeters wins, which stops a revisited corridor from
// stealing a stop meant for the earlier pass.
export function matchStopsToLine(
  stops,
  line,
  { acceptMeters = 50, distanceFn = distanceMeters } = {},
) {
  if (line.length < 2) return null;
  const positions = [];
  let maxDistance = 0;
  let fromIndex = 0;
  let fromT = 0;
  for (const stop of stops) {
    const point = [stop.lon, stop.lat];
    let best = null;
    for (let i = fromIndex; i < line.length - 1; i += 1) {
      let { t } = projectOnSegment(point, line[i], line[i + 1]);
      if (i === fromIndex && t < fromT) t = fromT;
      const projected = [
        line[i][0] + (line[i + 1][0] - line[i][0]) * t,
        line[i][1] + (line[i + 1][1] - line[i][1]) * t,
      ];
      const distance = distanceFn(point, projected);
      if (!best || distance < best.distance) best = { i, t, distance };
      if (distance <= acceptMeters) {
        best = { i, t, distance };
        break;
      }
    }
    if (!best) return null;
    positions.push(best);
    maxDistance = Math.max(maxDistance, best.distance);
    fromIndex = best.i;
    fromT = best.t;
  }
  return { positions, maxDistance };
}

export function pointAt(line, i, t) {
  const a = line[i];
  const b = line[Math.min(i + 1, line.length - 1)];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function cumulativeLengths(points, distanceFn = euclidean) {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1)
    lengths.push(lengths[i - 1] + distanceFn(points[i - 1], points[i]));
  return lengths;
}

export function positionToLength(points, lengths, position, distanceFn = euclidean) {
  const { i, t } = position;
  const segment = distanceFn(points[i], points[Math.min(i + 1, points.length - 1)]);
  return lengths[i] + segment * t;
}

// Position and travel direction at arc length s — drives the bus marker.
export function pointAtLength(points, lengths, s) {
  const total = lengths[lengths.length - 1];
  const target = Math.min(Math.max(s, 0), total);
  let low = 0;
  let high = lengths.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (lengths[mid + 1] < target) low = mid + 1;
    else high = mid;
  }
  const i = Math.min(low, points.length - 2);
  const span = lengths[i + 1] - lengths[i];
  const t = span ? (target - lengths[i]) / span : 0;
  const a = points[i];
  const b = points[i + 1] ?? a;
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    angle: Math.atan2(b[1] - a[1], b[0] - a[0]),
  };
}
