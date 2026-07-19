import { TramFront } from "lucide-react";

export function ResultScreen({
  t,
  elapsed,
  completed,
  metrics,
  lineColor,
  onRetry,
  onBack,
}) {
  return (
    <section className="result" style={{ "--line-color": lineColor ?? "#E60012" }}>
      <div className="result-card">
        <TramFront size={34} aria-hidden="true" />
        <h1>{t("resultTitle")}</h1>
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
            <small>{t("completedStations")}</small>
            <strong>{completed}</strong>
          </div>
          <div>
            <small>{t("elapsed")}</small>
            <strong>{elapsed}s</strong>
          </div>
        </div>
        <div className="result-actions">
          <button type="button" className="start-button" onClick={onRetry}>
            {t("retry")}
          </button>
          <button type="button" className="ghost-button" onClick={onBack}>
            {t("backHome")}
          </button>
        </div>
        <p className="start-hint">{t("resultHint")}</p>
      </div>
    </section>
  );
}
