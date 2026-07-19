import { useCallback, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  loadPlayableRoute,
  loadRouteIndex,
  searchRoutes,
} from "../lib/routeLoader";
import { contrastText, routeColor } from "../lib/busNormalize";
import { UI_LOCALES } from "../lib/i18n";

export function SearchBox({ t, locale, loadedRouteIds, onPick, onRouteLoaded }) {
  const useZh = locale === UI_LOCALES.ZH;
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(null);
  const [indexFailed, setIndexFailed] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [failedId, setFailedId] = useState(null);

  const ensureIndex = useCallback(() => {
    if (index) return;
    setIndexFailed(false);
    loadRouteIndex()
      .then(setIndex)
      .catch(() => setIndexFailed(true));
  }, [index]);

  const results = useMemo(
    () => (index ? searchRoutes(index, query) : []),
    [index, query],
  );

  const pick = useCallback(
    (entry) => {
      if (loadedRouteIds.has(entry.id)) {
        onPick(entry.id);
        return;
      }
      setFailedId(null);
      setLoadingId(entry.id);
      loadPlayableRoute(entry)
        .then((route) => {
          setLoadingId(null);
          onRouteLoaded(route);
        })
        .catch(() => {
          setLoadingId(null);
          setFailedId(entry.id);
        });
    },
    [loadedRouteIds, onPick, onRouteLoaded],
  );

  return (
    <div className="island-group search-group">
      <label className="island-label" htmlFor="route-search">
        {t("search")}
      </label>
      <div className="search-field">
        <Search size={15} aria-hidden="true" />
        <input
          id="route-search"
          type="search"
          autoComplete="off"
          placeholder={t("searchPlaceholder")}
          value={query}
          onFocus={ensureIndex}
          onChange={(event) => {
            ensureIndex();
            setQuery(event.target.value);
          }}
        />
      </div>
      {indexFailed ? (
        <p className="search-status">
          {t("searchError")}{" "}
          <button type="button" className="ghost-button" onClick={ensureIndex}>
            {t("searchRetry")}
          </button>
        </p>
      ) : null}
      {query.trim() && index && !results.length ? (
        <p className="search-status">{t("searchNoResults")}</p>
      ) : null}
      {results.length ? (
        <ul className="search-results">
          {results.map((entry) => {
            const color = routeColor(entry.co, entry.route);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className="search-result"
                  disabled={loadingId === entry.id}
                  onClick={() => pick(entry)}
                >
                  <span
                    className="line-chip"
                    style={{
                      background: color,
                      color: contrastText(color),
                    }}
                  >
                    {entry.route}
                  </span>
                  <span className="search-result-label">
                    {useZh
                      ? `${entry.orig.zh} → ${entry.dest.zh}`
                      : `${entry.orig.en} → ${entry.dest.en}`}
                  </span>
                  {loadingId === entry.id ? (
                    <span className="search-result-note">
                      {t("searchLoading")}
                    </span>
                  ) : null}
                  {failedId === entry.id ? (
                    <span className="search-result-note error">
                      {t("searchError")}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
