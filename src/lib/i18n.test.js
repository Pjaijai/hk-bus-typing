import { describe, expect, it } from "vitest";
import { getInitialLocale, STRINGS, translate, UI_LOCALES } from "./i18n";

describe("getInitialLocale", () => {
  const storageWith = (value) => ({ getItem: () => value });

  it("prefers the saved locale", () => {
    expect(getInitialLocale(storageWith("zh"), ["en-US"])).toBe(UI_LOCALES.ZH);
  });

  it("ignores unknown saved values", () => {
    expect(getInitialLocale(storageWith("fr"), ["en-US"])).toBe(UI_LOCALES.EN);
  });

  it("falls back to the browser language", () => {
    expect(getInitialLocale(storageWith(null), ["zh-HK"])).toBe(UI_LOCALES.ZH);
    expect(getInitialLocale(storageWith(null), ["en-GB"])).toBe(UI_LOCALES.EN);
  });
});

describe("translate", () => {
  it("returns the locale string", () => {
    expect(translate("zh", "start")).toBe("開始");
    expect(translate("en", "start")).toBe("Start");
  });

  it("falls back to English then the key", () => {
    expect(translate("zh", "missing-key")).toBe("missing-key");
  });
});

describe("STRINGS", () => {
  it("has the same keys in every locale", () => {
    expect(Object.keys(STRINGS.zh).sort()).toEqual(
      Object.keys(STRINGS.en).sort(),
    );
  });
});
