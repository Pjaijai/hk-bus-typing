import { describe, expect, it } from "vitest";
import {
  buildRouteIndex,
  normalizeRoute,
  pairBounds,
  primaryOperator,
  routeColor,
} from "./busNormalize";

const stopList = {
  S1: { location: { lat: 22.30, lng: 114.10 }, name: { en: "FIRST STREET (AB12)", zh: "第一街 (AB12)" } },
  S2: { location: { lat: 22.31, lng: 114.11 }, name: { en: "SECOND STREET (CD34)", zh: "第二街" } },
  S3: { location: { lat: 22.32, lng: 114.12 }, name: { en: "QUEEN'S PIER (EF56)", zh: "皇后碼頭" } },
  S2B: { location: { lat: 22.311, lng: 114.111 }, name: { en: "SECOND STREET (ZZ99)", zh: "第二街" } },
};

const entry = (overrides) => ({
  route: "10",
  serviceType: 1,
  co: ["kmb"],
  bound: { kmb: "O" },
  orig: { en: "FIRST STREET", zh: "第一街" },
  dest: { en: "QUEEN'S PIER", zh: "皇后碼頭" },
  gtfsId: "1234",
  stops: { kmb: ["S1", "S2", "S3"] },
  ...overrides,
});

const routeList = {
  "10+1+FIRST STREET+QUEEN'S PIER": entry({}),
  "10+1+QUEEN'S PIER+FIRST STREET": entry({
    bound: { kmb: "I" },
    orig: { en: "QUEEN'S PIER", zh: "皇后碼頭" },
    dest: { en: "FIRST STREET", zh: "第一街" },
    stops: { kmb: ["S3", "S2", "S1"] },
  }),
  "10+2+FIRST STREET+QUEEN'S PIER": entry({ serviceType: 2 }),
  "88+1+A+B": entry({
    route: "88",
    co: ["gmb"],
    bound: { gmb: "O" },
    stops: { gmb: ["S1", "S2"] },
  }),
};

describe("primaryOperator / routeColor", () => {
  it("prefers KMB for joint cross-harbour routes", () => {
    expect(primaryOperator(["ctb", "kmb"])).toBe("kmb");
    expect(routeColor(["kmb", "ctb"])).toBe("#D71920");
    expect(routeColor(["ctb"])).toBe("#FDB913");
  });
});

describe("buildRouteIndex", () => {
  const index = buildRouteIndex(routeList);

  it("pairs outbound and inbound into one entry", () => {
    expect(index).toHaveLength(2);
    expect(Object.keys(index[0].bounds).sort()).toEqual(["I", "O"]);
  });

  it("prefers the lowest service type", () => {
    expect(index[0].serviceType).toBe("1");
  });

  it("includes minibus and other non-franchised operators", () => {
    expect(index.find((route) => route.route === "88")).toBeDefined();
  });

  it("cleans terminus names", () => {
    expect(index[0].dest.en).toBe("Queen's Pier");
  });
});

