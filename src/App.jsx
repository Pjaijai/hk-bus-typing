import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Languages, Moon, Sun } from "lucide-react";
import { HomeScreen } from "./components/HomeScreen";
import { GameScreen } from "./components/GameScreen";
import { ResultScreen } from "./components/ResultScreen";
import { ChallengeLanding } from "./components/ChallengeLanding";
import { buildMapModel } from "./lib/map";
import { getLineRuns, getPlayableStations, getRunLabel } from "./lib/data";
import {
  getTypingTarget,
  isTypingCharacterMatch,
  normalizeCommittedText,
  TYPING_LANGUAGES,
} from "./lib/typing";
import {
  getInitialLocale,
  persistLocale,
  translate,
  UI_LOCALES,
} from "./lib/i18n";
import {
  loadMuted,
  playArrival,
  playError,
  playFinish,
  playKeystroke,
  setMuted,
} from "./lib/audio";
import { trackEvent } from "./lib/analytics";
import {
  buildChallengeUrl,
  compareResults,
  parseChallengeHash,
} from "./lib/challenge";
import { loadPlayableRoute, loadRouteIndex } from "./lib/routeLoader";

const safeStorage = () =>
  typeof localStorage === "undefined" ? null : localStorage;

const TIMED_MS = 30000;

function useNetworkData() {
  const [state, setState] = useState({ data: null, boundary: null, error: null });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/bus.json").then((r) => {
        if (!r.ok) throw new Error(`bus.json HTTP ${r.status}`);
        return r.json();
      }),
      fetch("/data/hk-boundary.json").then((r) => {
        if (!r.ok) throw new Error(`hk-boundary.json HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([data, boundary]) => {
        if (!cancelled) setState({ data, boundary, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, boundary: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export default function App() {
  const { data, boundary, error } = useNetworkData();
  // Routes loaded through search-all join the featured set at runtime.
  const [extraRoutes, setExtraRoutes] = useState([]);
  const routes = useMemo(
    () => (data ? [...data.routes, ...extraRoutes] : []),
    [data, extraRoutes],
  );
  const mapModel = useMemo(
    () => (routes.length && boundary ? buildMapModel(boundary, routes) : null),
    [routes, boundary],
  );

  const [locale, setLocale] = useState(() =>
    getInitialLocale(
      typeof localStorage === "undefined" ? null : localStorage,
      navigator.languages ?? [navigator.language],
    ),
  );
  const t = useCallback((key) => translate(locale, key), [locale]);

  const [screen, setScreen] = useState("home");
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [runIndex, setRunIndex] = useState(0);
  const [mode, setMode] = useState("timed");
  const [typingLanguage, setTypingLanguage] = useState(TYPING_LANGUAGES.ENGLISH);
  // A decoded #vs/ challenge link, or null outside that flow.
  const [challenge, setChallenge] = useState(null);
  const [challengeRouteError, setChallengeRouteError] = useState(null);
  // In-memory only. One field covers both roles — a session is either the
  // challenger naming themself while sharing, or the receiver naming
  // themself before their run — never both at once.
  const [playerName, setPlayerName] = useState("");
  const [dark, setDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );
  const [soundMuted, setSoundMuted] = useState(() => loadMuted(safeStorage()));

  const toggleSound = useCallback(() => {
    setSoundMuted((value) => {
      setMuted(safeStorage(), !value);
      return !value;
    });
  }, []);

  const [stationIndex, setStationIndex] = useState(0);
  const [typedIndex, setTypedIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [errors, setErrors] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [shake, setShake] = useState(false);
  // Pulses true for a moment every 10th streak — a little "boost" flourish
  // on the bus itself, mirroring how shake flashes on a mistake.
  const [busBoost, setBusBoost] = useState(false);
  const [compositionText, setCompositionText] = useState("");
  // Wrong keystrokes drag the bus back along the road (visual only —
  // the typing cursor never moves back).
  const [stopPenalty, setStopPenalty] = useState(0);
  // Metres already banked at completed stops; the current leg's partial
  // distance is derived from typing progress each render.
  const traveledMetersRef = useRef(0);
  // Rolling-window speedo: the km/h shown is your pace over the last few
  // seconds, not a lifetime average — pause and it falls to zero.
  const currentMetersRef = useRef(0);
  const speedSamplesRef = useRef([]);
  const [speedKmh, setSpeedKmh] = useState(0);

  const startTimeRef = useRef(0);
  const typingInputRef = useRef(null);
  const gameActiveRef = useRef(false);
  const isComposingRef = useRef(false);
  // Fast bursts of keystrokes can outrun React renders, so the cursor and
  // active stop are also tracked synchronously in refs.
  const typedIndexRef = useRef(0);
  const stationIndexRef = useRef(0);

  const selectedRoute =
    routes.find((route) => route.id === selectedRouteId) ?? null;
  const stations = useMemo(
    () => getPlayableStations(selectedRoute, runIndex),
    [selectedRoute, runIndex],
  );
  const runs = useMemo(() => getLineRuns(selectedRoute), [selectedRoute]);
  const runModel =
    mapModel?.routes.find((route) => route.id === selectedRouteId)?.runs[
      runIndex
    ] ?? null;
  const runLabel = getRunLabel(runs[runIndex] ?? runs[0], locale === UI_LOCALES.ZH);

  const attempts = correct + errors;
  const remaining = Math.max(Math.ceil((TIMED_MS - elapsedMs) / 1000), 0);
  const elapsed = Math.floor(elapsedMs / 1000);
  // Clamp to 2s so the first keystrokes don't produce an absurd spike.
  const minutes = Math.max(elapsedMs, 2000) / 60000;
  const metrics = {
    speed:
      typingLanguage === TYPING_LANGUAGES.CHINESE
        ? Math.round(correct / minutes)
        : Math.round(correct / 5 / minutes),
    speedUnit: typingLanguage === TYPING_LANGUAGES.CHINESE ? "CPM" : "WPM",
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 100,
  };

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    document.documentElement.lang = locale === UI_LOCALES.ZH ? "zh-Hant" : "en";
  }, [locale]);

  const toggleLocale = useCallback(() => {
    setLocale((value) => {
      const next = value === UI_LOCALES.ZH ? UI_LOCALES.EN : UI_LOCALES.ZH;
      persistLocale(
        typeof localStorage === "undefined" ? null : localStorage,
        next,
      );
      return next;
    });
  }, []);

  const resetTypingInput = useCallback(() => {
    isComposingRef.current = false;
    if (typingInputRef.current) typingInputRef.current.value = "";
    setCompositionText("");
  }, []);

  const selectRoute = useCallback((routeId) => {
    setSelectedRouteId(routeId);
    setRunIndex(0);
    window.scrollTo({ top: 0 });
  }, []);

  // Search-all hands over a freshly normalized route object; register it
  // and select it in one step. runIndex defaults to 0 for a fresh pick,
  // but a challenge link needs to land on the specific direction the
  // challenger played.
  const addLoadedRoute = useCallback((route, runIndex = 0) => {
    setExtraRoutes((current) =>
      current.some((existing) => existing.id === route.id)
        ? current
        : [...current, route],
    );
    setSelectedRouteId(route.id);
    setRunIndex(runIndex);
  }, []);

  // Non-featured routes (only reachable today via search-all) need the
  // same runtime resolution SearchBox already uses. Pulled out of the
  // deep-link effect so the challenge-landing retry button can call it too.
  const resolveChallengeRoute = useCallback(
    (parsed) => {
      setChallengeRouteError(null);
      loadRouteIndex()
        .then((index) => {
          const entry = index.find((e) => e.id === parsed.routeId);
          if (!entry) throw new Error("route not found in index");
          return loadPlayableRoute(entry);
        })
        .then((route) => addLoadedRoute(route, parsed.runIndex))
        .catch((error) => setChallengeRouteError(error));
    },
    [addLoadedRoute],
  );

  // Deep links: #vs/<payload> is a challenge (checked first, since it's
  // the more specific prefix); #r/<route-id> preselects a featured route.
  // The two coexist because the prefixes are disjoint.
  useEffect(() => {
    if (!data) return;
    const parsed = parseChallengeHash(window.location.hash);
    if (parsed) {
      setChallenge(parsed);
      setMode(parsed.mode);
      setTypingLanguage(parsed.typingLanguage);
      setScreen("challenge");
      const featured = data.routes.find((r) => r.id === parsed.routeId);
      if (featured) {
        setSelectedRouteId(featured.id);
        setRunIndex(parsed.runIndex);
        return;
      }
      resolveChallengeRoute(parsed);
      return;
    }
    const match = window.location.hash.match(/^#r\/(.+)$/);
    const route = match && data.routes.find((r) => r.id === match[1]);
    if (route) setSelectedRouteId(route.id);
  }, [data, resolveChallengeRoute]);

  const clearRoute = useCallback(() => {
    setSelectedRouteId(null);
    setRunIndex(0);
  }, []);

  const selectRun = useCallback((index) => {
    setRunIndex(index);
  }, []);

  const startGame = useCallback(() => {
    if (stations.length < 2) return;
    resetTypingInput();
    gameActiveRef.current = true;
    typedIndexRef.current = 0;
    stationIndexRef.current = 0;
    setStationIndex(0);
    setTypedIndex(0);
    setCorrect(0);
    setErrors(0);
    setStreak(0);
    setBestStreak(0);
    setBusBoost(false);
    setCompleted(0);
    setElapsedMs(0);
    setStopPenalty(0);
    traveledMetersRef.current = 0;
    currentMetersRef.current = 0;
    speedSamplesRef.current = [];
    setSpeedKmh(0);
    startTimeRef.current = performance.now();
    setScreen("game");
    typingInputRef.current?.focus({ preventScroll: true });
    trackEvent("game_start", {
      line: selectedRouteId ?? "unknown",
      mode,
      typing_language: typingLanguage,
    });
  }, [mode, resetTypingInput, selectedRouteId, stations.length, typingLanguage]);

  const backToHome = useCallback(() => {
    gameActiveRef.current = false;
    resetTypingInput();
    typingInputRef.current?.blur();
    setChallenge(null);
    setChallengeRouteError(null);
    setScreen("home");
  }, [resetTypingInput]);

  const finishGame = useCallback(() => {
    if (!gameActiveRef.current) return;
    gameActiveRef.current = false;
    resetTypingInput();
    typingInputRef.current?.blur();
    const ms = performance.now() - startTimeRef.current;
    setElapsedMs(mode === "timed" ? Math.min(ms, TIMED_MS) : ms);
    playFinish();
    setScreen("result");
    trackEvent("game_finish", {
      mode,
      elapsed_seconds: Math.round(ms / 1000),
    });
  }, [mode, resetTypingInput]);

  useEffect(() => {
    if (screen !== "game") return undefined;
    const timer = setInterval(() => {
      const ms = performance.now() - startTimeRef.current;
      setElapsedMs(mode === "timed" ? Math.min(ms, TIMED_MS) : ms);
    }, 200);
    return () => clearInterval(timer);
  }, [mode, screen]);

  useEffect(() => {
    if (screen === "game" && mode === "timed" && elapsedMs >= TIMED_MS)
      finishGame();
  }, [elapsedMs, finishGame, mode, screen]);

  // Sampled on every 200ms tick; the target speed is metres gained across
  // a 5s window, capped at a bus-plausible 150. The displayed value eases
  // toward it like a needle, so it winds up over a second or two instead
  // of leaping the moment you start typing.
  useEffect(() => {
    if (screen !== "game") return;
    const samples = speedSamplesRef.current;
    samples.push({ ms: elapsedMs, m: currentMetersRef.current });
    while (samples.length && samples[0].ms < elapsedMs - 5000) samples.shift();
    const first = samples[0];
    const last = samples[samples.length - 1];
    const span = last.ms - first.ms;
    if (span < 500) return;
    const target = Math.min(
      200,
      Math.max(0, (last.m - first.m) / 1000 / (span / 3600000)),
    );
    // Asymmetric needle: earns speed slowly, loses it fast.
    setSpeedKmh((value) => {
      const rate = target > value ? 0.055 : 0.3;
      return value + (target - value) * rate;
    });
  }, [elapsedMs, screen]);

  const advanceStation = useCallback(() => {
    const currentIndex = stationIndexRef.current;
    setCompleted((value) => value + 1);
    // Bank the finished leg's real distance for the km/h readout.
    const from = runModel?.stops[currentIndex - 1];
    const to = runModel?.stops[currentIndex];
    if (from && to) traveledMetersRef.current += to.meters - from.meters;
    setStopPenalty(0);
    if (
      (mode === "line" || mode === "express") &&
      currentIndex >= stations.length - 1
    ) {
      finishGame();
      return;
    }
    playArrival();
    const nextIndex = (currentIndex + 1) % stations.length;
    typedIndexRef.current = 0;
    stationIndexRef.current = nextIndex;
    setStationIndex(nextIndex);
    setTypedIndex(0);
  }, [finishGame, mode, runModel, stations.length]);

  const typeCharacter = useCallback(
    (character) => {
      if (!gameActiveRef.current || [...character].length !== 1) return;
      const station = stations[stationIndexRef.current];
      if (!station) return;
      const targetCharacters = [...getTypingTarget(station, typingLanguage)];
      const expected = targetCharacters[typedIndexRef.current];
      if (isTypingCharacterMatch(character, expected, typingLanguage)) {
        typedIndexRef.current += 1;
        setCorrect((value) => value + 1);
        setStreak((value) => {
          const next = value + 1;
          setBestStreak((best) => Math.max(best, next));
          if (next % 10 === 0) {
            setBusBoost(false);
            requestAnimationFrame(() => setBusBoost(true));
            setTimeout(() => setBusBoost(false), 500);
          }
          return next;
        });
        playKeystroke();
        if (typedIndexRef.current >= targetCharacters.length) advanceStation();
        else setTypedIndex(typedIndexRef.current);
      } else {
        setErrors((value) => value + 1);
        setStopPenalty((value) => value + 1);
        setStreak(0);
        playError();
        setShake(false);
        requestAnimationFrame(() => setShake(true));
        setTimeout(() => setShake(false), 180);
        // Express mode is permadeath: any mistake ends the run right here.
        if (mode === "express") finishGame();
      }
    },
    [advanceStation, finishGame, mode, stations, typingLanguage],
  );

  const consumeTypingInput = useCallback(
    (input) => {
      const value = input.value;
      if (!value) return;
      input.value = "";
      setCompositionText("");
      for (const character of normalizeCommittedText(value, typingLanguage))
        typeCharacter(character);
    },
    [typeCharacter, typingLanguage],
  );

  const handleTypingInput = useCallback(
    (event) => {
      if (isComposingRef.current || event.nativeEvent.isComposing) {
        setCompositionText(event.currentTarget.value);
        return;
      }
      consumeTypingInput(event.currentTarget);
    },
    [consumeTypingInput],
  );

  const handleCompositionStart = useCallback((event) => {
    isComposingRef.current = true;
    setCompositionText(event.currentTarget.value);
  }, []);

  const handleCompositionUpdate = useCallback((event) => {
    setCompositionText(event.data || event.currentTarget.value || "");
  }, []);

  const handleCompositionEnd = useCallback(
    (event) => {
      isComposingRef.current = false;
      setCompositionText("");
      // compositionend fires once the input holds the committed candidate.
      consumeTypingInput(event.currentTarget);
    },
    [consumeTypingInput],
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing || event.keyCode === 229) return;
      const tag = event.target.tagName;
      // Letters typed into a field drive that field; Enter on a focused
      // control should activate that control, not the shortcut.
      const inFormField =
        tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA";
      const onControl = inFormField || Boolean(event.target.closest?.("button, a"));
      if (event.key === "Escape") {
        if (screen === "game" || screen === "result" || screen === "challenge")
          backToHome();
        else if (screen === "home" && selectedRouteId) clearRoute();
        else if (screen === "home") event.target.blur?.();
        return;
      }
      if (screen === "result") {
        if (event.key === "Enter" && !onControl) startGame();
        return;
      }
      if (screen === "home") {
        if (event.key === "Enter") {
          if (!onControl && stations.length > 1) startGame();
          return;
        }
        if (inFormField || event.metaKey || event.ctrlKey || event.altKey)
          return;
        const key = event.key.toLowerCase();
        if (key === "s") {
          event.preventDefault();
          document.getElementById("route-search")?.focus();
          return;
        }
        if (/^\d$/.test(key) && data) {
          const route = data.routes[key === "0" ? 9 : Number(key) - 1];
          if (route) selectRoute(route.id);
          return;
        }
        if (!selectedRouteId) return;
        if (key === "d") {
          if (runs.length > 1) selectRun((runIndex + 1) % runs.length);
        } else if (key === "m") {
          setMode((value) =>
            value === "timed" ? "line" : value === "line" ? "express" : "timed",
          );
        } else if (key === "t") {
          setTypingLanguage((value) =>
            value === TYPING_LANGUAGES.ENGLISH
              ? TYPING_LANGUAGES.CHINESE
              : TYPING_LANGUAGES.ENGLISH,
          );
        }
        return;
      }
      if (
        screen !== "game" ||
        event.target === typingInputRef.current ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key.length !== 1
      )
        return;
      const target = getTypingTarget(
        stations[stationIndexRef.current],
        typingLanguage,
      );
      if (event.key === " " || target[typedIndexRef.current] === " ")
        event.preventDefault();
      typeCharacter(event.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    backToHome,
    clearRoute,
    data,
    runIndex,
    runs,
    screen,
    selectRoute,
    selectRun,
    selectedRouteId,
    startGame,
    stations,
    typeCharacter,
    typingLanguage,
  ]);

  const currentTarget = getTypingTarget(stations[stationIndex], typingLanguage);

  // While typing stop k the bus travels the leg from stop k-1 to stop k,
  // proportionally to correct characters; errors pull it back a character.
  const targetLength = [...currentTarget].length;
  const effectiveTyped = Math.max(0, typedIndex - stopPenalty);
  const legProgress = targetLength
    ? Math.min(effectiveTyped / targetLength, 1)
    : 0;
  const fromStop =
    runModel?.stops[stationIndex - 1] ?? runModel?.stops[stationIndex] ?? null;
  const toStop = runModel?.stops[stationIndex] ?? null;
  const busLength =
    fromStop && toStop
      ? fromStop.length + (toStop.length - fromStop.length) * legProgress
      : null;
  const legMeters =
    fromStop && toStop ? (toStop.meters - fromStop.meters) * legProgress : 0;
  currentMetersRef.current = traveledMetersRef.current + legMeters;

  const showChrome = screen !== "game";

  return (
    <div className="app-shell">
      <input
        ref={typingInputRef}
        className="hidden-typing-input"
        type="text"
        inputMode="text"
        lang={typingLanguage === TYPING_LANGUAGES.CHINESE ? "zh-Hant" : "en"}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={t("typingInstruction")}
        onInput={handleTypingInput}
        onCompositionStart={handleCompositionStart}
        onCompositionUpdate={handleCompositionUpdate}
        onCompositionEnd={handleCompositionEnd}
      />
      {showChrome ? (
        <header className={`topbar${screen === "home" ? " floating" : ""}`}>
          <button
            type="button"
            className="brand"
            onClick={() => {
              clearRoute();
              backToHome();
            }}
          >
            <img className="brand-mark" src="/favicon.svg" alt="" />
            <span>{t("appName")}</span>
          </button>
          <div className="top-actions">
            <button
              type="button"
              className="icon-button"
              onClick={toggleLocale}
              aria-label={t("uiLanguage")}
              title={t("uiLanguage")}
            >
              <Languages size={17} />
              <span className="icon-button-label">
                {locale === UI_LOCALES.ZH ? "EN" : "中"}
              </span>
            </button>
            <button
              type="button"
              className="icon-button"
              aria-pressed={dark}
              aria-label={t("darkMode")}
              onClick={() => setDark((value) => !value)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>
      ) : null}
      <main>
        {error ? (
          <div className="data-error">
            <strong>{t("loadError")}</strong>
            <span>{error.message}</span>
            <button type="button" onClick={() => location.reload()}>
              {t("reload")}
            </button>
          </div>
        ) : null}
        {!error && !mapModel ? (
          <div className="loading">
            <span />
            {t("loading")}
          </div>
        ) : null}
        {mapModel && screen === "home" ? (
          <HomeScreen
            t={t}
            locale={locale}
            mapModel={mapModel}
            routes={routes}
            selectedRoute={selectedRoute}
            runIndex={runIndex}
            onRunChange={selectRun}
            mode={mode}
            onModeChange={setMode}
            typingLanguage={typingLanguage}
            onTypingLanguageChange={setTypingLanguage}
            onSelect={selectRoute}
            onRouteLoaded={addLoadedRoute}
            onClear={clearRoute}
            onStart={startGame}
          />
        ) : null}
        {mapModel && screen === "challenge" ? (
          <ChallengeLanding
            t={t}
            locale={locale}
            challenge={challenge}
            resolvedRoute={selectedRoute}
            loadError={challengeRouteError}
            name={playerName}
            onNameChange={setPlayerName}
            onStart={startGame}
            onRetryLoad={() => resolveChallengeRoute(challenge)}
            onSkip={backToHome}
          />
        ) : null}
        {mapModel && screen === "game" && selectedRoute && stations.length ? (
          <GameScreen
            t={t}
            locale={locale}
            mapModel={mapModel}
            line={selectedRoute}
            runIndex={runIndex}
            runLabel={runLabel}
            busLength={busLength}
            speedKmh={speedKmh}
            streak={streak}
            busBoost={busBoost}
            stations={stations}
            mode={mode}
            stationIndex={stationIndex}
            typedIndex={typedIndex}
            target={currentTarget}
            typingLanguage={typingLanguage}
            compositionText={compositionText}
            completed={completed}
            remaining={remaining}
            elapsed={elapsed}
            metrics={metrics}
            shake={shake}
            soundMuted={soundMuted}
            onToggleSound={toggleSound}
            onBack={backToHome}
            onFocusTyping={() =>
              typingInputRef.current?.focus({ preventScroll: true })
            }
          />
        ) : null}
        {screen === "result" ? (
          <ResultScreen
            t={t}
            mode={mode}
            elapsed={elapsed}
            completed={completed}
            totalStops={stations.length}
            metrics={metrics}
            errors={errors}
            bestStreak={bestStreak}
            lineColor={selectedRoute?.color}
            onRetry={startGame}
            onBack={backToHome}
            opponent={challenge}
            playerName={playerName}
            onNameChange={setPlayerName}
            onShare={() =>
              buildChallengeUrl({
                routeId: selectedRouteId,
                runIndex,
                mode,
                typingLanguage,
                name: playerName,
                speed: metrics.speed,
                speedUnit: metrics.speedUnit,
                accuracy: metrics.accuracy,
                completed,
                elapsedSeconds: elapsed,
              })
            }
            winner={
              challenge
                ? compareResults(
                    { speed: metrics.speed, accuracy: metrics.accuracy },
                    { speed: challenge.speed, accuracy: challenge.accuracy },
                  )
                : null
            }
          />
        ) : null}
      </main>
      {screen === "result" ? (
        <footer>
          <div className="footer-brand">
            <span className="footer-wordmark">{t("appName")}</span>
            <span className="footer-lines" aria-hidden="true">
              {(data?.routes ?? []).slice(0, 12).map((route) => (
                <i key={route.id} style={{ background: route.color }} />
              ))}
            </span>
          </div>
          <div className="footer-meta">
            <p>
              <span className="footer-label">{t("dataCredit")}</span>
              <a
                href="https://github.com/hkbus/hk-bus-crawling"
                target="_blank"
                rel="noreferrer"
              >
                {t("stopsCredit")}
              </a>
              <span className="footer-sep">·</span>
              <a
                href="https://github.com/hkbus/route-waypoints"
                target="_blank"
                rel="noreferrer"
              >
                {t("waypointsCredit")}
              </a>
              <span className="footer-sep">·</span>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                {t("mapCredit")}
              </a>
            </p>
            <p>
              {t("createdByBefore")}
              <a
                href="https://www.linkedin.com/in/paulwong169/"
                target="_blank"
                rel="noreferrer"
              >
                Paul Wong
              </a>
              {t("createdByAfter")}
            </p>
            <p>{t("disclaimer")}</p>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
