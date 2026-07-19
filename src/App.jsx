import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Languages, Moon, Sun } from "lucide-react";
import { HomeScreen } from "./components/HomeScreen";
import { GameScreen } from "./components/GameScreen";
import { ResultScreen } from "./components/ResultScreen";
import { buildJourneyRoute, buildMapModel, JOURNEY_COLOR } from "./lib/map";
import {
  buildNetwork,
  findJourney,
  getLineRuns,
  getPlayableStations,
  ROUTE_DIRECTIONS,
} from "./lib/data";
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

const safeStorage = () =>
  typeof localStorage === "undefined" ? null : localStorage;

const TIMED_MS = 30000;

const JOURNEY_LINE = {
  id: "journey",
  code: "⇄",
  nameZh: "自由行程",
  nameEn: "Journey",
  color: JOURNEY_COLOR,
};

function useNetworkData() {
  const [state, setState] = useState({ data: null, boundary: null, error: null });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/mtr.json").then((r) => {
        if (!r.ok) throw new Error(`mtr.json HTTP ${r.status}`);
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
  const mapModel = useMemo(
    () => (data && boundary ? buildMapModel(boundary, data.lines) : null),
    [data, boundary],
  );

  const [locale, setLocale] = useState(() =>
    getInitialLocale(
      typeof localStorage === "undefined" ? null : localStorage,
      navigator.languages ?? [navigator.language],
    ),
  );
  const t = useCallback((key) => translate(locale, key), [locale]);

  const [screen, setScreen] = useState("home");
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyFrom, setJourneyFrom] = useState("");
  const [journeyTo, setJourneyTo] = useState("");
  const [runIndex, setRunIndex] = useState(0);
  const [direction, setDirection] = useState(ROUTE_DIRECTIONS.FORWARD);
  const [mode, setMode] = useState("timed");
  const [typingLanguage, setTypingLanguage] = useState(TYPING_LANGUAGES.ENGLISH);
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
  const [completed, setCompleted] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [shake, setShake] = useState(false);
  const [compositionText, setCompositionText] = useState("");

  const startTimeRef = useRef(0);
  const typingInputRef = useRef(null);
  const gameActiveRef = useRef(false);
  const isComposingRef = useRef(false);
  // Fast bursts of keystrokes can outrun React renders, so the cursor and
  // active station are also tracked synchronously in refs.
  const typedIndexRef = useRef(0);
  const stationIndexRef = useRef(0);

  const selectedLine =
    data?.lines.find((line) => line.id === selectedLineId) ?? null;
  const network = useMemo(
    () => (data ? buildNetwork(data.lines) : null),
    [data],
  );
  const journeyStations = useMemo(
    () => (network ? findJourney(network, journeyFrom, journeyTo) : []),
    [network, journeyFrom, journeyTo],
  );
  const stations = useMemo(
    () =>
      journeyOpen
        ? journeyStations
        : getPlayableStations(selectedLine, runIndex, direction),
    [journeyOpen, journeyStations, selectedLine, runIndex, direction],
  );
  const activeLine = journeyOpen ? JOURNEY_LINE : selectedLine;
  const journeyRoute = useMemo(
    () =>
      journeyOpen && mapModel && journeyStations.length > 1
        ? buildJourneyRoute(
            mapModel,
            journeyStations.map((station) => station.id),
          )
        : null,
    [journeyOpen, mapModel, journeyStations],
  );

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

  const selectLine = useCallback((lineId) => {
    setJourneyOpen(false);
    setSelectedLineId(lineId);
    setRunIndex(0);
    setDirection(ROUTE_DIRECTIONS.FORWARD);
    window.scrollTo({ top: 0 });
  }, []);

  const clearLine = useCallback(() => {
    setSelectedLineId(null);
    setJourneyOpen(false);
    setRunIndex(0);
    setDirection(ROUTE_DIRECTIONS.FORWARD);
  }, []);

  const openJourney = useCallback(() => {
    setSelectedLineId(null);
    setJourneyOpen(true);
    setMode("line");
  }, []);

  const selectRun = useCallback((index) => {
    setRunIndex(index);
    setDirection(ROUTE_DIRECTIONS.FORWARD);
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
    setCompleted(0);
    setElapsedMs(0);
    startTimeRef.current = performance.now();
    setScreen("game");
    typingInputRef.current?.focus({ preventScroll: true });
    trackEvent("game_start", {
      line: journeyOpen ? "journey" : (selectedLineId ?? "unknown"),
      mode,
      typing_language: typingLanguage,
    });
  }, [
    journeyOpen,
    mode,
    resetTypingInput,
    selectedLineId,
    stations.length,
    typingLanguage,
  ]);

  const backToHome = useCallback(() => {
    gameActiveRef.current = false;
    resetTypingInput();
    typingInputRef.current?.blur();
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

  const advanceStation = useCallback(() => {
    const currentIndex = stationIndexRef.current;
    setCompleted((value) => value + 1);
    if (mode === "line" && currentIndex >= stations.length - 1) {
      finishGame();
      return;
    }
    playArrival();
    const nextIndex = (currentIndex + 1) % stations.length;
    typedIndexRef.current = 0;
    stationIndexRef.current = nextIndex;
    setStationIndex(nextIndex);
    setTypedIndex(0);
  }, [finishGame, mode, stations.length]);

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
        playKeystroke();
        if (typedIndexRef.current >= targetCharacters.length) advanceStation();
        else setTypedIndex(typedIndexRef.current);
      } else {
        setErrors((value) => value + 1);
        playError();
        setShake(false);
        requestAnimationFrame(() => setShake(true));
        setTimeout(() => setShake(false), 180);
      }
    },
    [advanceStation, stations, typingLanguage],
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
      // Letters typed into a select drive its native type-ahead; Enter on a
      // focused control should activate that control, not the shortcut.
      const inFormField =
        tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA";
      const onControl = inFormField || Boolean(event.target.closest?.("button, a"));
      if (event.key === "Escape") {
        if (screen === "game" || screen === "result") backToHome();
        else if (screen === "home" && (selectedLineId || journeyOpen))
          clearLine();
        return;
      }
      if (screen === "result") {
        if (event.key === "Enter" && !onControl) startGame();
        return;
      }
      if (screen === "home") {
        if (event.key === "Enter") {
          // Enter is inert on a closed select, so let it start the game
          // there — journey players pick stations without leaving the field.
          const startAllowed =
            !onControl || (tag === "SELECT" && journeyOpen);
          if (startAllowed && stations.length > 1) startGame();
          return;
        }
        if (inFormField || event.metaKey || event.ctrlKey || event.altKey)
          return;
        const key = event.key.toLowerCase();
        if (key === "j") {
          openJourney();
          return;
        }
        if (/^\d$/.test(key) && data) {
          const line = data.lines[key === "0" ? 9 : Number(key) - 1];
          if (line) selectLine(line.id);
          return;
        }
        if (journeyOpen) {
          if (key === "f") {
            event.preventDefault();
            document.getElementById("journey-from")?.focus();
          } else if (key === "t") {
            event.preventDefault();
            document.getElementById("journey-to")?.focus();
          } else if (key === "l") {
            setTypingLanguage((value) =>
              value === TYPING_LANGUAGES.ENGLISH
                ? TYPING_LANGUAGES.CHINESE
                : TYPING_LANGUAGES.ENGLISH,
            );
          }
          return;
        }
        if (!selectedLineId) return;
        if (key === "d") {
          setDirection((value) =>
            value === ROUTE_DIRECTIONS.FORWARD
              ? ROUTE_DIRECTIONS.REVERSE
              : ROUTE_DIRECTIONS.FORWARD,
          );
        } else if (key === "m") {
          setMode((value) => (value === "timed" ? "line" : "timed"));
        } else if (key === "t") {
          setTypingLanguage((value) =>
            value === TYPING_LANGUAGES.ENGLISH
              ? TYPING_LANGUAGES.CHINESE
              : TYPING_LANGUAGES.ENGLISH,
          );
        } else if (key === "r") {
          const runCount = getLineRuns(selectedLine).length;
          if (runCount > 1) selectRun((runIndex + 1) % runCount);
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
    clearLine,
    data,
    journeyOpen,
    openJourney,
    runIndex,
    screen,
    selectLine,
    selectRun,
    selectedLine,
    selectedLineId,
    startGame,
    stations,
    typeCharacter,
    typingLanguage,
  ]);

  const currentTarget = getTypingTarget(stations[stationIndex], typingLanguage);
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
              clearLine();
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
            lines={data.lines}
            selectedLine={selectedLine}
            journeyOpen={journeyOpen}
            journeyFrom={journeyFrom}
            journeyTo={journeyTo}
            journeyStations={journeyStations}
            journeyRoute={journeyRoute}
            onJourneyOpen={openJourney}
            onJourneyFromChange={setJourneyFrom}
            onJourneyToChange={setJourneyTo}
            runIndex={runIndex}
            onRunChange={selectRun}
            direction={direction}
            onDirectionChange={setDirection}
            mode={mode}
            onModeChange={setMode}
            typingLanguage={typingLanguage}
            onTypingLanguageChange={setTypingLanguage}
            onSelect={selectLine}
            onClear={clearLine}
            onStart={startGame}
          />
        ) : null}
        {mapModel && screen === "game" && activeLine && stations.length ? (
          <GameScreen
            t={t}
            locale={locale}
            mapModel={mapModel}
            line={activeLine}
            overlayRoute={journeyRoute}
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
            elapsed={elapsed}
            completed={completed}
            metrics={metrics}
            lineColor={activeLine?.color}
            onRetry={startGame}
            onBack={backToHome}
          />
        ) : null}
      </main>
      {screen === "result" ? (
        <footer>
          <div className="footer-brand">
            <span className="footer-wordmark">{t("appName")}</span>
            <span className="footer-lines" aria-hidden="true">
              {(data?.lines ?? []).map((line) => (
                <i key={line.id} style={{ background: line.color }} />
              ))}
            </span>
          </div>
          <div className="footer-meta">
            <p>
              <span className="footer-label">{t("dataCredit")}</span>
              <a
                href="https://opendata.mtr.com.hk/"
                target="_blank"
                rel="noreferrer"
              >
                {t("stationsCredit")}
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
