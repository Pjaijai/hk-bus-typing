import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Volume2,
  VolumeX,
} from "lucide-react";
import { HKMap } from "./HKMap";
import { getPairViewBox, getRouteViewBox } from "../lib/map";
import { pointAtLength } from "../lib/busGeometry";
import { contrastText } from "../lib/busNormalize";
import { TYPING_LANGUAGES } from "../lib/typing";
import { UI_LOCALES } from "../lib/i18n";

export function GameScreen({
  t,
  locale,
  mapModel,
  line,
  runIndex,
  runLabel,
  busLength,
  speedKmh,
  streak,
  busBoost,
  stations,
  mode,
  stationIndex,
  typedIndex,
  target,
  typingLanguage,
  compositionText,
  completed,
  remaining,
  elapsed,
  metrics,
  shake,
  soundMuted,
  onToggleSound,
  onBack,
  onFocusTyping,
}) {
  const useZh = locale === UI_LOCALES.ZH;
  const route = mapModel.routes.find((r) => r.id === line.id);
  const activeRun = route?.runs[runIndex] ?? route?.runs[0] ?? null;
  const station = stations[stationIndex];
  const nextStation = stations[(stationIndex + 1) % stations.length];
  // Tracking camera: hug the moving bus and the stop it is driving to,
  // falling back to the whole route. Retargeting every keystroke is fine —
  // the viewBox animation glides between targets.
  const viewBox = useMemo(() => {
    const busPoint =
      activeRun && busLength != null
        ? pointAtLength(activeRun.geometry, activeRun.lengths, busLength).point
        : null;
    // Chase cam: a fixed tight window centred on the bus alone — the
    // target stop simply rolls into view as the bus closes in on it.
    const points = [
      busPoint ?? activeRun?.stops[stationIndex]?.point,
    ].filter(Boolean);
    return points.length
      ? getPairViewBox(points, 12, 6, 0.16)
      : getRouteViewBox(route, 320, 64, 0.16);
  }, [activeRun, busLength, route, stationIndex]);
  // Pressing start flies the camera in from the whole route to the first
  // station; keep the initial frame stable across re-renders.
  const routeViewBox = useMemo(
    () => getRouteViewBox(route, 320, 64, 0.16),
    [route],
  );
  const targetCharacters = [...target];
  const [collapsed, setCollapsed] = useState(false);
  const streakTier = streak >= 50 ? 3 : streak >= 25 ? 2 : streak >= 10 ? 1 : 0;

  return (
    /* The click handler only refocuses the hidden IME input for phones. */
    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    <section
      className="game"
      style={{ "--line-color": line.color }}
      onClick={onFocusTyping}
    >
      <div className="game-map-bg">
        <HKMap
          mapModel={mapModel}
          viewBox={viewBox}
          initialViewBox={routeViewBox}
          selectedLineId={line.id}
          activeRun={activeRun}
          currentStopIndex={stationIndex}
          completedCount={stationIndex}
          busLength={busLength}
          busShake={shake}
          busSpeeding={speedKmh > 150 ? 2 : speedKmh > 100 ? 1 : 0}
          busBoost={busBoost}
        />
      </div>
      <div className="game-top">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label={t("backToRoutes")}
        >
          <ChevronLeft size={16} />
          <span className="back-label">{t("backToRoutes")}</span>
        </button>
        <div className="game-line">
          <span className="line-chip" style={{ background: line.color, color: contrastText(line.color) }}>
            {line.code}
          </span>
          <strong>{runLabel}</strong>
        </div>
        <div className="game-top-right">
          {streak > 0 ? (
            <div
              className={`game-timer game-streak${
                streakTier ? ` streak-tier-${streakTier}` : ""
              }`}
              role="status"
            >
              <small>{t("streak")}</small>
              <strong>{streak}</strong>
            </div>
          ) : null}
          <div
            className={`game-timer game-speed${speedKmh > 100 ? " overspeed" : ""}${
              speedKmh > 150 ? " overspeed-max" : ""
            }`}
            role="status"
          >
            <small>km/h</small>
            <strong>{Math.round(speedKmh)}</strong>
          </div>
          <button
            type="button"
            className="sound-button"
            aria-pressed={!soundMuted}
            aria-label={soundMuted ? t("soundOn") : t("soundOff")}
            title={soundMuted ? t("soundOn") : t("soundOff")}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSound();
            }}
          >
            {soundMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <div className="game-timer" role="timer">
            {mode === "timed" ? (
              <>
                <small>{t("timeLeft")}</small>
                <strong>{remaining}s</strong>
              </>
            ) : (
              <>
                <small>{t("elapsed")}</small>
                <strong>{elapsed}s</strong>
              </>
            )}
          </div>
        </div>
      </div>
      <div className={`island game-island${collapsed ? " collapsed" : ""}`}>
        <button
          type="button"
          className="island-handle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("expandPanel") : t("collapsePanel")}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <div className="game-stats">
          <div>
            <small>{metrics.speedUnit}</small>
            <strong>{metrics.speed}</strong>
          </div>
          <div>
            <small>{t("accuracy")}</small>
            <strong>{metrics.accuracy}%</strong>
          </div>
          <div>
            <small>{t("completedStops")}</small>
            <strong>
              {completed}
              {mode === "line" ? ` / ${stations.length}` : ""}
            </strong>
          </div>
          <div className="next-station">
            <small>{useZh ? "下一站" : "Next"}</small>
            <strong>{useZh ? nextStation?.nameZh : nextStation?.nameEn}</strong>
          </div>
        </div>
        <div className={`typing-panel${shake ? " shake" : ""}`}>
          <div className="station-names">
            <small>{t("stop")}</small>
            <h2>
              {typingLanguage === TYPING_LANGUAGES.CHINESE
                ? station?.nameZh
                : station?.nameEn}
            </h2>
            <p>
              {typingLanguage === TYPING_LANGUAGES.CHINESE
                ? station?.nameEn
                : station?.nameZh}
            </p>
          </div>
          <div className="target" aria-live="polite">
            {targetCharacters.map((character, index) => (
              <span
                key={index}
                className={`target-char${index < typedIndex ? " typed" : ""}${
                  index === typedIndex ? " current" : ""
                }`}
              >
                {character === " " ? " " : character}
              </span>
            ))}
          </div>
          {typingLanguage === TYPING_LANGUAGES.CHINESE ? (
            <div className="composition">{compositionText || " "}</div>
          ) : null}
          <p className="tap-hint">{t("tapToType")}</p>
        </div>
      </div>
    </section>
  );
}
