import { describe, expect, it } from "vitest";
import {
  buildNetwork,
  findJourney,
  getLineRuns,
  getPlayableStations,
  getRunLabel,
  ROUTE_DIRECTIONS,
} from "./data";

const tkl = {
  code: "TKL",
  stations: [
    { id: "NOP", nameZh: "北角", nameEn: "North Point" },
    { id: "QUB", nameZh: "鰂魚涌", nameEn: "Quarry Bay" },
    { id: "YAT", nameZh: "油塘", nameEn: "Yau Tong" },
    { id: "TIK", nameZh: "調景嶺", nameEn: "Tiu Keng Leng" },
    { id: "TKO", nameZh: "將軍澳", nameEn: "Tseung Kwan O" },
    { id: "HAH", nameZh: "坑口", nameEn: "Hang Hau" },
    { id: "POA", nameZh: "寶琳", nameEn: "Po Lam" },
    { id: "LHP", nameZh: "康城", nameEn: "LOHAS Park" },
  ],
  segments: [
    ["NOP", "QUB", "YAT", "TIK", "TKO", "HAH", "POA"],
    ["NOP", "QUB", "YAT", "TIK", "TKO", "LHP"],
  ],
};

describe("getLineRuns", () => {
  it("returns one run per service pattern", () => {
    const runs = getLineRuns(tkl);
    expect(runs).toHaveLength(2);
    expect(runs[0].stations.map((s) => s.id)).toEqual(tkl.segments[0]);
    expect(runs[1].stations.map((s) => s.id)).toEqual(tkl.segments[1]);
  });

  it("falls back to the station list when segments are missing", () => {
    const runs = getLineRuns({ stations: tkl.stations.slice(0, 3) });
    expect(runs).toHaveLength(1);
    expect(runs[0].stations).toHaveLength(3);
  });

  it("returns no runs for a missing line", () => {
    expect(getLineRuns(null)).toEqual([]);
  });
});

describe("getRunLabel", () => {
  it("labels a run terminus to terminus in either language", () => {
    const runs = getLineRuns(tkl);
    expect(getRunLabel(runs[1], false)).toBe("North Point → LOHAS Park");
    expect(getRunLabel(runs[1], true)).toBe("北角 → 康城");
  });
});

describe("buildNetwork / findJourney", () => {
  const station = (id) => ({ id, nameZh: id, nameEn: id });
  const lines = [
    {
      code: "AA",
      stations: ["A1", "A2", "X", "A3"].map(station),
      segments: [["A1", "A2", "X", "A3"]],
    },
    {
      code: "BB",
      stations: ["B1", "X", "B2"].map(station),
      segments: [["B1", "X", "B2"]],
    },
    {
      code: "CC",
      stations: ["CEN", "C2"].map(station),
      segments: [["CEN", "C2"]],
    },
    {
      code: "DD",
      stations: ["HOK", "D2"].map(station),
      segments: [["HOK", "D2"]],
    },
  ];
  const network = buildNetwork(lines);

  it("routes across lines through a shared interchange", () => {
    const path = findJourney(network, "A1", "B2");
    expect(path.map((s) => s.id)).toEqual(["A1", "A2", "X", "B2"]);
  });

  it("uses walking interchanges", () => {
    const path = findJourney(network, "C2", "D2");
    expect(path.map((s) => s.id)).toEqual(["C2", "CEN", "HOK", "D2"]);
  });

  it("returns empty for same or unknown stations", () => {
    expect(findJourney(network, "A1", "A1")).toEqual([]);
    expect(findJourney(network, "A1", "ZZ")).toEqual([]);
    expect(findJourney(network, "", "A1")).toEqual([]);
  });

  it("returns empty when no path exists", () => {
    const isolated = buildNetwork([
      { code: "EE", stations: ["E1", "E2"].map(station), segments: [["E1", "E2"]] },
      { code: "FF", stations: ["F1", "F2"].map(station), segments: [["F1", "F2"]] },
    ]);
    expect(findJourney(isolated, "E1", "F2")).toEqual([]);
  });
});

describe("getPlayableStations", () => {
  it("returns the selected run in order", () => {
    const stations = getPlayableStations(tkl, 1, ROUTE_DIRECTIONS.FORWARD);
    expect(stations.map((s) => s.id)).toEqual(tkl.segments[1]);
  });

  it("reverses for the reverse direction without mutating", () => {
    const stations = getPlayableStations(tkl, 0, ROUTE_DIRECTIONS.REVERSE);
    expect(stations[0].id).toBe("POA");
    expect(tkl.stations[0].id).toBe("NOP");
  });

  it("falls back to the first run for an unknown index", () => {
    const stations = getPlayableStations(tkl, 9);
    expect(stations.map((s) => s.id)).toEqual(tkl.segments[0]);
  });
});
