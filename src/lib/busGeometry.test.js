import { describe, expect, it } from "vitest";
import {
  cumulativeLengths,
  euclidean,
  flattenWaypoints,
  matchStopsToLine,
  pointAt,
  pointAtLength,
  positionToLength,
  simplifyLine,
} from "./busGeometry";

const featureCollection = (coordinates) => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: { type: "MultiLineString", coordinates },
    },
  ],
});

describe("flattenWaypoints", () => {
  it("concatenates parts and drops duplicate joints", () => {
    const { line } = flattenWaypoints(
      featureCollection([
        [
          [114.1, 22.3],
          [114.2, 22.3],
        ],
        [
          [114.2, 22.3],
          [114.3, 22.4],
        ],
      ]),
    );
    expect(line).toEqual([
      [114.1, 22.3],
      [114.2, 22.3],
      [114.3, 22.4],
    ]);
  });

  it("counts large gaps between parts", () => {
    const { gaps } = flattenWaypoints(
      featureCollection([
        [
          [114.1, 22.3],
          [114.11, 22.3],
        ],
        [
          [114.2, 22.35],
          [114.21, 22.35],
        ],
      ]),
    );
    expect(gaps).toBe(1);
  });
});

describe("simplifyLine", () => {
  it("removes collinear points and keeps corners", () => {
    const line = [
      [0, 0],
      [1, 0.0001],
      [2, 0],
      [2, 1],
    ];
    expect(simplifyLine(line, 0.01)).toEqual([
      [0, 0],
      [2, 0],
      [2, 1],
    ]);
  });
});

describe("matchStopsToLine", () => {
  // Out-and-back corridor: east along y=0, back west along y=1.
  const corridor = [
    [0, 0],
    [10, 0],
    [10, 1],
    [0, 1],
  ];

  it("stays monotonic through a revisited corridor", () => {
    const stops = [
      { lon: 2, lat: 0.05 },
      { lon: 8, lat: 0.05 },
      { lon: 8, lat: 0.95 },
      { lon: 2, lat: 0.95 },
    ];
    const match = matchStopsToLine(stops, corridor, {
      acceptMeters: 0.2,
      distanceFn: euclidean,
    });
    expect(match).not.toBeNull();
    const order = match.positions.map(({ i, t }) => i + t);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(match.positions[0].i).toBe(0);
    expect(match.positions[3].i).toBe(2);
  });

  it("gives a circular route distinct start and end params", () => {
    const loop = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ];
    const stops = [
      { lon: 0, lat: 0 },
      { lon: 4, lat: 2 },
      { lon: 0.01, lat: 0.01 },
    ];
    const match = matchStopsToLine(stops, loop, {
      acceptMeters: 0.1,
      distanceFn: euclidean,
    });
    expect(match.positions[0].i).toBe(0);
    expect(match.positions[2].i).toBe(3);
  });

  it("reports the farthest stop distance", () => {
    const match = matchStopsToLine(
      [{ lon: 5, lat: 3 }],
      corridor,
      { acceptMeters: 0.1, distanceFn: euclidean },
    );
    expect(match.maxDistance).toBeCloseTo(2, 5);
  });
});

describe("arc length helpers", () => {
  const line = [
    [0, 0],
    [3, 0],
    [3, 4],
  ];
  const lengths = cumulativeLengths(line);

  it("accumulates segment lengths", () => {
    expect(lengths).toEqual([0, 3, 7]);
  });

  it("converts a matched position to a length", () => {
    expect(positionToLength(line, lengths, { i: 1, t: 0.5 })).toBe(5);
  });

  it("interpolates point and angle at a length", () => {
    const { point, angle } = pointAtLength(line, lengths, 5);
    expect(point[0]).toBeCloseTo(3);
    expect(point[1]).toBeCloseTo(2);
    expect(angle).toBeCloseTo(Math.PI / 2);
  });

  it("clamps beyond the ends", () => {
    expect(pointAtLength(line, lengths, 99).point).toEqual([3, 4]);
    expect(pointAt(line, 2, 0)).toEqual([3, 4]);
  });
});
