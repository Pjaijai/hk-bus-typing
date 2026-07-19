// Challenge links encode an entire two-player "match" in the URL — no
// backend, no storage. Wire keys are short since the payload rides in a
// hash fragment: v(ersion) r(oute) i(ndex) m(ode) t(yping)l(anguage)
// n(ame) s(peed) u(nit) a(ccuracy) c(ompleted) t(ime).
const SCHEMA_VERSION = 1;

function toWire(payload) {
  return {
    v: SCHEMA_VERSION,
    r: payload.routeId,
    i: payload.runIndex,
    m: payload.mode,
    tl: payload.typingLanguage,
    n: payload.name,
    s: payload.speed,
    u: payload.speedUnit,
    a: payload.accuracy,
    c: payload.completed,
    t: payload.elapsedSeconds,
  };
}

function fromWire(wire) {
  return {
    version: wire.v,
    routeId: wire.r,
    runIndex: wire.i,
    mode: wire.m,
    typingLanguage: wire.tl,
    name: wire.n,
    speed: wire.s,
    speedUnit: wire.u,
    accuracy: wire.a,
    completed: wire.c,
    elapsedSeconds: wire.t,
  };
}

function base64UrlEncode(text) {
  const base64 = btoa(unescape(encodeURIComponent(text)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(encoded) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeChallenge(payload) {
  return base64UrlEncode(JSON.stringify(toWire(payload)));
}

// Never throws — every call site can treat any malformed link (garbage
// base64, truncated JSON, a schema version we don't recognize) as "no
// challenge here" with a simple falsy check.
export function decodeChallenge(encoded) {
  try {
    const wire = JSON.parse(base64UrlDecode(encoded));
    if (wire.v !== SCHEMA_VERSION) return null;
    if (!wire.r || !wire.m || !wire.tl || !wire.n) return null;
    return fromWire(wire);
  } catch {
    return null;
  }
}

export function buildChallengeUrl(payload) {
  return `${location.origin}${location.pathname}#vs/${encodeChallenge(payload)}`;
}

export function parseChallengeHash(hash) {
  const match = hash.match(/^#vs\/(.+)$/);
  return match ? decodeChallenge(match[1]) : null;
}

// Speed decides the match; accuracy only breaks a tie. This only makes
// sense because a challenge link forces both players onto the same mode
// and typing language, so "speed" is always the same unit (WPM vs WPM,
// or CPM vs CPM) on both sides.
export function compareResults(challenger, opponent) {
  if (challenger.speed !== opponent.speed)
    return challenger.speed > opponent.speed ? "challenger" : "opponent";
  if (challenger.accuracy !== opponent.accuracy)
    return challenger.accuracy > opponent.accuracy ? "challenger" : "opponent";
  return "tie";
}
