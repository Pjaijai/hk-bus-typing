import { ChevronLeft, Play, RefreshCw, Trophy } from "lucide-react";
import { getLineRuns, getRunLabel } from "../lib/data";
import { routeTextColor } from "../lib/busNormalize";
import { UI_LOCALES } from "../lib/i18n";

// Read-only landing screen for a #vs/ challenge link: the route, direction,
// mode and typing language are all fixed by the link (both players must
// play the identical config for the comparison to mean anything) — the
// only thing the receiver picks is their own name.
export function ChallengeLanding({
  t,
  locale,
  challenge,
  resolvedRoute,
  loadError,
  name,
  onNameChange,
  onStart,
  onRetryLoad,
  onSkip,
}) {
  const useZh = locale === UI_LOCALES.ZH;

  if (loadError) {
    return (
      <section className="challenge">
        <div className="challenge-card challenge-error">
          <strong>{t("challengeLandingError")}</strong>
          <span>{loadError.message}</span>
          <div className="result-actions">
            <button type="button" className="start-button" onClick={onRetryLoad}>
              <RefreshCw size={15} />
              {t("searchRetry")}
            </button>
            <button type="button" className="ghost-button" onClick={onSkip}>
              <ChevronLeft size={15} />
              {t("challengeLandingSkip")}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!resolvedRoute) {
    return (
      <section className="challenge">
        <div className="loading">
          <span />
          {t("challengeLandingLoading")}
        </div>
      </section>
    );
  }

  const run = getLineRuns(resolvedRoute)[challenge.runIndex];
  const runLabel = getRunLabel(run, useZh);

  return (
    <section
      className="challenge"
      style={{ "--line-color": resolvedRoute.color }}
    >
      <div className="challenge-card">
        <Trophy size={34} aria-hidden="true" />
        <h1>{challenge.name}</h1>
        <p className="challenge-intro">
          {t("challengeLandingIntro")}{" "}
          <strong>
            {challenge.speed} {challenge.speedUnit}
          </strong>{" "}
          · {challenge.accuracy}%
        </p>
        <div className="challenge-route">
          <span
            className="line-chip large"
            style={{
              background: resolvedRoute.color,
              color: routeTextColor(resolvedRoute.co),
            }}
          >
            {resolvedRoute.route}
          </span>
          <span className="line-names">
            <strong>{runLabel}</strong>
          </span>
        </div>
        <p className="challenge-cta">{t("challengeLandingCta")}</p>
        <input
          type="text"
          className="challenge-name-input"
          value={name}
          maxLength={24}
          placeholder={t("challengeNamePlaceholder")}
          aria-label={t("challengeNameLabel")}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <div className="result-actions">
          <button
            type="button"
            className="start-button"
            disabled={!name.trim()}
            onClick={onStart}
          >
            <Play size={15} />
            {t("start")}
          </button>
          <button type="button" className="ghost-button" onClick={onSkip}>
            {t("challengeLandingSkip")}
          </button>
        </div>
      </div>
    </section>
  );
}
