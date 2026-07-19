import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import { HKMap } from "./HKMap";
import { SearchBox } from "./SearchBox";
import { getRouteViewBox, MAP_VIEWBOX } from "../lib/map";
import { getLineRuns, getPlayableStations, getRunLabel } from "../lib/data";
import { loadPlayableRoute, loadRouteIndex } from "../lib/routeLoader";
import {
  OPERATOR_COLORS,
  OPERATOR_NAMES,
  OPERATORS,
  primaryOperator,
  routeColor,
  routeTextColor,
} from "../lib/busNormalize";
import { TYPING_LANGUAGES } from "../lib/typing";
import { UI_LOCALES } from "../lib/i18n";

// Operators that ship a curated offline set (featured-routes.json is bus-only).
const FEATURED_OPERATORS = ["kmb", "ctb", "nlb"];
// How many index routes to surface per non-featured type on the landing page.
const TYPE_ROUTE_LIMIT = 24;

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

  // The offline featured set is bus-only; those operators show their curated
  // routes instantly. Every other type is browsed from the search index and
  // loaded on demand, the same path SearchBox uses.
  const [selectedType, setSelectedType] = useState(OPERATORS[0]);
  const [typeIndex, setTypeIndex] = useState(null);
  const [typeIndexFailed, setTypeIndexFailed] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [failedId, setFailedId] = useState(null);

  const ensureTypeIndex = useCallback(() => {
    if (typeIndex) return;
    setTypeIndexFailed(false);
    loadRouteIndex()
      .then(setTypeIndex)
      .catch(() => setTypeIndexFailed(true));
  }, [typeIndex]);

  const chooseType = useCallback(
    (operator) => {
      setSelectedType(operator);
      setFailedId(null);
      if (!FEATURED_OPERATORS.includes(operator)) ensureTypeIndex();
    },
    [ensureTypeIndex],
  );

  // Chips for the selected type: featured operators come straight from the
  // loaded route objects; other types come from the index (capped), carrying
  // the raw entry so a click can load it. null means "index not ready yet".
  const typeRoutes = useMemo(() => {
    if (FEATURED_OPERATORS.includes(selectedType))
      return routes
        .filter((route) => route.operator === selectedType)
        .map((route) => ({
          id: route.id,
          route: route.route,
          co: route.co,
          color: route.color,
          title: getRunLabel(getLineRuns(route)[0], useZh),
          loaded: true,
        }));
    if (!typeIndex) return null;
    return typeIndex
      .filter((entry) => primaryOperator(entry.co) === selectedType)
      .slice(0, TYPE_ROUTE_LIMIT)
      .map((entry) => ({
        id: entry.id,
        route: entry.route,
        co: entry.co,
        color: routeColor(entry.co, entry.route),
        title: useZh
          ? `${entry.orig.zh} → ${entry.dest.zh}`
          : `${entry.orig.en} → ${entry.dest.en}`,
        loaded: loadedRouteIds.has(entry.id),
        entry,
      }));
  }, [selectedType, routes, typeIndex, loadedRouteIds, useZh]);

  const pickTypeRoute = useCallback(
    (item) => {
      if (item.loaded) {
        onSelect(item.id);
        return;
      }
      setFailedId(null);
      setLoadingId(item.id);
      loadPlayableRoute(item.entry)
        .then((route) => {
          setLoadingId(null);
          onRouteLoaded(route);
        })
        .catch(() => {
          setLoadingId(null);
          setFailedId(item.id);
        });
    },
    [onSelect, onRouteLoaded],
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
        {" · "}
        <a
          href="https://github.com/Pjaijai/hk-bus-typing"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
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
            </div>
            <SearchBox
              t={t}
              locale={locale}
              loadedRouteIds={loadedRouteIds}
              onPick={onSelect}
              onRouteLoaded={onRouteLoaded}
            />
            <div className="operator-group">
              <span className="island-label">{t("transportType")}</span>
              <div className="type-switch">
                {OPERATORS.map((operator) => (
                  <button
                    key={operator}
                    type="button"
                    className={`type-button${
                      selectedType === operator ? " active" : ""
                    }`}
                    style={{ "--line-color": OPERATOR_COLORS[operator] }}
                    onClick={() => chooseType(operator)}
                  >
                    {operatorName(operator)}
                  </button>
                ))}
              </div>
              {typeIndexFailed && !typeRoutes ? (
                <p className="search-status">
                  {t("searchError")}{" "}
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={ensureTypeIndex}
                  >
                    {t("searchRetry")}
                  </button>
                </p>
              ) : !typeRoutes ? (
                <p className="search-status">{t("searchLoading")}</p>
              ) : !typeRoutes.length ? (
                <p className="search-status">{t("searchNoResults")}</p>
              ) : (
                <div className="line-strip">
                  {typeRoutes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="line-pill route-pill"
                      style={{ "--line-color": item.color }}
                      title={item.title}
                      disabled={loadingId === item.id}
                      onClick={() => pickTypeRoute(item)}
                    >
                      <span
                        className="line-chip"
                        style={{
                          background: item.color,
                          color: routeTextColor(item.co),
                        }}
                      >
                        {item.route}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {failedId ? (
                <p className="search-status error">{t("searchError")}</p>
              ) : null}
            </div>
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
                  <button
                    type="button"
                    className={`option-button${mode === "express" ? " active" : ""}`}
                    onClick={() => onModeChange("express")}
                  >
                    {t("modeExpress")}
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
