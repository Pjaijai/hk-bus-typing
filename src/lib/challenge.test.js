import { describe, expect, it } from "vitest";
import {
  compareResults,
  decodeChallenge,
  encodeChallenge,
  parseChallengeHash,
} from "./challenge";

const payload = {
  routeId: "kmb-1-1",
  runIndex: 0,
  mode: "timed",
  typingLanguage: "en",
  name: "Paul",
  speed: 42,
  speedUnit: "WPM",
  accuracy: 97,
  completed: 12,
  elapsedSeconds: 28,
};

describe("encodeChallenge / decodeChallenge", () => {
  it("round-trips a payload", () => {
    const decoded = decodeChallenge(encodeChallenge(payload));
    expect(decoded).toEqual({ version: 1, ...payload });
  });

  it("rejects garbage input", () => {
    expect(decodeChallenge("not-valid-base64!!")).toBeNull();
    expect(decodeChallenge("")).toBeNull();
  });

  it("rejects valid base64 that isn't JSON", () => {
    expect(decodeChallenge(btoa("hello world"))).toBeNull();
  });

  it("rejects a payload missing required fields", () => {
    expect(decodeChallenge(encodeChallenge({ ...payload, name: "" }))).toBeNull();
    expect(
      decodeChallenge(encodeChallenge({ ...payload, routeId: "" })),
    ).toBeNull();
  });

  it("rejects an unrecognized schema version", () => {
    const wire = JSON.stringify({ v: 99, r: "kmb-1-1", m: "timed", tl: "en", n: "Paul" });
    const encoded = btoa(wire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeChallenge(encoded)).toBeNull();
  });

  it("decodes a golden fixed string", () => {
    const golden =
      "eyJ2IjoxLCJyIjoia21iLTEtMSIsImkiOjAsIm0iOiJ0aW1lZCIsInRsIjoiZW4iLCJuIjoiUGF1bCIsInMiOjQyLCJ1IjoiV1BNIiwiYSI6OTcsImMiOjEyLCJ0IjoyOH0";
    expect(decodeChallenge(golden)).toEqual({ version: 1, ...payload });
  });
});

describe("parseChallengeHash", () => {
  it("parses a #vs/ hash", () => {
    const hash = `#vs/${encodeChallenge(payload)}`;
    expect(parseChallengeHash(hash)).toEqual({ version: 1, ...payload });
  });

  it("ignores a plain route deep link", () => {
    expect(parseChallengeHash("#r/kmb-1-1")).toBeNull();
  });

  it("ignores an empty hash", () => {
    expect(parseChallengeHash("")).toBeNull();
  });
});

describe("compareResults", () => {
  it("picks the faster speed", () => {
    expect(
      compareResults({ speed: 50, accuracy: 90 }, { speed: 40, accuracy: 90 }),
    ).toBe("challenger");
    expect(
      compareResults({ speed: 40, accuracy: 90 }, { speed: 50, accuracy: 90 }),
    ).toBe("opponent");
  });

  it("breaks a speed tie on accuracy", () => {
    expect(
      compareResults({ speed: 50, accuracy: 95 }, { speed: 50, accuracy: 90 }),
    ).toBe("challenger");
    expect(
      compareResults({ speed: 50, accuracy: 90 }, { speed: 50, accuracy: 95 }),
    ).toBe("opponent");
  });

  it("is a tie when both match", () => {
    expect(
      compareResults({ speed: 50, accuracy: 90 }, { speed: 50, accuracy: 90 }),
    ).toBe("tie");
  });
});
