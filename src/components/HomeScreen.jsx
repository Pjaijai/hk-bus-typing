import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Play,
} from "lucide-react";
import { HKMap } from "./HKMap";
import { getRouteViewBox, JOURNEY_COLOR, MAP_VIEWBOX } from "../lib/map";
import {
  getLineRuns,
  getPlayableStations,
  getRunLabel,
  ROUTE_DIRECTIONS,
} from "../lib/data";
import { TYPING_LANGUAGES } from "../lib/typing";
import { UI_LOCALES } from "../lib/i18n";

export function HomeScreen({
  t,
  locale,
  mapModel,
  lines,
  selectedLine,
  journeyOpen,
  journeyFrom,
  journeyTo,
  journeyStations,
  journeyRoute,
  onJourneyOpen,
  onJourneyFromChange,
  onJourneyToChange,
  runIndex,
  onRunChange,
  direction,
  onDirectionChange,
  mode,
  onModeChange,
  typingLanguage,
  onTypingLanguageChange,
  onSelect,
  onClear,
  onStart,
}) {
  const useZh = locale === UI_LOCALES.ZH;
  const stationName = (station) => (useZh ? station.nameZh : station.nameEn);
  const selectedRoute =
    mapModel.routes.find((route) => route.id === selectedLine?.id) ?? null;
  const viewBox = journeyRoute
    ? getRouteViewBox(journeyRoute, 320, 64)
    : selectedRoute
      ? getRouteViewBox(selectedRoute, 320, 64)
      : MAP_VIEWBOX;
  const runs = selectedLine ? getLineRuns(selectedLine) : [];
  const playable = journeyOpen
    ? journeyStations
    : selectedLine
      ? getPlayableStations(selectedLine, runIndex, direction)
      : [];
  const journeyReady = journeyOpen && journeyStations.length > 1;
  const [collapsed, setCollapsed] = useState(false);

  // Keyboard flow: opening journey mode lands you straight in the picker.
  useEffect(() => {
    if (journeyOpen) document.getElementById("journey-from")?.focus();
  }, [journeyOpen]);

  const typingLanguageGroup = (
    <div className="island-group">
      <span className="island-label">{t("typingLanguage")}</span>
      <div className="option-row">
        <button
          type="button"
          className={`option-button${
            typingLanguage === TYPING_LANGUAGES.ENGLISH ? " active" : ""
          }`}
          onClick={() => onTypingLanguageChange(TYPING_LANGUAGES.ENGLISH)}
        >
          {t("typingEn")}
        </button>
        <button
          type="button"
          className={`option-button${
            typingLanguage === TYPING_LANGUAGES.CHINESE ? " active" : ""
          }`}
          onClick={() => onTypingLanguageChange(TYPING_LANGUAGES.CHINESE)}
        >
          {t("typingZh")}
        </button>
      </div>
    </div>
  );

  const stationSelect = (id, value, onChange, label) => (
    <div className="island-group select-group">
      <span className="island-label">{label}</span>
      <select
        id={id}
        className="station-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{t("pickStation")}</option>
        {lines.map((line) => (
          <optgroup key={line.id} label={useZh ? line.nameZh : line.nameEn}>
            {line.stations.map((station) => (
              <option key={station.id} value={station.id}>
                {stationName(station)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );

  return (
    <section className="landing">
      <div className="landing-map">
        <HKMap
          mapModel={mapModel}
          viewBox={viewBox}
          selectedLineId={selectedLine?.id ?? null}
          onSelectLine={onSelect}
          overlayRoute={journeyOpen ? journeyRoute : null}
          activeStationIds={playable.map((station) => station.id)}
          currentStationId={playable[0]?.id ?? null}
        />
      </div>
      <p className="landing-credits">
        {t("createdByBefore")}
        <a
          href="https://www.linkedin.com/in/paulwong169/"
          target="_blank"
          rel="noreferrer"
        >
          Paul Wong
        </a>
        {t("createdByAfter")}
        {" · "}
        <a href="https://opendata.mtr.com.hk/" target="_blank" rel="noreferrer">
          {t("stationsCredit")}
        </a>
        {" · "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          {t("mapCredit")}
        </a>
      </p>
      <div className={`island${collapsed ? " collapsed" : ""}`}>
        <button
          type="button"
          className="island-handle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("expandPanel") : t("collapsePanel")}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {!selectedLine && !journeyOpen ? (
          <>
            <div className="island-title">
              <h1>{t("appName")}</h1>
              <p>{t("tagline")}</p>
            </div>
            <div className="line-strip">
              <button
                type="button"
                className="line-pill journey-pill"
                style={{ "--line-color": JOURNEY_COLOR }}
                onClick={onJourneyOpen}
              >
                <span className="line-chip" style={{ background: JOURNEY_COLOR }}>
                  ⇄
                </span>
                {t("journey")}
              </button>
              {lines.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  className="line-pill"
                  style={{ "--line-color": line.color }}
                  onClick={() => onSelect(line.id)}
                >
                  <span className="line-chip" style={{ background: line.color }}>
                    {line.code}
                  </span>
                  {useZh ? line.nameZh : line.nameEn}
                </button>
              ))}
            </div>
            <p className="start-hint island-hint">{t("homeHint")}</p>
          </>
        ) : null}
        {journeyOpen ? (
          <>
            <div className="island-head">
              <button
                type="button"
                className="back-button"
                onClick={onClear}
                aria-label={t("backToLines")}
              >
                <ChevronLeft size={18} />
              </button>
              <span
                className="line-chip large"
                style={{ background: JOURNEY_COLOR }}
              >
                ⇄
              </span>
              <span className="line-names">
                <strong>{t("journeyTitle")}</strong>
                <small>
                  {journeyReady
                    ? `${journeyStations.length} ${t("stations")}`
                    : t("journeyHint")}
                </small>
              </span>
              <button
                type="button"
                className="start-button"
                style={{ "--line-color": JOURNEY_COLOR }}
                onClick={onStart}
                disabled={!journeyReady}
              >
                <Play size={15} />
                {t("start")}
              </button>
            </div>
            <div className="island-controls">
              {stationSelect("journey-from", journeyFrom, onJourneyFromChange, t("from"))}
              {stationSelect("journey-to", journeyTo, onJourneyToChange, t("to"))}
              {typingLanguageGroup}
            </div>
            <p className="start-hint">{t("journeyKeysHint")}</p>
          </>
        ) : null}
        {selectedLine ? (
          <>
            <div className="island-head">
              <button
                type="button"
                className="back-button"
                onClick={onClear}
                aria-label={t("backToLines")}
              >
                <ChevronLeft size={18} />
              </button>
              <span
                className="line-chip large"
                style={{ background: selectedLine.color }}
              >
                {selectedLine.code}
              </span>
              <span className="line-names">
                <strong>{useZh ? selectedLine.nameZh : selectedLine.nameEn}</strong>
                <small>
                  {playable.length} {t("stations")}
                </small>
              </span>
              <button
                type="button"
                className="start-button"
                style={{ "--line-color": selectedLine.color }}
                onClick={onStart}
              >
                <Play size={15} />
                {t("start")}
              </button>
            </div>
            <div className="island-controls">
              {runs.length > 1 ? (
                <div className="island-group">
                  <span className="island-label">{t("run")}</span>
                  <div className="option-row">
                    {runs.map((run) => (
                      <button
                        key={run.index}
                        type="button"
                        className={`option-button${run.index === runIndex ? " active" : ""}`}
                        onClick={() => onRunChange(run.index)}
                      >
                        {getRunLabel(run, useZh)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="island-group">
                <span className="island-label">{t("direction")}</span>
                <button
                  type="button"
                  className="direction-button"
                  onClick={() =>
                    onDirectionChange(
                      direction === ROUTE_DIRECTIONS.FORWARD
                        ? ROUTE_DIRECTIONS.REVERSE
                        : ROUTE_DIRECTIONS.FORWARD,
                    )
                  }
                >
                  <ArrowLeftRight size={14} />
                  {playable.length
                    ? `${stationName(playable[0])} → ${stationName(
                        playable[playable.length - 1],
                      )}`
                    : ""}
                </button>
              </div>
              <div className="island-group">
                <span className="island-label">{t("mode")}</span>
                <div className="option-row">
                  <button
                    type="button"
                    className={`option-button${mode === "timed" ? " active" : ""}`}
                    onClick={() => onModeChange("timed")}
                  >
                    {t("modeTimed")}
                  </button>
                  <button
                    type="button"
                    className={`option-button${mode === "line" ? " active" : ""}`}
                    onClick={() => onModeChange("line")}
                  >
                    {t("modeLine")}
                  </button>
                </div>
              </div>
              {typingLanguageGroup}
            </div>
            <p className="start-hint">
              {t("lineHint")}
              {runs.length > 1 ? ` · ${t("runHint")}` : ""}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
