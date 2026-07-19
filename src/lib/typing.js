export const TYPING_LANGUAGES = {
  ENGLISH: "en",
  CHINESE: "zh",
};

const NON_WORD = /[^\p{Letter}\p{Number}]/gu;

// English targets keep spaces and hyphens are dropped ("AsiaWorld-Expo" →
// "asiaworld expo" would change the name, so instead punctuation is kept out
// of the match by stripping it from both sides only in Chinese mode; English
// targets are typed verbatim in lowercase).
export function getTypingTarget(station, language) {
  if (!station) return "";
  if (language === TYPING_LANGUAGES.CHINESE) {
    return (station.nameZh ?? "").normalize("NFKC").replace(NON_WORD, "");
  }
  return (station.target ?? station.nameEn ?? "").normalize("NFKC").toLowerCase();
}

export function normalizeCommittedText(value, language) {
  const normalized = value.normalize("NFKC");
  return language === TYPING_LANGUAGES.CHINESE
    ? normalized.replace(NON_WORD, "")
    : normalized;
}

export function isTypingCharacterMatch(typed, expected, language) {
  if (!typed || !expected) return false;
  if (language === TYPING_LANGUAGES.CHINESE) {
    return typed.normalize("NFKC") === expected.normalize("NFKC");
  }
  return typed.toLowerCase() === expected;
}
