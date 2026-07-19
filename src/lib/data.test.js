import { describe, expect, it } from "vitest";
import {
  getLineRuns,
  getPlayableStations,
  getRunLabel,
  ROUTE_DIRECTIONS,
} from "./data";

// A bus-shaped fixture: run 0 is outbound, run 1 the inbound stop list.
const tkl = {
  code: "290",
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
