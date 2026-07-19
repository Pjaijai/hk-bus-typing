import { describe, expect, it } from "vitest";
import { cleanStopNameEn, cleanStopNameZh, stopTypingTarget } from "./names";

describe("cleanStopNameEn", () => {
  it("strips trailing facility codes and title-cases", () => {
    expect(cleanStopNameEn("PUBLIC SQUARE STREET YAU MA TEI (YT545)")).toBe(
      "Public Square Street Yau Ma Tei",
    );
  });

  it("strips stacked trailing codes", () => {
    expect(cleanStopNameEn("STAR FERRY (TS01) (TS02)")).toBe("Star Ferry");
  });

  it("keeps real parenthesised place suffixes", () => {
    expect(cleanStopNameEn("SHEK TONG TSUI (HILL ROAD)")).toBe(
      "Shek Tong Tsui (Hill Road)",
    );
  });

  it("handles apostrophes", () => {
    expect(cleanStopNameEn("QUEEN'S ROAD CENTRAL")).toBe(
      "Queen's Road Central",
    );
    expect(cleanStopNameEn("O'BRIEN ROAD")).toBe("O'Brien Road");
  });

  it("keeps acronyms upper-case", () => {
    expect(cleanStopNameEn("MTR KOWLOON STATION")).toBe("MTR Kowloon Station");
    expect(cleanStopNameEn("HZMB HONG KONG PORT")).toBe("HZMB Hong Kong Port");
  });

  it("collapses whitespace", () => {
    expect(cleanStopNameEn("  TSIM SHA TSUI   FERRY ")).toBe(
      "Tsim Sha Tsui Ferry",
    );
  });
});

describe("cleanStopNameZh", () => {
  it("strips codes in half-width and full-width parens", () => {
    expect(cleanStopNameZh("油麻地眾坊街 (YT545)")).toBe("油麻地眾坊街");
    expect(cleanStopNameZh("尖沙咀碼頭（TS01）")).toBe("尖沙咀碼頭");
  });

  it("keeps descriptive parentheses", () => {
    expect(cleanStopNameZh("中環（交易廣場）")).toBe("中環（交易廣場）");
  });
});

describe("stopTypingTarget", () => {
  it("drops apostrophes without splitting the word", () => {
    expect(stopTypingTarget("Queen's Road Central")).toBe(
      "queens road central",
    );
  });

  it("turns other punctuation into single spaces", () => {
    expect(stopTypingTarget("Central (Exchange Square)")).toBe(
      "central exchange square",
    );
    expect(stopTypingTarget("Kwun Tong Road / Elegance Road")).toBe(
      "kwun tong road elegance road",
    );
  });
});
