// Bus stop names arrive ALL-CAPS with facility codes appended, e.g.
// "PUBLIC SQUARE STREET YAU MA TEI (YT545)". These helpers produce the
// display name and the typing target from that raw form.

// Trailing facility codes look like (YT545) / (WT916); real place suffixes
// like "(HILL ROAD)" contain no digits and are kept.
const STOP_CODE = /\s*[(（]\s*[A-Z]{0,4}\d{2,6}\s*[)）]\s*$/;

// Words that must keep their upstream casing when the rest is title-cased.
const KEEP_UPPER = new Set([
  "MTR",
  "HKU",
  "HKUST",
  "CUHK",
  "HKCEC",
  "HZMB",
  "BBI",
  "PLK",
  "YMCA",
  "YWCA",
  "PTI",
  "II",
  "III",
  "IV",
]);

function capitalize(word) {
  if (!word) return word;
  if (KEEP_UPPER.has(word.toUpperCase())) return word.toUpperCase();
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

// "QUEEN'S" → "Queen's", "O'BRIEN" → "O'Brien".
function capitalizeApostrophes(word) {
  return word
    .split("'")
    .map((part, index) => {
      if (index === 0) return capitalize(part);
      if (part.toUpperCase() === "S") return "s";
      return capitalize(part);
    })
    .join("'");
}

function titleCase(raw) {
  // Capitalize each word, including after hyphens, slashes and parens.
  return raw
    .toLowerCase()
    .replace(/[a-z0-9']+/gi, (word) => capitalizeApostrophes(word));
}

export function cleanStopNameEn(raw) {
  if (!raw) return "";
  let name = raw.normalize("NFKC").trim();
  while (STOP_CODE.test(name)) name = name.replace(STOP_CODE, "");
  return titleCase(name).replace(/\s+/g, " ").trim();
}

export function cleanStopNameZh(raw) {
  if (!raw) return "";
  let name = raw.trim();
  while (STOP_CODE.test(name)) name = name.replace(STOP_CODE, "");
  return name.replace(/\s+/g, " ").trim();
}

// Typing target: nobody should have to type "(" or "'". Apostrophes vanish
// ("Queen's" → "queens"), other punctuation becomes a space.
export function stopTypingTarget(cleanedEn) {
  return cleanedEn
    .normalize("NFKC")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}