describe("pairBounds", () => {
  it("pairs NLB-style twin outbound entries as O and I", () => {
    const nlb = [
      {
        key: "1+1+MUI WO+TAI O",
        entry: entry({
          co: ["nlb"],
          bound: { nlb: "O" },
          gtfsId: null,
          orig: { en: "Mui Wo Ferry Pier", zh: "梅窩" },
          dest: { en: "Tai O", zh: "大澳" },
          stops: { nlb: ["S1", "S2", "S3"] },
        }),
      },
      {
        key: "1+1+TAI O+MUI WO",
        entry: entry({
          co: ["nlb"],
          bound: { nlb: "O" },
          gtfsId: null,
          orig: { en: "Tai O", zh: "大澳" },
          dest: { en: "Mui Wo Ferry Pier", zh: "梅窩" },
          stops: { nlb: ["S3", "S2", "S1"] },
        }),
      },
    ];
    const pairs = pairBounds(nlb);
    expect(pairs).toHaveLength(1);
    expect(Object.keys(pairs[0].entries).sort()).toEqual(["I", "O"]);
  });

  it("maps MTR down/up track bounds onto O and I", () => {
    const mtr = [
      {
        key: "TML+1+A+B",
        entry: entry({
          route: "TML",
          co: ["mtr"],
          bound: { mtr: "DT" },
          gtfsId: null,
          stops: { mtr: ["S1", "S2", "S3"] },
        }),
      },
      {
        key: "TML+1+B+A",
        entry: entry({
          route: "TML",
          co: ["mtr"],
          bound: { mtr: "UT" },
          gtfsId: null,
          stops: { mtr: ["S3", "S2", "S1"] },
        }),
      },
    ];
    const pairs = pairBounds(mtr);
    expect(pairs).toHaveLength(1);
    expect(Object.keys(pairs[0].entries).sort()).toEqual(["I", "O"]);
  });

  it("prefers a waypoint-capable service type over a bare lower one", () => {
    const variants = {
      "1+1+MUI WO+TAI O": entry({
        co: ["nlb"],
        bound: { nlb: "O" },
        gtfsId: null,
        stops: { nlb: ["S1", "S2"] },
      }),
      "1+2+MUI WO+TAI O": entry({
        serviceType: 2,
        co: ["nlb"],
        bound: { nlb: "O" },
        gtfsId: "1723",
        stops: { nlb: ["S1", "S2"] },
      }),
      "1+2+TAI O+MUI WO": entry({
        serviceType: 2,
        co: ["nlb"],
        bound: { nlb: "I" },
        gtfsId: "1723",
        orig: { en: "QUEEN'S PIER", zh: "皇后碼頭" },
        dest: { en: "FIRST STREET", zh: "第一街" },
        stops: { nlb: ["S2", "S1"] },
      }),
    };
    const index = buildRouteIndex(variants);
    expect(index).toHaveLength(1);
    expect(index[0].serviceType).toBe("2");
    expect(Object.keys(index[0].bounds).sort()).toEqual(["I", "O"]);
  });

  it("keeps a circular route as a single run", () => {
    const circular = {
      "22M+1+LOOP+LOOP": entry({
        route: "22M",
        bound: { kmb: "IO" },
        stops: { kmb: ["S1", "S2", "S3", "S1"] },
      }),
    };
    const pairs = pairBounds(
      Object.entries(circular).map(([key, value]) => ({ key, entry: value })),
    );
    expect(pairs).toHaveLength(1);
    expect(Object.keys(pairs[0].entries)).toEqual(["O"]);
  });
});

describe("normalizeRoute", () => {
  const pairs = pairBounds(
    Object.entries(routeList)
      .filter(([key]) => key.startsWith("10+1"))
      .map(([key, value]) => ({ key, entry: value })),
  );

  it("falls back to straight-line geometry without waypoints", () => {
    const { route, warnings } = normalizeRoute({ pair: pairs[0], stopList });
    expect(route.segments).toHaveLength(2);
    expect(route.geometries[0]).toEqual([
      [114.1, 22.3],
      [114.11, 22.31],
      [114.12, 22.32],
    ]);
    expect(route.stopPositions[0]).toEqual([
      { i: 0, t: 0 },
      { i: 1, t: 0 },
      { i: 2, t: 0 },
    ]);
    expect(warnings).toEqual([]);
  });

  it("produces game-ready stations", () => {
    const { route } = normalizeRoute({ pair: pairs[0], stopList });
    const station = route.stations.find((s) => s.id === "S3");
    expect(station.nameEn).toBe("Queen's Pier");
    expect(station.target).toBe("queens pier");
    expect(route.runsMeta[1].dir).toBe("I");
  });

  it("matches stops onto waypoint geometry when provided", () => {
    const waypoints = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiLineString",
            coordinates: [
              [
                [114.10, 22.30],
                [114.105, 22.306],
                [114.11, 22.31],
                [114.115, 22.316],
                [114.12, 22.32],
              ],
            ],
          },
        },
      ],
    };
    const { route, warnings } = normalizeRoute({
      pair: pairs[0],
      stopList,
      waypointsByDir: { O: waypoints },
    });
    expect(warnings).toEqual([]);
    const positions = route.stopPositions[0];
    const order = positions.map(({ i, t }) => i + t);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Inbound had no waypoints, so it keeps the straight fallback.
    expect(route.geometries[1]).toHaveLength(3);
  });

  it("collapses consecutive stops that clean to the same name", () => {
    const doubled = pairBounds([
      {
        key: "10+1+FIRST STREET+QUEEN'S PIER",
        entry: entry({ stops: { kmb: ["S1", "S2", "S2B", "S3"] } }),
      },
    ]);
    const { route } = normalizeRoute({ pair: doubled[0], stopList });
    expect(route.segments[0]).toEqual(["S1", "S2", "S3"]);
  });
});
