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
import { routeTextColor } from "../lib/busNormalize";
import { TYPING_LANGUAGES } from "../lib/typing";
import { UI_LOCALES } from "../lib/i18n";

export function GameScreen({
  t,
  locale,
  mapModel,
  line,
  runIndex,
  runLabel,
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
  // Tracking camera: frame the current stop and its neighbour (the previous
  // one at the end of the route), falling back to the whole route.
  const viewBox = useMemo(() => {
    const points = [
      activeRun?.stops[stationIndex],
      activeRun?.stops[stationIndex + 1] ?? activeRun?.stops[stationIndex - 1],
    ]
      .filter(Boolean)
      .map((stop) => stop.point);
    return points.length
      ? getPairViewBox(points, 130, 36, 0.16)
      : getRouteViewBox(route, 320, 64, 0.16);
  }, [activeRun, route, stationIndex]);
  // Pressing start flies the camera in from the whole route to the first
  // station; keep the initial frame stable across re-renders.
  const routeViewBox = useMemo(
    () => getRouteViewBox(route, 320, 64, 0.16),
    [route],
  );
  const targetCharacters = [...target];
  const [collapsed, setCollapsed] = useState(false);

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
          busShake={shake}
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
          <span className="line-chip" style={{ background: line.color, color: routeTextColor(line.co) }}>
            {line.code}
          </span>
          <strong>{runLabel}</strong>
        </div>
        <div className="game-top-right">
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
