import { describe, expect, it } from "vitest";
import {
  getTypingTarget,
  isTypingCharacterMatch,
  normalizeCommittedText,
  TYPING_LANGUAGES,
} from "./typing";

const austin = { nameZh: "柯士甸", nameEn: "Austin", target: "austin" };
const awe = {
  nameZh: "博覽館",
  nameEn: "AsiaWorld-Expo",
  target: "asiaworld-expo",
};

describe("getTypingTarget", () => {
  it("lowercases the English target", () => {
    expect(getTypingTarget(austin, TYPING_LANGUAGES.ENGLISH)).toBe("austin");
    expect(getTypingTarget(awe, TYPING_LANGUAGES.ENGLISH)).toBe(
      "asiaworld-expo",
    );
  });

  it("keeps only word characters for Chinese", () => {
    expect(getTypingTarget(awe, TYPING_LANGUAGES.CHINESE)).toBe("博覽館");
    expect(
      getTypingTarget({ nameZh: "迪士尼·樂園" }, TYPING_LANGUAGES.CHINESE),
    ).toBe("迪士尼樂園");
  });

  it("returns empty string for missing station", () => {
    expect(getTypingTarget(null, TYPING_LANGUAGES.ENGLISH)).toBe("");
  });
});

describe("normalizeCommittedText", () => {
  it("strips punctuation in Chinese mode", () => {
    expect(normalizeCommittedText("美孚。", TYPING_LANGUAGES.CHINESE)).toBe(
      "美孚",
    );
  });

  it("keeps spaces in English mode", () => {
    expect(normalizeCommittedText("sha tin", TYPING_LANGUAGES.ENGLISH)).toBe(
      "sha tin",
    );
  });

  it("normalizes fullwidth characters", () => {
    expect(normalizeCommittedText("ｓｈａ", TYPING_LANGUAGES.ENGLISH)).toBe(
      "sha",
    );
  });
});

describe("isTypingCharacterMatch", () => {
  it("matches English case-insensitively", () => {
    expect(isTypingCharacterMatch("A", "a", TYPING_LANGUAGES.ENGLISH)).toBe(
      true,
    );
    expect(isTypingCharacterMatch("b", "a", TYPING_LANGUAGES.ENGLISH)).toBe(
      false,
    );
  });

  it("matches Chinese characters exactly", () => {
    expect(isTypingCharacterMatch("柯", "柯", TYPING_LANGUAGES.CHINESE)).toBe(
      true,
    );
    expect(isTypingCharacterMatch("柯", "士", TYPING_LANGUAGES.CHINESE)).toBe(
      false,
    );
  });

  it("rejects empty input", () => {
    expect(isTypingCharacterMatch("", "a", TYPING_LANGUAGES.ENGLISH)).toBe(
      false,
    );
    expect(isTypingCharacterMatch("a", "", TYPING_LANGUAGES.ENGLISH)).toBe(
      false,
    );
  });
});
