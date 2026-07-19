import { useState } from "react";
import { BusFront } from "lucide-react";

export function ResultScreen({
  t,
  mode,
  elapsed,
  completed,
  totalStops,
  metrics,
  errors,
  bestStreak,
  lineColor,
  onRetry,
  onBack,
  opponent,
  playerName,
  onNameChange,
  onShare,
  winner,
}) {
  const [shareState, setShareState] = useState("idle");

  // Full route → terminus; a mistake in Express mode → breakdown; some
  // progress → a pat on the back; never left the first stop → questions
  // about the driver's licence.
  const title =
    mode === "express" && totalStops && completed < totalStops
      ? t("resultTitleExpressDeath")
      : totalStops && completed >= totalStops
        ? t("resultTitle")
        : completed > 0
          ? t("resultTitleProgress")
          : t("resultTitleZero");

  const copyLink = () => {
    const url = onShare();
    navigator.clipboard
      .writeText(url)
      .then(() => setShareState("copied"))
      .catch(() => setShareState("error"));
  };

  return (
    <section className="result" style={{ "--line-color": lineColor ?? "#E60012" }}>
      <div className="result-card">
        <BusFront size={34} aria-hidden="true" />
        <h1>{title}</h1>
        <div className="result-stats">
          <div>
            <small>{metrics.speedUnit}</small>
            <strong>{metrics.speed}</strong>
          </div>
          <div>
            <small>{t("accuracy")}</small>
            <strong>{metrics.accuracy}%</strong>
          </div>
          <div>
            <small>{t("errors")}</small>
            <strong>{errors}</strong>
          </div>
          <div>
            <small>{t("completedStops")}</small>
            <strong>{completed}</strong>
          </div>
          <div>
            <small>{t("elapsed")}</small>
            <strong>{elapsed}s</strong>
          </div>
          <div>
            <small>{t("bestStreak")}</small>
            <strong>{bestStreak}</strong>
          </div>
        </div>

        {opponent ? (
          <div className="versus-panel">
            <span className="versus-label">{t("challengeVersusLabel")}</span>
            <div className="versus-columns">
              <div className="versus-column">
                <small>{t("challengeYourName")}</small>
                <strong>{playerName || t("challengeYourName")}</strong>
                <span>
                  {metrics.speed} {metrics.speedUnit} · {metrics.accuracy}%
                </span>
              </div>
              <div className="versus-column">
                <small>{t("challengeOpponentName")}</small>
                <strong>{opponent.name}</strong>
                <span>
                  {opponent.speed} {opponent.speedUnit} · {opponent.accuracy}%
                </span>
              </div>
            </div>
            <p className="versus-winner">
              {winner === "challenger"
                ? t("challengeWinnerYou")
                : winner === "opponent"
                  ? t("challengeWinnerThem")
                  : t("challengeWinnerTie")}
            </p>
          </div>
        ) : (
          <div className="share-panel">
            <span className="island-label">{t("challengeShareTitle")}</span>
            <input
              type="text"
              className="challenge-name-input"
              value={playerName}
              maxLength={24}
              placeholder={t("challengeNamePlaceholder")}
              aria-label={t("challengeNameLabel")}
              onChange={(event) => onNameChange(event.target.value)}
            />
            <button
              type="button"
              className="ghost-button"
              disabled={!playerName.trim()}
              onClick={copyLink}
            >
              {t("challengeCopyLink")}
            </button>
            {shareState === "copied" ? (
              <p className="share-feedback">{t("challengeLinkCopied")}</p>
            ) : null}
            {shareState === "error" ? (
              <p className="share-feedback">{t("challengeLinkCopyFailed")}</p>
            ) : null}
          </div>
        )}

        <div className="result-actions">
          {opponent ? (
            <button type="button" className="start-button" onClick={copyLink}>
              {t("challengeRematch")}
            </button>
          ) : (
            <button type="button" className="start-button" onClick={onRetry}>
              {t("retry")}
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onBack}>
            {t("backHome")}
          </button>
        </div>
        {opponent && shareState === "copied" ? (
          <p className="share-feedback">{t("challengeLinkCopied")}</p>
        ) : null}
        {opponent && shareState === "error" ? (
          <p className="share-feedback">{t("challengeLinkCopyFailed")}</p>
        ) : null}
        <p className="start-hint">
          {opponent ? t("challengeResultHint") : t("resultHint")}
        </p>
      </div>
    </section>
  );
}
