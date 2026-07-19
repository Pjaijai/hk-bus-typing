import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  Play,
} from "lucide-react";
import { HKMap } from "./HKMap";
import { SearchBox } from "./SearchBox";
import { getRouteViewBox, MAP_VIEWBOX } from "../lib/map";
import { getLineRuns, getPlayableStations, getRunLabel } from "../lib/data";
import { OPERATOR_NAMES, OPERATORS, routeTextColor } from "../lib/busNormalize";
import { TYPING_LANGUAGES } from "../lib/typing";
import { UI_LOCALES } from "../lib/i18n";

export function HomeScreen({
  t,
  locale,
  mapModel,
  routes,
  selectedRoute,
  runIndex,
  onRunChange,
  mode,
  onModeChange,
  typingLanguage,
  onTypingLanguageChange,
  onSelect,
  onRouteLoaded,
  onClear,
  onStart,
}) {
  const useZh = locale === UI_LOCALES.ZH;
  const stationName = (station) => (useZh ? station.nameZh : station.nameEn);
  const selectedMapRoute =
    mapModel.routes.find((route) => route.id === selectedRoute?.id) ?? null;
  const viewBox = selectedMapRoute
    ? getRouteViewBox(selectedMapRoute, 320, 64)
    : MAP_VIEWBOX;
  const runs = selectedRoute ? getLineRuns(selectedRoute) : [];
  const playable = selectedRoute
    ? getPlayableStations(selectedRoute, runIndex)
    : [];
  const activeRun = selectedMapRoute?.runs[runIndex] ?? null;
  const [collapsed, setCollapsed] = useState(false);

  const operatorName = (operator) =>
    useZh ? OPERATOR_NAMES[operator]?.zh : OPERATOR_NAMES[operator]?.en;
  const loadedRouteIds = useMemo(
    () => new Set(routes.map((route) => route.id)),
    [routes],
  );

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

  return (
    <section className="landing">
      <div className="landing-map">
        <HKMap
          mapModel={mapModel}
          viewBox={viewBox}
          selectedLineId={selectedRoute?.id ?? null}
          onSelectLine={onSelect}
          activeRun={activeRun}
          currentStopIndex={playable.length ? 0 : null}
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
        <a
          href="https://github.com/hkbus/hk-bus-crawling"
          target="_blank"
          rel="noreferrer"
        >
          {t("stopsCredit")}
        </a>
        {" · "}
        <a
          href="https://github.com/hkbus/route-waypoints"
          target="_blank"
          rel="noreferrer"
        >
          {t("waypointsCredit")}
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
        {!selectedRoute ? (
          <>
            <div className="island-title">
              <h1>{t("appName")}</h1>
              <p>{t("tagline")}</p>
              <a
                className="mtr-link"
                href="https://mtr-typing.paulwong.dev/"
                target="_blank"
                rel="noreferrer"
              >
                <span className="line-chip" style={{ background: "#E60012" }}>
                  MTR
                </span>
                {t("mtrGame")}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
            <SearchBox
              t={t}
              locale={locale}
              loadedRouteIds={loadedRouteIds}
              onPick={onSelect}
              onRouteLoaded={onRouteLoaded}
            />
            {OPERATORS.map((operator) => {
              const operatorRoutes = routes.filter(
                (route) => route.operator === operator,
              );
              if (!operatorRoutes.length) return null;
              return (
                <div key={operator} className="operator-group">
                  <span
                    className="island-label operator-label"
                    style={{ "--line-color": operatorRoutes[0].color }}
                  >
                    {operatorName(operator)}
                  </span>
                  <div className="line-strip">
                    {operatorRoutes.map((route) => (
                      <button
                        key={route.id}
                        type="button"
                        className="line-pill route-pill"
                        style={{ "--line-color": route.color }}
                        title={getRunLabel(getLineRuns(route)[0], useZh)}
                        onClick={() => onSelect(route.id)}
                      >
                        <span
                          className="line-chip"
                          style={{ background: route.color, color: routeTextColor(route.co) }}
                        >
                          {route.route}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="start-hint island-hint">{t("homeHint")}</p>
          </>
        ) : (
          <>
            <div className="island-head">
              <button
                type="button"
                className="back-button"
                onClick={onClear}
                aria-label={t("backToRoutes")}
              >
                <ChevronLeft size={18} />
              </button>
              <span
                className="line-chip large"
                style={{ background: selectedRoute.color, color: routeTextColor(selectedRoute.co) }}
              >
                {selectedRoute.route}
              </span>
              <span className="line-names">
                <strong>
                  {playable.length
                    ? `${stationName(playable[0])} → ${stationName(
                        playable[playable.length - 1],
                      )}`
                    : selectedRoute.route}
                </strong>
                <small>
                  {operatorName(selectedRoute.operator)} · {playable.length}{" "}
                  {t("stops")}
                </small>
              </span>
              <button
                type="button"
                className="start-button"
                style={{ "--line-color": selectedRoute.color }}
                onClick={onStart}
              >
                <Play size={15} />
                {t("start")}
              </button>
            </div>
            <div className="island-controls">
              {runs.length > 1 ? (
                <div className="island-group">
                  <span className="island-label">{t("direction")}</span>
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
            <p className="start-hint">{t("lineHint")}</p>
          </>
        )}
      </div>
    </section>
  );
}
